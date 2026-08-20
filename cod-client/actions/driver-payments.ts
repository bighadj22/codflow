"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getDriverPayments as getDriverPaymentsQuery,
  getPendingSettlementOrders as getPendingSettlementOrdersQuery,
} from "@/../cod-shared/queries/driver-payments";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { DriverPayment, DriverPaymentType, Order } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
}

interface CreatePaymentData {
  driverId: string;
  type: DriverPaymentType;
  orderIds: string[];
  notes?: string;
}

/**
 * Create a driver payment record and settle the selected orders.
 */
export async function createDriverPayment(data: CreatePaymentData): Promise<DriverPayment> {
  await requirePermission(SCOPES.DELIVERY_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<DriverPayment>>(
      "/api/driver-payments",
      apiKey,
      data
    );

    if (!response.data) throw new Error("No payment data returned");

    revalidatePath("/delivery");
    revalidatePath(`/delivery/drivers/${data.driverId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Driver Payments Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        driverId: data.driverId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Get all payment records for a driver.
 */
export async function getDriverPayments(driverId: string): Promise<DriverPayment[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getDriverPaymentsQuery(db, driverId);
  return rows as unknown as DriverPayment[];
}

/**
 * Get delivered, unsettled orders for a driver (for pre-settlement review).
 */
export async function getPendingSettlementOrders(driverId: string): Promise<Order[]> {
  await requirePermission(SCOPES.DELIVERY_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getPendingSettlementOrdersQuery(db, driverId);
  return rows as unknown as Order[];
}
