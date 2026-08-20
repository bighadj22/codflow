/**
 * Wilayas + Communes Queries
 *
 * Read-only reference data for Algeria's 58 wilayas and their communes.
 * Consumed by cod-server handlers and cod-client server components.
 */

import { eq, like, asc, or } from "drizzle-orm";
import { wilayas, communes } from "../db/schema";
import type { AppDb } from "../db/client";

export interface WilayaFilters {
  search?: string;
}

export async function getAllWilayas(db: AppDb, filters?: WilayaFilters) {
  if (filters?.search) {
    return await db
      .select()
      .from(wilayas)
      .where(or(like(wilayas.name, `%${filters.search}%`), like(wilayas.nameAr, `%${filters.search}%`)))
      .orderBy(asc(wilayas.id))
      .all();
  }

  return await db.select().from(wilayas).orderBy(asc(wilayas.id)).all();
}

export async function getWilayaById(db: AppDb, id: number) {
  return await db.select().from(wilayas).where(eq(wilayas.id, id)).get();
}

export async function getCommunesByWilaya(db: AppDb, wilayaId: number) {
  return await db
    .select()
    .from(communes)
    .where(eq(communes.wilayaId, wilayaId))
    .orderBy(asc(communes.name))
    .all();
}
