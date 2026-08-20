/**
 * Delivery Companies Queries
 *
 * CRUD operations for third-party delivery company management.
 */

import { eq, and, like, desc, count, notInArray } from "drizzle-orm";
import { deliveryCompanies, orders } from "../db/schema";
import type { AppDb } from "../db/client";

export interface DeliveryCompanyFilters {
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateDeliveryCompanyData {
  name: string;
  nameAr: string;
  code: string;
  website?: string | null;
  active: boolean;
  apiEndpoint?: string | null;
  apiToken?: string | null;
  apiUserGuid?: string | null;
  supportsHomeDelivery: boolean;
  supportsStopDesk: boolean;
  supportsTracking: boolean;
  /** When omitted, the DB default (true) applies. Provider-specific defaults live at the HTTP handler. */
  autoValidate?: boolean;
  notes?: string | null;
}

export interface UpdateDeliveryCompanyData {
  name?: string;
  nameAr?: string;
  code?: string;
  website?: string | null;
  active?: boolean;
  apiEndpoint?: string | null;
  apiToken?: string | null;
  apiUserGuid?: string | null;
  supportsHomeDelivery?: boolean;
  supportsStopDesk?: boolean;
  supportsTracking?: boolean;
  autoValidate?: boolean;
  notes?: string | null;
}

/**
 * Strip secret credential fields from a company record before returning it
 * in any API response. Replaces apiToken/apiUserGuid with a boolean isConnected.
 */
function sanitize(company: typeof deliveryCompanies.$inferSelect) {
  const { apiToken, apiUserGuid, ...safe } = company;
  return { ...safe, isConnected: !!apiToken };
}

export async function getAllDeliveryCompanies(
  db: AppDb,
  filters?: DeliveryCompanyFilters,
) {
  const conditions = [];

  if (filters?.active !== undefined) {
    conditions.push(eq(deliveryCompanies.active, filters.active));
  }

  if (filters?.search) {
    conditions.push(like(deliveryCompanies.name, `%${filters.search}%`));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  let query = db.select().from(deliveryCompanies);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query
    .orderBy(desc(deliveryCompanies.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  return rows.map(sanitize);
}

export async function getDeliveryCompanyById(db: AppDb, id: string) {
  const row = await db
    .select()
    .from(deliveryCompanies)
    .where(eq(deliveryCompanies.id, id))
    .get();
  return row ? sanitize(row) : null;
}

export async function getDeliveryCompanyByCode(db: AppDb, code: string) {
  return await db
    .select()
    .from(deliveryCompanies)
    .where(eq(deliveryCompanies.code, code))
    .get();
}

/**
 * Internal: get raw company record including credentials. Used by providers/handlers
 * that need to make outbound API calls. Never returned to clients.
 */
export async function getDeliveryCompanyRaw(db: AppDb, id: string) {
  return await db
    .select()
    .from(deliveryCompanies)
    .where(eq(deliveryCompanies.id, id))
    .get();
}

export async function createDeliveryCompany(
  db: AppDb,
  data: CreateDeliveryCompanyData,
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(deliveryCompanies).values({
    id,
    name: data.name,
    nameAr: data.nameAr,
    code: data.code,
    website: data.website ?? null,
    active: data.active,
    apiEndpoint: data.apiEndpoint ?? null,
    apiToken: data.apiToken ?? null,
    apiUserGuid: data.apiUserGuid ?? null,
    supportsHomeDelivery: data.supportsHomeDelivery,
    supportsStopDesk: data.supportsStopDesk,
    supportsTracking: data.supportsTracking,
    // Only forward autoValidate when the caller supplied a value — otherwise
    // fall through to the DB column default (true). Keeps behavior symmetric
    // with all other optional columns in this insert.
    ...(data.autoValidate !== undefined ? { autoValidate: data.autoValidate } : {}),
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return getDeliveryCompanyById(db, id);
}

export async function updateDeliveryCompany(
  db: AppDb,
  id: string,
  data: UpdateDeliveryCompanyData,
) {
  const existing = await getDeliveryCompanyById(db, id);
  if (!existing) return null;

  const now = new Date().toISOString();

  await db
    .update(deliveryCompanies)
    .set({ ...data, updatedAt: now })
    .where(eq(deliveryCompanies.id, id));

  return getDeliveryCompanyById(db, id);
}

/**
 * Delete a delivery company by ID.
 * Throws if the company has active (non-terminal) orders assigned to it.
 */
export async function deleteDeliveryCompany(db: AppDb, id: string) {
  const liveOrders = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.companyId, id),
        notInArray(orders.status, ["delivered", "returned", "cancelled"]),
      ),
    )
    .get();

  if (liveOrders && liveOrders.count > 0) {
    throw new Error(
      `Cannot delete — this company has ${liveOrders.count} active order(s). Complete or reassign them first.`,
    );
  }

  await db.delete(deliveryCompanies).where(eq(deliveryCompanies.id, id));
  return true;
}
