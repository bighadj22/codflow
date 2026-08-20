"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllProfiles,
  getProfileById,
  getDefaultProfileRules,
  getWilayaRule,
  getCommunesWithOverrides,
} from "@/../cod-shared/queries/shipping-profiles";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { ShippingProfile, ShippingProfileWithRules, ShippingRule, CommuneOverride } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

export async function getShippingProfiles(): Promise<ShippingProfile[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllProfiles(db);
  return rows as unknown as ShippingProfile[];
}

export async function getShippingProfile(id: string): Promise<ShippingProfileWithRules | null> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const row = await getProfileById(db, id);
  return (row as unknown as ShippingProfileWithRules | null) ?? null;
}

/** Get all rules for the default profile — used by order form to auto-fill delivery fee. */
export async function getDefaultShippingRules(): Promise<ShippingRule[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getDefaultProfileRules(db);
  return rows as unknown as ShippingRule[];
}

/** Get all rules for a specific profile by ID — used by order form when products have specific shipping profiles. */
export async function getShippingRulesByProfileId(profileId: string): Promise<ShippingRule[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const profile = await getProfileById(db, profileId);
  if (!profile) return [];
  return profile.rules as unknown as ShippingRule[];
}

export async function createShippingProfile(data: {
  name: string;
  isDefault?: boolean;
  notes?: string | null;
}): Promise<ShippingProfileWithRules> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const res = await apiClient.post<ApiResponse<ShippingProfileWithRules>>(
      "/api/shipping-profiles",
      apiKey,
      data
    );
    if (!res.data) throw new Error("No data returned");
    revalidatePath("/delivery");
    return res.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Shipping Profiles Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateShippingProfile(
  id: string,
  data: { name?: string; isDefault?: boolean; notes?: string | null }
): Promise<ShippingProfileWithRules> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const res = await apiClient.patch<ApiResponse<ShippingProfileWithRules>>(
      `/api/shipping-profiles/${id}`,
      apiKey,
      data
    );
    if (!res.data) throw new Error("No data returned");
    revalidatePath("/delivery");
    return res.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Shipping Profiles Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        profileId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteShippingProfile(id: string): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(`/api/shipping-profiles/${id}`, apiKey);
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Shipping Profiles Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        profileId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/** Get commune-level overrides for a wilaya rule. */
export async function getShippingRuleCommunes(
  profileId: string,
  wilayaId: number
): Promise<CommuneOverride[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rule = await getWilayaRule(db, profileId, wilayaId);
  if (!rule) return [];
  const rows = await getCommunesWithOverrides(db, rule.id, wilayaId, {
    homeEnabled: Boolean(rule.homeEnabled ?? true),
    stopDeskEnabled: Boolean(rule.stopDeskEnabled ?? false),
    homePrice: rule.homePrice ?? 0,
    stopDeskPrice: rule.stopDeskPrice ?? 0,
  });
  return rows as unknown as CommuneOverride[];
}

/** Set or update a commune-level delivery override. Any field may be `null` to inherit from the wilaya rule. */
export async function setCommuneOverride(
  profileId: string,
  wilayaId: number,
  communeId: string,
  data: {
    homeEnabled?: boolean | null;
    stopDeskEnabled?: boolean | null;
    homePrice?: number | null;
    stopDeskPrice?: number | null;
  }
): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.put<ApiResponse>(
      `/api/shipping-profiles/${profileId}/rules/${wilayaId}/communes/${communeId}`,
      apiKey,
      data
    );
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      throw new Error(userMessage);
    }
    throw error;
  }
}

/** Remove a commune-level override, reverting to wilaya defaults. */
export async function deleteCommuneOverride(
  profileId: string,
  wilayaId: number,
  communeId: string
): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(
      `/api/shipping-profiles/${profileId}/rules/${wilayaId}/communes/${communeId}`,
      apiKey
    );
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      throw new Error(userMessage);
    }
    throw error;
  }
}

/** Replace all wilaya rates for a profile in one shot. */
export async function setShippingRules(
  profileId: string,
  rules: Array<{
    wilayaId: number;
    homePrice: number;
    stopDeskPrice: number;
    homeEnabled?: boolean;
    stopDeskEnabled?: boolean;
  }>
): Promise<ShippingProfileWithRules> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const res = await apiClient.put<ApiResponse<ShippingProfileWithRules>>(
      `/api/shipping-profiles/${profileId}/rules`,
      apiKey,
      { rules }
    );
    if (!res.data) throw new Error("No data returned");
    revalidatePath("/delivery");
    revalidatePath("/orders/new");
    return res.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Shipping Profiles Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        profileId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
