"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { getWorkerApiUrl } from "@/lib/api-config";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllGroups as getAllProductGroups,
  getGroupById as getProductGroupById,
} from "@/../cod-shared/queries/product-groups";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { ProductCategory } from "@/types";

interface ApiResponse<T = unknown> { data?: T; success: boolean; }

async function getApiKey() {
  const key = await getUserApiKey();
  if (!key) redirect("/setup-api-key");
  return key;
}

export async function getProductGroups(filters?: { search?: string; parentId?: string }): Promise<ProductCategory[]> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllProductGroups(db, filters);
}

export async function getProductGroup(id: string): Promise<ProductCategory | null> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getProductGroupById(db, id);
}

export async function createProductGroup(data: Partial<ProductCategory>): Promise<ProductCategory> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_MANAGE);
  const key = await getApiKey();

  try {
    const res = await apiClient.post<ApiResponse<ProductCategory>>("/api/product-groups", key, data);
    if (!res.data) throw new Error("No data returned from API");
    revalidatePath("/product-groups");
    return res.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Product Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateProductGroup(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_MANAGE);
  const key = await getApiKey();

  try {
    const res = await apiClient.patch<ApiResponse<ProductCategory>>(`/api/product-groups/${id}`, key, data);
    if (!res.data) throw new Error("No data returned from API");
    revalidatePath("/product-groups");
    revalidatePath(`/product-groups/${id}`);
    return res.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Product Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function getPresignedUploadUrlForCategory(
  contentType: string,
): Promise<{ presignedUrl: string; key: string; publicUrl: string }> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_MANAGE);
  const key = await getApiKey();
  const baseUrl = await getWorkerApiUrl();

  const response = await fetch(`${baseUrl}/api/images/presign`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(err?.error ?? `Presign failed: ${response.status}`);
  }

  const json = await response.json() as { success: boolean; data: { presignedUrl: string; key: string; publicUrl: string } };
  return json.data;
}

export async function deleteProductGroup(id: string): Promise<void> {
  await requirePermission(SCOPES.PRODUCT_GROUPS_MANAGE);
  const key = await getApiKey();

  try {
    await apiClient.delete(`/api/product-groups/${id}`, key);
    revalidatePath("/product-groups");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Product Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}
