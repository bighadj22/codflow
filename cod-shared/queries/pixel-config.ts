import type { AppDb } from "../db/client";
import { storePixelConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export type ConversionEvent = "Lead" | "Purchase";

export async function getPixelConfig(db: AppDb, storeId: string) {
  return db
    .select()
    .from(storePixelConfig)
    .where(eq(storePixelConfig.storeId, storeId))
    .get();
}

export interface UpsertPixelConfigData {
  pixelId: string;
  adAccountName?: string | null;
  accessToken?: string;
  testEventCode?: string | null;
  conversionEvent?: ConversionEvent;
  testMode?: boolean;
  enabled?: boolean;
}

export async function upsertPixelConfig(
  db: AppDb,
  storeId: string,
  data: UpsertPixelConfigData,
) {
  const now = new Date().toISOString();
  const existing = await getPixelConfig(db, storeId);

  const accessToken = data.accessToken?.trim() || existing?.accessToken || "";
  const adAccountName =
    data.adAccountName === undefined
      ? existing?.adAccountName ?? null
      : data.adAccountName?.trim() || null;
  const testEventCode =
    data.testEventCode === undefined
      ? existing?.testEventCode ?? null
      : data.testEventCode?.trim() || null;

  if (existing) {
    return db
      .update(storePixelConfig)
      .set({
        pixelId: data.pixelId,
        adAccountName,
        accessToken,
        testEventCode,
        conversionEvent: data.conversionEvent ?? existing.conversionEvent,
        testMode: data.testMode ?? existing.testMode,
        enabled: data.enabled ?? true,
        updatedAt: now,
      })
      .where(eq(storePixelConfig.storeId, storeId))
      .returning()
      .get();
  }

  const row = {
    id: crypto.randomUUID(),
    storeId,
    pixelId: data.pixelId,
    adAccountName,
    accessToken,
    testEventCode,
    conversionEvent: data.conversionEvent ?? "Purchase",
    testMode: data.testMode ?? false,
    enabled: data.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(storePixelConfig).values(row);
  return row;
}
