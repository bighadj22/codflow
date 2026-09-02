/**
 * store_otp_config queries
 *
 * Pixel-config pattern with one addition: the row carries a secret (the
 * dzverify API key), so reads are split — getOtpConfig returns the safe
 * projection for storefront-flag style checks, getOtpConfigRaw returns the
 * full row (including the key) for the send/verify paths that must call the
 * provider. Never return the raw row to a client.
 */

import type { AppDb } from "../db/client";
import { storeOtpConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export interface OtpConfig {
  storeId: string;
  language: "en" | "fr" | "ar";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Safe projection — no API key. Truth for "is verification active". */
export async function getOtpConfig(db: AppDb, storeId: string): Promise<OtpConfig | undefined> {
  const row = await db
    .select({
      storeId: storeOtpConfig.storeId,
      language: storeOtpConfig.language,
      enabled: storeOtpConfig.enabled,
      createdAt: storeOtpConfig.createdAt,
      updatedAt: storeOtpConfig.updatedAt,
    })
    .from(storeOtpConfig)
    .where(eq(storeOtpConfig.storeId, storeId))
    .get();
  return row;
}

/** Full row including the dzverify API key. Server-side callers only. */
export async function getOtpConfigRaw(
  db: AppDb,
  storeId: string
): Promise<typeof storeOtpConfig.$inferSelect | undefined> {
  return db
    .select()
    .from(storeOtpConfig)
    .where(eq(storeOtpConfig.storeId, storeId))
    .get();
}

export interface UpsertOtpConfigData {
  apiKey: string;
  language?: "en" | "fr" | "ar";
  enabled?: boolean;
}

export async function upsertOtpConfig(
  db: AppDb,
  storeId: string,
  data: UpsertOtpConfigData
): Promise<OtpConfig> {
  const now = new Date().toISOString();
  const language = data.language ?? "ar";
  const enabled = data.enabled ?? true;

  const existing = await db
    .select({ id: storeOtpConfig.id })
    .from(storeOtpConfig)
    .where(eq(storeOtpConfig.storeId, storeId))
    .get();

  if (existing) {
    const row = await db
      .update(storeOtpConfig)
      .set({ apiKey: data.apiKey, language, enabled, updatedAt: now })
      .where(eq(storeOtpConfig.storeId, storeId))
      .returning({
        storeId: storeOtpConfig.storeId,
        language: storeOtpConfig.language,
        enabled: storeOtpConfig.enabled,
        createdAt: storeOtpConfig.createdAt,
        updatedAt: storeOtpConfig.updatedAt,
      })
      .get();
    return row;
  }

  const row = {
    id: crypto.randomUUID(),
    storeId,
    apiKey: data.apiKey,
    language,
    enabled,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(storeOtpConfig).values(row);
  const { apiKey: _key, ...safe } = row;
  return safe;
}
