"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getAllReviews } from "@/../cod-shared/queries/reviews";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

export interface Review {
  id: string;
  storeId: string;
  productId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: "pending" | "approved" | "rejected";
  helpfulCount: number;
  productName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getReviews(params?: {
  status?: "pending" | "approved" | "rejected";
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: Review[]; total: number; pendingCount: number }> {
  await requirePermission(SCOPES.REVIEWS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllReviews(db, {
    status: params?.status,
    productId: params?.productId,
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
  });
}

export async function updateReviewStatus(
  id: string,
  status: "pending" | "approved" | "rejected"
): Promise<Review> {
  await requirePermission(SCOPES.REVIEWS_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<Review>>(
      `/api/reviews/${id}`,
      apiKey,
      { status }
    );
    revalidatePath("/reviews");
    return response.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Reviews Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        reviewId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteReview(id: string): Promise<void> {
  await requirePermission(SCOPES.REVIEWS_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete(`/api/reviews/${id}`, apiKey);
    revalidatePath("/reviews");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);

      console.error("[Reviews Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        reviewId: id,
      });

      throw new Error(userMessage);
    }
    throw error;
  }
}
