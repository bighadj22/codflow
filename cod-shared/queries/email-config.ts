/**
 * store_email_config queries
 *
 * Otp-config pattern verbatim: the row carries a secret (the Sendili API
 * key), so reads are split — getEmailConfig returns the safe projection for
 * feature-flag style checks, getEmailConfigRaw returns the full row
 * (including the key) for the send paths that must call the provider.
 * Never return the raw row to a client.
 */

import type { AppDb } from "../db/client";
import { storeEmailConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export interface EmailConfig {
  storeId: string;
  fromEmail: string;
  fromName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Safe projection — no API key. Truth for "is email sending active". */
export async function getEmailConfig(db: AppDb, storeId: string): Promise<EmailConfig | undefined> {
  const row = await db
    .select({
      storeId: storeEmailConfig.storeId,
      fromEmail: storeEmailConfig.fromEmail,
      fromName: storeEmailConfig.fromName,
      enabled: storeEmailConfig.enabled,
      createdAt: storeEmailConfig.createdAt,
      updatedAt: storeEmailConfig.updatedAt,
    })
    .from(storeEmailConfig)
    .where(eq(storeEmailConfig.storeId, storeId))
    .get();
  return row;
}

/** Full row including the Sendili API key. Server-side callers only. */
export async function getEmailConfigRaw(
  db: AppDb,
  storeId: string
): Promise<typeof storeEmailConfig.$inferSelect | undefined> {
  return db
    .select()
    .from(storeEmailConfig)
    .where(eq(storeEmailConfig.storeId, storeId))
    .get();
}

export interface UpsertEmailConfigData {
  apiKey: string;
  /** Sender address whose domain is verified in the Sendili workspace. */
  fromEmail: string;
  /** Optional display name. Omitted/null clears it. */
  fromName?: string | null;
  enabled?: boolean;
}

export async function upsertEmailConfig(
  db: AppDb,
  storeId: string,
  data: UpsertEmailConfigData
): Promise<EmailConfig> {
  const now = new Date().toISOString();
  const fromName = data.fromName ?? null;
  const enabled = data.enabled ?? true;

  const existing = await db
    .select({ id: storeEmailConfig.id })
    .from(storeEmailConfig)
    .where(eq(storeEmailConfig.storeId, storeId))
    .get();

  if (existing) {
    const row = await db
      .update(storeEmailConfig)
      .set({ apiKey: data.apiKey, fromEmail: data.fromEmail, fromName, enabled, updatedAt: now })
      .where(eq(storeEmailConfig.storeId, storeId))
      .returning({
        storeId: storeEmailConfig.storeId,
        fromEmail: storeEmailConfig.fromEmail,
        fromName: storeEmailConfig.fromName,
        enabled: storeEmailConfig.enabled,
        createdAt: storeEmailConfig.createdAt,
        updatedAt: storeEmailConfig.updatedAt,
      })
      .get();
    return row;
  }

  const row = {
    id: crypto.randomUUID(),
    storeId,
    apiKey: data.apiKey,
    fromEmail: data.fromEmail,
    fromName,
    enabled,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(storeEmailConfig).values(row);
  const { apiKey: _key, ...safe } = row;
  return safe;
}
