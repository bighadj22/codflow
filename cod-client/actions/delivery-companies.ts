"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllDeliveryCompanies,
  getDeliveryCompanyById,
} from "@/../cod-shared/queries/delivery-companies";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { DeliveryCompany, StopDesk } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
  error?: string;
}

interface CreateDeliveryCompanyData {
  name: string;
  nameAr: string;
  code: string;
  website?: string | null;
  active?: boolean;
  apiEndpoint?: string | null;
  apiToken?: string | null;
  apiUserGuid?: string | null;
  supportsHomeDelivery?: boolean;
  supportsStopDesk?: boolean;
  supportsTracking?: boolean;
  /** When omitted, server picks a safe default per provider (false for EcoTrack, true otherwise). */
  autoValidate?: boolean;
  notes?: string | null;
}

type UpdateDeliveryCompanyData = Partial<CreateDeliveryCompanyData>;

/**
 * Get all delivery companies.
 */
export async function getDeliveryCompanies(active?: boolean): Promise<DeliveryCompany[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllDeliveryCompanies(db, { active });
  return rows as unknown as DeliveryCompany[];
}

/**
 * Get a single delivery company by ID.
 */
export async function getDeliveryCompany(id: string): Promise<DeliveryCompany | null> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const row = await getDeliveryCompanyById(db, id);
  return (row as unknown as DeliveryCompany | null) ?? null;
}

/**
 * Create a new delivery company.
 */
export async function createDeliveryCompany(
  data: CreateDeliveryCompanyData
): Promise<DeliveryCompany> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<DeliveryCompany>>(
      "/api/delivery-companies",
      apiKey,
      data
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/delivery");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Delivery Companies Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Update a delivery company.
 */
export async function updateDeliveryCompany(
  id: string,
  data: UpdateDeliveryCompanyData
): Promise<DeliveryCompany> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<DeliveryCompany>>(
      `/api/delivery-companies/${id}`,
      apiKey,
      data
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/delivery");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Delivery Companies Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        companyId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Get stop desks from DB cache. No live API call.
 * Supports optional wilayaId filter. Returns only active desks by default.
 */
export async function fetchCompanyStopDesks(
  id: string,
  opts?: { wilayaId?: number; activeOnly?: boolean }
): Promise<StopDesk[]> {
  await requirePermission(SCOPES.DELIVERY_READ);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const params = new URLSearchParams();
    if (opts?.wilayaId != null) params.set("wilayaId", String(opts.wilayaId));
    if (opts?.activeOnly === false) params.set("activeOnly", "false");
    const qs = params.toString() ? `?${params.toString()}` : "";

    const response = await apiClient.get<
      ApiResponse<{ stopDesks: StopDesk[]; total: number; company: { id: string; name: string; code: string } }>
    >(`/api/delivery-companies/${id}/stop-desks${qs}`, apiKey);

    return response.data?.stopDesks ?? [];
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      console.error("[Delivery Companies Action Error]", { code: error.code, companyId: id });
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Sync stop desks from the carrier API and upsert into DB.
 * Admin's manual active-flag toggles are preserved across syncs.
 */
export async function syncCompanyStopDesks(id: string): Promise<{ total: number; removed: number; syncedAt: string }> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<{ total: number; removed: number; syncedAt: string }>>(
      `/api/delivery-companies/${id}/sync-stop-desks`,
      apiKey,
      {}
    );
    revalidatePath("/delivery");
    return response.data ?? { total: 0, removed: 0, syncedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Toggle the active flag on a single stop desk.
 * Returns the new active state.
 */
export async function toggleCompanyStopDesk(
  companyId: string,
  code: string
): Promise<{ code: string; active: boolean }> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<{ code: string; active: boolean }>>(
      `/api/delivery-companies/${companyId}/stop-desks/${encodeURIComponent(code)}/toggle`,
      apiKey,
      {}
    );
    revalidatePath("/delivery");
    if (!response.data) throw new Error("No data returned");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Delete a delivery company.
 */
export async function deleteDeliveryCompany(id: string): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(`/api/delivery-companies/${id}`, apiKey);
    revalidatePath("/delivery");
  } catch (error) {
    console.error(`Failed to delete delivery company ${id}:`, error);
    if (error instanceof ApiClientError) {
      throw new Error(`Failed to delete company: ${error.message}`);
    }
    throw new Error("Failed to delete delivery company");
  }
}

// ─── Webhook Management Actions ───────────────────────────────────────────────

/**
 * Register a ZR Express webhook endpoint via the ZR API.
 * Returns the webhook URL that was registered.
 */
export async function registerZrWebhook(
  companyId: string
): Promise<{ webhookUrl: string; endpointId: string }> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<{ webhookUrl: string; endpointId: string; success: boolean }>(
      `/api/delivery-companies/${companyId}/webhook/register`,
      apiKey,
      {}
    );
    revalidatePath("/delivery");
    return { webhookUrl: response.webhookUrl, endpointId: response.endpointId };
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(error.message ?? "Failed to register ZR webhook");
    }
    throw new Error("Failed to register ZR webhook");
  }
}

/**
 * Unregister (delete) the ZR Express webhook endpoint.
 */
export async function unregisterZrWebhook(companyId: string): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<{ success: boolean }>(
      `/api/delivery-companies/${companyId}/webhook/register`,
      apiKey
    );
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(error.message ?? "Failed to unregister ZR webhook");
    }
    throw new Error("Failed to unregister ZR webhook");
  }
}

/**
 * Save the Yalidine webhook secret key.
 */
export async function saveYalidineSecret(
  companyId: string,
  secret: string
): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.patch<{ success: boolean }>(
      `/api/delivery-companies/${companyId}/webhook/secret`,
      apiKey,
      { secret }
    );
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(error.message ?? "Failed to save Yalidine secret");
    }
    throw new Error("Failed to save Yalidine secret");
  }
}

/**
 * Save the ZR Express custom state name → our status mapping.
 */
export async function saveZrStatusMapping(
  companyId: string,
  mapping: Record<string, string[]>
): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.patch<{ success: boolean }>(
      `/api/delivery-companies/${companyId}/webhook/mapping`,
      apiKey,
      { mapping }
    );
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(error.message ?? "Failed to save ZR status mapping");
    }
    throw new Error("Failed to save ZR status mapping");
  }
}
