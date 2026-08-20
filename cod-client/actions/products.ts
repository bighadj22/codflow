"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllProducts,
  getProductById,
  getProductImages as getProductImagesQuery,
} from "@/../cod-shared/queries/products";
import { getVariantsByProduct } from "@/../cod-shared/queries/variants";
import { getWorkerApiUrl } from "@/lib/api-config";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { Product, ProductVariant, ProductImage } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

async function getApiKey() {
  const key = await getUserApiKey();
  if (!key) redirect("/setup-api-key");
  return key;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(filters?: {
  categoryId?: string; status?: string; visibility?: boolean;
  search?: string; limit?: number; offset?: number;
}): Promise<Product[]> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllProducts(db, {
    categoryId: filters?.categoryId,
    status: filters?.status as "DRAFT" | "ACTIVE" | "ARCHIVED" | undefined,
    visibility: filters?.visibility,
    search: filters?.search,
    limit: filters?.limit,
    offset: filters?.offset,
  });
  return rows as unknown as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const product = await getProductById(db, id);
  return (product as unknown as Product | null) ?? null;
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.post<ApiResponse<Product>>("/api/products", key, data);
    revalidatePath("/products");
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.patch<ApiResponse<Product>>(`/api/products/${id}`, key, data);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    await apiClient.delete(`/api/products/${id}`, key);
    revalidatePath("/products");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export async function getVariants(productId: string): Promise<ProductVariant[]> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getVariantsByProduct(db, productId);
  return rows as unknown as ProductVariant[];
}

export async function createVariant(productId: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.post<ApiResponse<ProductVariant>>(`/api/products/${productId}/variants`, key, data);
    revalidatePath(`/products/${productId}`);
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
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

export async function updateVariant(productId: string, variantId: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.patch<ApiResponse<ProductVariant>>(`/api/products/${productId}/variants/${variantId}`, key, data);
    revalidatePath(`/products/${productId}`);
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
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

export async function deleteVariant(productId: string, variantId: string): Promise<void> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    await apiClient.delete(`/api/products/${productId}/variants/${variantId}`, key);
    revalidatePath(`/products/${productId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
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

// ─── Product Images ────────────────────────────────────────────────────────────

export async function getProductImages(productId: string): Promise<ProductImage[]> {
  await requirePermission(SCOPES.PRODUCTS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getProductImagesQuery(db, productId);
  return rows as unknown as ProductImage[];
}

/**
 * Request a presigned R2 PUT URL from the Worker.
 * The browser then uploads the file directly to R2 using the returned presignedUrl.
 * Returns { presignedUrl, key, publicUrl }.
 */
export async function getPresignedUploadUrl(
  contentType: string,
): Promise<{ presignedUrl: string; key: string; publicUrl: string }> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
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

export async function saveProductImage(
  productId: string,
  data: { key: string; src: string; altText?: string; position?: number }
): Promise<ProductImage> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.post<ApiResponse<ProductImage>>(
      `/api/products/${productId}/images`,
      key,
      data
    );
    revalidatePath(`/products/${productId}`);
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
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

export async function reorderProductImages(productId: string, imageIds: string[]): Promise<ProductImage[]> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    const res = await apiClient.patch<ApiResponse<ProductImage[]>>(
      `/api/products/${productId}/images/reorder`,
      key,
      { imageIds }
    );
    revalidatePath(`/products/${productId}`);
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
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

export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  await requirePermission(SCOPES.PRODUCTS_MANAGE);
  const key = await getApiKey();
  try {
    await apiClient.delete(`/api/products/${productId}/images/${imageId}`, key);
    revalidatePath(`/products/${productId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Products Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        productId,
        imageId,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}
