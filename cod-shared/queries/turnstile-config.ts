/**
 * store_turnstile_config queries
 *
 * Pixel-config pattern with one addition: the row carries a secret (the
 * Turnstile siteverify secret key), so reads are split — getTurnstileConfig
 * returns the safe projection (siteKey is public by design; the secret is
 * excluded) for storefront-flag style checks, getTurnstileConfigRaw returns
 * the full row for the server-side siteverify path. Never return the raw row
 * to a client.
 *
 * Upsert requires both keys explicitly (mirroring upsertOtpConfig): the
 * "empty secret keeps the stored one" rule is resolved by the caller (the
 * merchant settings handler) which reads the raw row first and passes the
 * stored secret through — the secret never round-trips to any client.
 */

import type { AppDb } from "../db/client";
import { storeTurnstileConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export interface TurnstileConfig {
  storeId: string;
  siteKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Safe projection — no secret key. Truth for "is Turnstile active". */
export async function getTurnstileConfig(
  db: AppDb,
  storeId: string
): Promise<TurnstileConfig | undefined> {
  const row = await db
    .select({
      storeId: storeTurnstileConfig.storeId,
      siteKey: storeTurnstileConfig.siteKey,
      enabled: storeTurnstileConfig.enabled,
      createdAt: storeTurnstileConfig.createdAt,
      updatedAt: storeTurnstileConfig.updatedAt,
    })
    .from(storeTurnstileConfig)
    .where(eq(storeTurnstileConfig.storeId, storeId))
    .get();
  return row;
}

/** Full row including the siteverify secret. Server-side callers only. */
export async function getTurnstileConfigRaw(
  db: AppDb,
  storeId: string
): Promise<typeof storeTurnstileConfig.$inferSelect | undefined> {
  return db
    .select()
    .from(storeTurnstileConfig)
    .where(eq(storeTurnstileConfig.storeId, storeId))
    .get();
}

export interface UpsertTurnstileConfigData {
  siteKey: string;
  /** Server-side siteverify secret. Required — callers resolving "keep stored" pass the stored value. */
  secretKey: string;
  enabled?: boolean;
}

export async function upsertTurnstileConfig(
  db: AppDb,
  storeId: string,
  data: UpsertTurnstileConfigData
): Promise<TurnstileConfig> {
  const now = new Date().toISOString();
  const enabled = data.enabled ?? true;

  const existing = await db
    .select({ id: storeTurnstileConfig.id })
    .from(storeTurnstileConfig)
    .where(eq(storeTurnstileConfig.storeId, storeId))
    .get();

  if (existing) {
    const row = await db
      .update(storeTurnstileConfig)
      .set({ siteKey: data.siteKey, secretKey: data.secretKey, enabled, updatedAt: now })
      .where(eq(storeTurnstileConfig.storeId, storeId))
      .returning({
        storeId: storeTurnstileConfig.storeId,
        siteKey: storeTurnstileConfig.siteKey,
        enabled: storeTurnstileConfig.enabled,
        createdAt: storeTurnstileConfig.createdAt,
        updatedAt: storeTurnstileConfig.updatedAt,
      })
      .get();
    return row;
  }

  const row = {
    id: crypto.randomUUID(),
    storeId,
    siteKey: data.siteKey,
    secretKey: data.secretKey,
    enabled,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(storeTurnstileConfig).values(row);
  const { secretKey: _secret, ...safe } = row;
  return safe;
}
