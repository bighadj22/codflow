/**
 * Drivers Queries
 *
 * Drivers are not linked to shipping profiles (those define customer pricing).
 * Per-wilaya driver pay is stored in `driver_compensations` — sparse: a missing
 * row means the store has not configured pay for this driver in that wilaya
 * (assignment still works at driverFee = 0).
 *
 * deleteDriver stays in cod-server because it raises ConflictError.
 */

import { eq, and, like, or, count, sql, desc, exists, inArray } from "drizzle-orm";
import { drivers, driverCompensations, wilayas, orders } from "../db/schema";
import type { AppDb } from "../db/client";
import { safeLikeTerm } from "./search";

export interface DriverFilters {
  wilayaId?: number;
  status?: "available" | "busy" | "inactive";
  vehicleType?: "motorcycle" | "car" | "van";
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateDriverData {
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  vehicleType?: "motorcycle" | "car" | "van" | null;
  status: "available" | "busy" | "inactive";
  notes?: string | null;
}

export interface UpdateDriverData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  phone2?: string | null;
  vehicleType?: "motorcycle" | "car" | "van" | null;
  notes?: string | null;
}

export async function getAllDrivers(db: AppDb, filters?: DriverFilters) {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(drivers.status, filters.status));
  }

  if (filters?.vehicleType) {
    conditions.push(eq(drivers.vehicleType, filters.vehicleType));
  }

  if (filters?.search) {
    const term = `%${safeLikeTerm(filters.search)}%`;
    conditions.push(
      or(
        like(drivers.firstName, term),
        like(drivers.lastName, term),
        like(drivers.phone, term),
      ),
    );
  }

  if (filters?.wilayaId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(driverCompensations)
          .where(
            and(
              eq(driverCompensations.driverId, drivers.id),
              eq(driverCompensations.wilayaId, filters.wilayaId),
            ),
          ),
      ),
    );
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const driverRows = await (conditions.length > 0
    ? db.select().from(drivers).where(and(...conditions)).limit(limit).offset(offset).all()
    : db.select().from(drivers).limit(limit).offset(offset).all());

  if (driverRows.length === 0) return [];

  const compRows = await db
    .select({ driverId: driverCompensations.driverId, c: count() })
    .from(driverCompensations)
    .where(inArray(driverCompensations.driverId, driverRows.map((d) => d.id)))
    .groupBy(driverCompensations.driverId)
    .all();

  const compCountMap = new Map(compRows.map((r) => [r.driverId, r.c]));

  return driverRows.map((d) => ({
    ...d,
    compensationWilayaCount: compCountMap.get(d.id) ?? 0,
  }));
}

export async function getDriverById(db: AppDb, driverId: string) {
  const driver = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .get();

  if (!driver) return null;

  const compStats = await db
    .select({
      c: count(),
      totalFee: sql<number>`coalesce(sum(${driverCompensations.feePerDelivery}), 0)`,
    })
    .from(driverCompensations)
    .where(eq(driverCompensations.driverId, driverId))
    .get();

  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.driverId, driverId))
    .orderBy(desc(orders.updatedAt))
    .limit(10)
    .all();

  return {
    ...driver,
    compensationWilayaCount: compStats?.c ?? 0,
    recentOrders,
  };
}

export async function createDriver(db: AppDb, data: CreateDriverData) {
  // Check for duplicate phone number
  const existingDriver = await db
    .select({ id: drivers.id, phone: drivers.phone })
    .from(drivers)
    .where(eq(drivers.phone, data.phone))
    .get();

  if (existingDriver) {
    throw new Error(`Driver with phone "${data.phone}" already exists`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(drivers).values({
    id,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    phone2: data.phone2 ?? null,
    vehicleType: data.vehicleType ?? null,
    status: data.status,
    totalDelivered: 0,
    totalEarnings: 0,
    pendingCash: 0,
    totalPaid: 0,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return getDriverById(db, id);
}

export async function updateDriver(db: AppDb, driverId: string, data: UpdateDriverData) {
  const existing = await getDriverById(db, driverId);
  if (!existing) return null;

  // Check for duplicate phone if phone is being updated
  if (data.phone && data.phone !== existing.phone) {
    const duplicateDriver = await db
      .select({ id: drivers.id, phone: drivers.phone })
      .from(drivers)
      .where(eq(drivers.phone, data.phone))
      .get();

    if (duplicateDriver) {
      throw new Error(`Driver with phone "${data.phone}" already exists`);
    }
  }

  const now = new Date().toISOString();

  await db
    .update(drivers)
    .set({ ...data, updatedAt: now })
    .where(eq(drivers.id, driverId));

  return getDriverById(db, driverId);
}

export async function updateDriverStatus(
  db: AppDb,
  driverId: string,
  status: "available" | "busy" | "inactive",
) {
  const existing = await getDriverById(db, driverId);
  if (!existing) return null;

  await db
    .update(drivers)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(drivers.id, driverId));

  return getDriverById(db, driverId);
}

// ─── Compensations ────────────────────────────────────────────────────────────

export interface DriverCompensationRow {
  wilayaId: number;
  wilayaName: string;
  wilayaNameAr: string;
  /** Null when the driver has no compensation row for this wilaya. */
  feePerDelivery: number | null;
}

/**
 * Return all 58 wilayas with the driver's configured fee (null when no row exists).
 * This is the shape the admin grid needs — always 58 rows, sparse overlay.
 */
export async function getCompensationsForDriver(
  db: AppDb,
  driverId: string,
): Promise<DriverCompensationRow[]> {
  const allWilayas = await db
    .select({ id: wilayas.id, name: wilayas.name, nameAr: wilayas.nameAr })
    .from(wilayas)
    .orderBy(wilayas.id)
    .all();

  const rows = await db
    .select()
    .from(driverCompensations)
    .where(eq(driverCompensations.driverId, driverId))
    .all();

  const feeMap = new Map(rows.map((r) => [r.wilayaId, r.feePerDelivery]));

  return allWilayas.map((w) => ({
    wilayaId: w.id,
    wilayaName: w.name,
    wilayaNameAr: w.nameAr,
    feePerDelivery: feeMap.has(w.id) ? feeMap.get(w.id)! : null,
  }));
}

export async function setCompensation(
  db: AppDb,
  driverId: string,
  wilayaId: number,
  feePerDelivery: number,
) {
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(driverCompensations)
    .where(
      and(
        eq(driverCompensations.driverId, driverId),
        eq(driverCompensations.wilayaId, wilayaId),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(driverCompensations)
      .set({ feePerDelivery, updatedAt: now })
      .where(eq(driverCompensations.id, existing.id));
  } else {
    await db.insert(driverCompensations).values({
      id: crypto.randomUUID(),
      driverId,
      wilayaId,
      feePerDelivery,
      createdAt: now,
      updatedAt: now,
    });
  }

  return db
    .select()
    .from(driverCompensations)
    .where(
      and(
        eq(driverCompensations.driverId, driverId),
        eq(driverCompensations.wilayaId, wilayaId),
      ),
    )
    .get();
}

export async function deleteCompensation(
  db: AppDb,
  driverId: string,
  wilayaId: number,
): Promise<boolean> {
  const existing = await db
    .select({ id: driverCompensations.id })
    .from(driverCompensations)
    .where(
      and(
        eq(driverCompensations.driverId, driverId),
        eq(driverCompensations.wilayaId, wilayaId),
      ),
    )
    .get();

  if (!existing) return false;

  await db.delete(driverCompensations).where(eq(driverCompensations.id, existing.id));
  return true;
}
