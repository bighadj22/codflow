/**
 * store_upsell_config queries
 *
 * One row per store; no row = upsell offers disabled at checkout (safe
 * default). Defaults-on apply only once the row exists.
 */

import type { AppDb } from "../db/client";
import { storeUpsellConfig } from "../db/schema";
import { eq } from "drizzle-orm";

export interface UpsellConfig {
  storeId: string;
  showInInlineCheckout: boolean;
  showInConfirmModal: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Safe projection — truth for "are upsell offers shown at checkout". */
export async function getUpsellConfig(db: AppDb, storeId: string): Promise<UpsellConfig | undefined> {
  return db
    .select({
      storeId: storeUpsellConfig.storeId,
      showInInlineCheckout: storeUpsellConfig.showInInlineCheckout,
      showInConfirmModal: storeUpsellConfig.showInConfirmModal,
      createdAt: storeUpsellConfig.createdAt,
      updatedAt: storeUpsellConfig.updatedAt,
    })
    .from(storeUpsellConfig)
    .where(eq(storeUpsellConfig.storeId, storeId))
    .get();
}

export interface UpsertUpsellConfigData {
  showInInlineCheckout?: boolean;
  showInConfirmModal?: boolean;
}

export async function upsertUpsellConfig(
  db: AppDb,
  storeId: string,
  data: UpsertUpsellConfigData,
): Promise<UpsellConfig> {
  const now = new Date().toISOString();
  const showInInlineCheckout = data.showInInlineCheckout ?? true;
  const showInConfirmModal = data.showInConfirmModal ?? true;

  const existing = await db
    .select({ id: storeUpsellConfig.id })
    .from(storeUpsellConfig)
    .where(eq(storeUpsellConfig.storeId, storeId))
    .get();

  if (existing) {
    const row = await db
      .update(storeUpsellConfig)
      .set({ showInInlineCheckout, showInConfirmModal, updatedAt: now })
      .where(eq(storeUpsellConfig.storeId, storeId))
      .returning({
        storeId: storeUpsellConfig.storeId,
        showInInlineCheckout: storeUpsellConfig.showInInlineCheckout,
        showInConfirmModal: storeUpsellConfig.showInConfirmModal,
        createdAt: storeUpsellConfig.createdAt,
        updatedAt: storeUpsellConfig.updatedAt,
      })
      .get();
    return row!;
  }

  const row = {
    id: crypto.randomUUID(),
    storeId,
    showInInlineCheckout,
    showInConfirmModal,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(storeUpsellConfig).values(row);
  return {
    storeId: row.storeId,
    showInInlineCheckout: row.showInInlineCheckout,
    showInConfirmModal: row.showInConfirmModal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}