"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getStockHistory as getStockHistoryQuery,
  getStockOverview as getStockOverviewQuery,
  getStockAlerts as getStockAlertsQuery,
} from "@/../cod-shared/queries/stock";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type {
  AdjustStockInput,
  StockMovement,
  StockHistoryResponse,
  StockOverview,
  StockAlertsResponse,
} from "@/types/stock.types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

async function getApiKey() {
  const key = await getUserApiKey();
  if (!key) redirect("/setup-api-key");
  return key;
}

// ─── Adjust Stock ─────────────────────────────────────────────────────────────

export async function adjustProductStock(
  productId: string,
  input: AdjustStockInput,
): Promise<{ movement: StockMovement; currentInventory: number }> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.post<ApiResponse<{ movement: StockMovement; currentInventory: number }>>(
      `/api/products/${productId}/stock/adjust`,
      key,
      input,
    );
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products/stock");
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Stock Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function adjustVariantStock(
  productId: string,
  variantId: string,
  input: AdjustStockInput,
): Promise<{ movement: StockMovement; currentInventory: number }> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.post<ApiResponse<{ movement: StockMovement; currentInventory: number }>>(
      `/api/products/${productId}/variants/${variantId}/stock/adjust`,
      key,
      input,
    );
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products/stock");
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Stock Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId,
        variantId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

// ─── Stock History ────────────────────────────────────────────────────────────

export async function getStockHistory(
  productId: string,
  filters?: { variantId?: string; limit?: number; offset?: number },
): Promise<StockHistoryResponse> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const res = await getStockHistoryQuery(db, productId, {
    variantId: filters?.variantId,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  });
  return res as unknown as StockHistoryResponse;
}

// ─── Stock Overview ───────────────────────────────────────────────────────────

export async function getStockOverview(): Promise<StockOverview> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const res = await getStockOverviewQuery(db);
  return res as unknown as StockOverview;
}

// ─── Stock Alerts ─────────────────────────────────────────────────────────────

export async function getStockAlerts(filters?: {
  limit?: number;
  offset?: number;
}): Promise<StockAlertsResponse> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const res = await getStockAlertsQuery(db, {
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  });
  return res as unknown as StockAlertsResponse;
}

// ─── Update Threshold ─────────────────────────────────────────────────────────

export async function updateProductStockThreshold(
  productId: string,
  lowStockThreshold: number,
): Promise<void> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    await apiClient.patch(`/api/products/${productId}/stock/threshold`, key, { lowStockThreshold });
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products/stock");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Stock Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateVariantStockThreshold(
  productId: string,
  variantId: string,
  lowStockThreshold: number,
): Promise<void> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    await apiClient.patch(
      `/api/products/${productId}/variants/${variantId}/stock/threshold`,
      key,
      { lowStockThreshold },
    );
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products/stock");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Stock Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId,
        variantId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
