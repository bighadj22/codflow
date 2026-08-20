"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { listOffers, getOfferById } from "@/../cod-shared/queries/offers";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

interface ApiResponse<T = any> {
  data?: T;
  success: boolean;
  count?: number;
}

export interface OfferProduct {
  id: string;
  name: string;
  handle: string;
}

export interface OfferVariant {
  id: string;
  label: string;
}

export interface Offer {
  id: string;
  name: string;
  status: "active" | "inactive";
  triggerQuantity: number;
  rewardQuantity: number;
  discountType: "free" | "free_shipping";
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  triggerProduct: OfferProduct | null;
  triggerVariant: OfferVariant | null;
  rewardProduct: OfferProduct | null;
  rewardVariant: OfferVariant | null;
}

export interface CreateOfferData {
  name: string;
  discountType: "free" | "free_shipping";
  triggerProductId: string;
  triggerVariantId?: string;
  triggerQuantity: number;
  // Only required when discountType === "free"
  rewardProductId?: string;
  rewardVariantId?: string;
  rewardQuantity: number;
  startsAt?: string;
  endsAt?: string;
  status: "active" | "inactive";
}

export async function getOffers(): Promise<Offer[]> {
  await requirePermission(SCOPES.OFFERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return listOffers(db);
}

export async function getOffer(id: string): Promise<Offer | null> {
  await requirePermission(SCOPES.OFFERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getOfferById(db, id);
}

export async function createOffer(data: CreateOfferData): Promise<{ id: string }> {
  await requirePermission(SCOPES.OFFERS_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<{ id: string }>>(
      "/api/offers",
      apiKey,
      data
    );
    revalidatePath("/offers");
    return response.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Offers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateOffer(
  id: string,
  data: Partial<CreateOfferData>
): Promise<void> {
  await requirePermission(SCOPES.OFFERS_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.patch(`/api/offers/${id}`, apiKey, data);
    revalidatePath("/offers");
    revalidatePath(`/offers/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Offers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        offerId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteOffer(id: string): Promise<void> {
  await requirePermission(SCOPES.OFFERS_MANAGE);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete(`/api/offers/${id}`, apiKey);
    revalidatePath("/offers");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Offers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        offerId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
