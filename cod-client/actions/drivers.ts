"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllDrivers,
  getDriverById,
  getCompensationsForDriver,
} from "@/../cod-shared/queries/drivers";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { Driver, DriverCompensation } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

export type DriverStatus = "available" | "busy" | "inactive";
export type VehicleType = "motorcycle" | "car" | "van";

interface CreateDriverData {
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  vehicleType?: VehicleType | null;
  status?: DriverStatus;
  notes?: string | null;
}

type UpdateDriverData = Partial<CreateDriverData>;

interface DriverFilters {
  wilayaId?: number;
  status?: DriverStatus;
  vehicleType?: VehicleType;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all drivers.
 */
export async function getDrivers(filters?: DriverFilters): Promise<Driver[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllDrivers(db, filters);
  return rows as unknown as Driver[];
}

/**
 * Get a single driver by ID.
 */
export async function getDriver(id: string): Promise<Driver | null> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const row = await getDriverById(db, id);
  return (row as unknown as Driver | null) ?? null;
}

/**
 * Create a new driver.
 */
export async function createDriver(data: CreateDriverData): Promise<Driver> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<Driver>>("/api/drivers", apiKey, data);

    if (!response.data) throw new Error("No driver data returned from API");

    revalidatePath("/delivery");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Drivers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Update driver information.
 */
export async function updateDriver(id: string, data: UpdateDriverData): Promise<Driver> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<Driver>>(
      `/api/drivers/${id}`,
      apiKey,
      data
    );

    if (!response.data) throw new Error("No driver data returned from API");

    revalidatePath("/delivery");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Drivers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        driverId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Update driver availability status.
 */
export async function updateDriverStatus(id: string, status: DriverStatus): Promise<Driver> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<Driver>>(
      `/api/drivers/${id}/status`,
      apiKey,
      { status }
    );

    if (!response.data) throw new Error("No driver data returned from API");

    revalidatePath("/delivery");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Drivers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        driverId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

// ─── Driver Compensations ─────────────────────────────────────────────────────
//
// Per-wilaya payroll rows: feePerDelivery for the (driverId, wilayaId) pair.
// Used by the order assignment flow to set orders.driverFee.

/**
 * List the driver's configured per-wilaya compensation rows.
 *
 * The server returns a sparse overlay of all 58 wilayas with `feePerDelivery`
 * null for unconfigured rows. Callers want the "configured rows only" view,
 * so we drop the nulls here.
 */
interface RawCompensationRow {
  wilayaId: number;
  wilayaName?: string;
  wilayaNameAr?: string;
  feePerDelivery: number | null;
}

export async function getDriverCompensations(driverId: string): Promise<DriverCompensation[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getCompensationsForDriver(db, driverId);
  return rows.filter((row) => row.feePerDelivery !== null) as unknown as DriverCompensation[];
}

/**
 * Upsert a per-wilaya compensation row. Used by the driver detail UI.
 */
export async function setDriverCompensation(
  driverId: string,
  wilayaId: number,
  feePerDelivery: number,
): Promise<DriverCompensation> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.put<ApiResponse<DriverCompensation>>(
      `/api/drivers/${driverId}/compensations/${wilayaId}`,
      apiKey,
      { feePerDelivery },
    );
    if (!response.data) throw new Error("No compensation returned from API");
    revalidatePath(`/delivery/drivers/${driverId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      throw new Error(mapError(error.code, locale, error.context));
    }
    throw error;
  }
}

/**
 * Remove a per-wilaya compensation row. Future assignments in that wilaya
 * compute driverFee = 0 until the row is set again.
 */
export async function deleteDriverCompensation(
  driverId: string,
  wilayaId: number,
): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(
      `/api/drivers/${driverId}/compensations/${wilayaId}`,
      apiKey,
    );
    revalidatePath(`/delivery/drivers/${driverId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      throw new Error(mapError(error.code, locale, error.context));
    }
    throw error;
  }
}

/**
 * Delete a driver.
 */
export async function deleteDriver(id: string): Promise<void> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(`/api/drivers/${id}`, apiKey);
    revalidatePath("/delivery");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Drivers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        driverId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
