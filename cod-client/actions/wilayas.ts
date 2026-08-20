"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import {
  getAllWilayas,
  getCommunesByWilaya,
} from "../../cod-shared/queries/wilayas";
import type { Wilaya, Commune } from "@/types";

/**
 * Get all 58 Algerian wilayas.
 * Reference data — accessible to all authenticated users.
 */
export async function getWilayas(): Promise<Wilaya[]> {
  await requireUser();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllWilayas(db);
}

/**
 * Get all communes for a given wilaya.
 */
export async function getCommunes(wilayaId: number): Promise<Commune[]> {
  await requireUser();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getCommunesByWilaya(db, wilayaId);
}
