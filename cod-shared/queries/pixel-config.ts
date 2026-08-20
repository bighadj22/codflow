import type { AppDb } from "../db/client";
import { storePixelConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getPixelConfig(db: AppDb, storeId: string) {
  return db
    .select()
    .from(storePixelConfig)
    .where(eq(storePixelConfig.storeId, storeId))
    .get();
}

export interface UpsertPixelConfigData {
  pixelId: string;
  accessToken?: string;
  testEventCode?: string | null;
  enabled?: boolean;
}

export async function upsertPixelConfig(
  db: AppDb,
  storeId: string,
  data: UpsertPixelConfigData,
) {
  const now = new Date().toISOString();
  const existing = await getPixelConfig(db, storeId);

  if (existing) {
    return db
      .update(storePixelConfig)
      .set({
        pixelId: data.pixelId,
        accessToken: data.accessToken ?? "",
        testEventCode: data.testEventCode ?? null,
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
    accessToken: data.accessToken ?? "",
    testEventCode: data.testEventCode ?? null,
    enabled: data.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(storePixelConfig).values(row);
  return row;
}
