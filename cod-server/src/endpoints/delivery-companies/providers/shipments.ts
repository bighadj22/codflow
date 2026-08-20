/**
 * Provider Shipment & API Log Queries
 *
 * DB operations for company_shipments and company_api_logs.
 * Called from the dispatch handler after each outbound API call.
 */

import { AppDb } from "@/db";
import { companyShipments, companyApiLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// ─── Shipments ────────────────────────────────────────────────────────────────

export async function createShipmentRecord(
  db: AppDb,
  data: {
    orderId: string;
    companyId: string;
    trackingNumber: string;
    labelUrl?: string;
    rawResponse: unknown;
  }
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(companyShipments).values({
    id,
    orderId: data.orderId,
    companyId: data.companyId,
    trackingNumber: data.trackingNumber,
    validated: false,
    labelUrl: data.labelUrl ?? null,
    rawResponse: JSON.stringify(data.rawResponse),
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

/**
 * Mark a shipment record as validated by the carrier (or un-validate it on cancel).
 * Shipment lifecycle (created, cancelled, delivered, etc.) lives on orders.status —
 * the shipment row only tracks whether the carrier has confirmed pickup.
 */
export async function setShipmentValidated(
  db: AppDb,
  shipmentId: string,
  validated: boolean,
) {
  await db
    .update(companyShipments)
    .set({
      validated,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(companyShipments.id, shipmentId));
}

export async function getShipmentByOrder(db: AppDb, orderId: string) {
  return await db
    .select()
    .from(companyShipments)
    .where(eq(companyShipments.orderId, orderId))
    .orderBy(desc(companyShipments.createdAt))
    .get();
}

// ─── API Logs ─────────────────────────────────────────────────────────────────

export async function logApiCall(
  db: AppDb,
  data: {
    companyId: string;
    orderId?: string | null;
    action: string;
    method: string;
    endpoint: string;
    requestBody?: unknown;
    httpStatus?: number;
    responseBody?: unknown;
    success: boolean;
    errorMessage?: string | null;
    durationMs?: number;
  }
) {
  await db.insert(companyApiLogs).values({
    id: crypto.randomUUID(),
    companyId: data.companyId,
    orderId: data.orderId ?? null,
    action: data.action,
    method: data.method,
    endpoint: data.endpoint,
    requestBody: data.requestBody ? JSON.stringify(data.requestBody) : null,
    httpStatus: data.httpStatus ?? null,
    responseBody: data.responseBody ? JSON.stringify(data.responseBody) : null,
    success: data.success,
    errorMessage: data.errorMessage ?? null,
    durationMs: data.durationMs ?? null,
    createdAt: new Date().toISOString(),
  });
}
