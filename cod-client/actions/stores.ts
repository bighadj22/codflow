"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission, requireAdmin } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getStore } from "@/../cod-shared/queries/stores";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

export interface StoreConfig {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  themeId: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  fontFamily: string;
  fontUrl: string | null;
  lang: "ar" | "en";
  currency: string;
  currencySymbol: string;
  contentJson: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  announcementBar: string | null;
  reviewsEnabled: boolean;
  status: "active" | "inactive";
  storeApiKey: string | null;
}

export type UpdateStoreData = Partial<
  Pick<
    StoreConfig,
    | "name"
    | "logoUrl"
    | "primaryColor"
    | "accentColor"
    | "bgColor"
    | "fontFamily"
    | "fontUrl"
    | "lang"
    | "currencySymbol"
    | "contentJson"
    | "metaTitle"
    | "metaDescription"
    | "ogImage"
    | "announcementBar"
    | "reviewsEnabled"
    | "status"
  >
>;

async function getApiKey() {
  const key = await getUserApiKey();
  if (!key) redirect("/setup-api-key");
  return key;
}

export async function getMyStore(): Promise<StoreConfig | null> {
  await requireAdmin();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const store = await getStore(db);
  return store ?? null;
}

export interface PixelConfig {
  id: string;
  storeId: string;
  pixelId: string;
  accessToken: string;
  testEventCode: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavePixelConfigData {
  pixelId: string;
  accessToken?: string;
  testEventCode?: string | null;
  enabled?: boolean;
}

export async function getPixelConfig(): Promise<PixelConfig | null> {
  await requireAdmin();
  const key = await getApiKey();
  try {
    const res = await apiClient.get<{ success: boolean; data: PixelConfig | null }>(
      "/api/stores/pixel-config",
      key
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function savePixelConfig(data: SavePixelConfigData): Promise<PixelConfig> {
  await requireAdmin();
  const key = await getApiKey();
  try {
    const res = await apiClient.post<{ success: boolean; data: PixelConfig }>(
      "/api/stores/pixel-config",
      key,
      data
    );
    revalidatePath("/settings");
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateMyStore(data: UpdateStoreData): Promise<StoreConfig> {
  await requireAdmin();
  const key = await getApiKey();
  try {
    const res = await apiClient.patch<{ success: boolean; data: StoreConfig }>(
      "/api/stores/me",
      key,
      data
    );
    revalidatePath("/settings");
    return res.data!;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Stores Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
