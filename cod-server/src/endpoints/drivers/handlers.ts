/**
 * Drivers Route Handlers
 *
 * HTTP handlers for driver management CRUD + per-wilaya compensations.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/**
 * GET /drivers
 * List all drivers with optional filters.
 */
export async function listDrivers(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const filters = validation.driverFiltersSchema.parse({
    wilayaId: c.req.query("wilayaId"),
    status: c.req.query("status"),
    vehicleType: c.req.query("vehicleType"),
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const data = await queries.getAllDrivers(db, filters);
  return c.json({ success: true, data, count: data.length });
}

/**
 * GET /drivers/:id
 * Get a single driver by ID, including recent orders.
 */
export async function getDriver(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("id");

  if (!driverId) {
    throw new ValidationError("Driver ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  const driver = await queries.getDriverById(db, driverId);

  if (!driver) {
    throw new NotFoundError("Driver", driverId);
  }

  return c.json({ success: true, data: driver });
}

/**
 * POST /drivers
 * Create a new driver.
 */
export async function createDriver(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body = validation.createDriverSchema.parse(await c.req.json());
  
  try {
    const driver = await queries.createDriver(db, body);
    console.info(`[drivers] created driver=${driver?.id} name="${body.firstName} ${body.lastName}"`);
    const createActor = c.get("user");
    await logActivity(db, createActor, ACTIONS.DRIVER_CREATED, {
      type: "driver", id: driver!.id, label: `${body.firstName} ${body.lastName}`,
    });
    return c.json({ success: true, data: driver, message: "Driver created successfully" }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return c.json({
        error: error.message,
        code: "DUPLICATE_PHONE",
        category: "BUSINESS_LOGIC",
        context: { phone: body.phone }
      }, 409);
    }
    throw error;
  }
}

/**
 * PATCH /drivers/:id
 * Update driver profile information.
 */
export async function updateDriver(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const body = validation.updateDriverSchema.parse(await c.req.json());
  
  try {
    const driver = await queries.updateDriver(db, id, body);

    if (!driver) {
      throw new NotFoundError("Driver", id);
    }

    console.info(`[drivers] updated driver=${id}`);
    const updateActor = c.get("user");
    await logActivity(db, updateActor, ACTIONS.DRIVER_UPDATED, {
      type: "driver", id, label: `${driver.firstName} ${driver.lastName}`,
    });
    return c.json({ success: true, data: driver, message: "Driver updated successfully" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return c.json({
        error: error.message,
        code: "DUPLICATE_PHONE",
        category: "BUSINESS_LOGIC",
        context: { phone: body.phone }
      }, 409);
    }
    throw error;
  }
}

/**
 * PATCH /drivers/:id/status
 * Update driver availability status.
 */
export async function updateDriverStatus(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const body = validation.updateDriverStatusSchema.parse(await c.req.json());
  const driver = await queries.updateDriverStatus(db, id, body.status);

  if (!driver) {
    throw new NotFoundError("Driver", id);
  }

  const statusActor = c.get("user");
  await logActivity(db, statusActor, ACTIONS.DRIVER_STATUS_CHANGED, {
    type: "driver", id, label: `${driver.firstName} ${driver.lastName}`,
  }, { status: body.status });
  return c.json({ success: true, data: driver, message: "Driver status updated" });
}

/**
 * DELETE /drivers/:id
 * Delete a driver (blocked if they have active orders).
 */
export async function deleteDriver(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getDriverById(db, id);
  if (!existing) {
    throw new NotFoundError("Driver", id);
  }

  // ConflictError thrown here if driver has active orders (handled by global error handler)
  await queries.deleteDriver(db, id);

  const deleteActor = c.get("user");
  await logActivity(db, deleteActor, ACTIONS.DRIVER_DELETED, { type: "driver", id });
  console.info(`[drivers] deleted driver=${id}`);
  return c.json({ success: true, message: "Driver deleted successfully" });
}

// ─── Compensations ────────────────────────────────────────────────────────────

function parseWilayaId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > 58) {
    throw new ValidationError(
      `Invalid wilaya ID "${raw}" — must be an integer 1-58`,
      ERROR_CODES.VALIDATION_FAILED,
      { field: "wilayaId", value: raw }
    );
  }
  return id;
}

/**
 * GET /drivers/:id/compensations
 * Return all 58 wilayas with the driver's configured fee (null if no row).
 */
export async function listCompensations(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("id")!;

  const driver = await queries.getDriverById(db, driverId);
  if (!driver) {
    throw new NotFoundError("Driver", driverId);
  }

  const data = await queries.getCompensationsForDriver(db, driverId);
  return c.json({ success: true, data });
}

/**
 * PUT /drivers/:id/compensations/:wilayaId
 * Upsert the driver's per-delivery fee for one wilaya.
 */
export async function setCompensation(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("id")!;
  const wilayaId = parseWilayaId(c.req.param("wilayaId"));

  const driver = await queries.getDriverById(db, driverId);
  if (!driver) {
    throw new NotFoundError("Driver", driverId);
  }

  const body = validation.setCompensationSchema.parse(await c.req.json());
  const row = await queries.setCompensation(db, driverId, wilayaId, body.feePerDelivery);

  const actor = c.get("user");
  await logActivity(
    db,
    actor,
    ACTIONS.DRIVER_UPDATED,
    { type: "driver", id: driverId, label: `${driver.firstName} ${driver.lastName}` },
    { wilayaId, feePerDelivery: body.feePerDelivery }
  );

  return c.json({ success: true, data: row, message: "Compensation saved" });
}

/**
 * DELETE /drivers/:id/compensations/:wilayaId
 * Remove the driver's compensation row for one wilaya.
 * Returns 404 if no row existed.
 */
export async function deleteCompensation(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("id")!;
  const wilayaId = parseWilayaId(c.req.param("wilayaId"));

  const driver = await queries.getDriverById(db, driverId);
  if (!driver) {
    throw new NotFoundError("Driver", driverId);
  }

  const deleted = await queries.deleteCompensation(db, driverId, wilayaId);
  if (!deleted) {
    throw new NotFoundError("Driver compensation", `driver=${driverId} wilaya=${wilayaId}`);
  }

  const actor = c.get("user");
  await logActivity(
    db,
    actor,
    ACTIONS.DRIVER_UPDATED,
    { type: "driver", id: driverId, label: `${driver.firstName} ${driver.lastName}` },
    { wilayaId, removed: true }
  );

  return c.json({ success: true, message: "Compensation removed" });
}
