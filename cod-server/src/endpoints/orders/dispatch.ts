/**
 * Orders Carrier Dispatch Operations
 * 
 * Handles dispatching orders to delivery company APIs (NOEST, ZR Express, Yalidine, EcoTrack).
 * Includes single dispatch, bulk dispatch, and manual validation.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { wilayas, communes } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { getProvider, isEcotrackCompany } from "@/endpoints/delivery-companies/providers/registry";
import { getDeliveryCompanyRaw } from "@/endpoints/delivery-companies/queries";
import { createShipmentRecord, setShipmentValidated, getShipmentByOrder, logApiCall } from "@/endpoints/delivery-companies/providers/shipments";
import { NotFoundError, BusinessLogicError, ValidationError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

// Sentinel persisted in companyShipments.labelUrl when the carrier returns no
// label URL at create time but exposes one via a separate API (ZR Express:
// time-limited SAS). The UI treats labelUrl as a boolean "label available"
// flag; proxyShipmentLabel re-resolves the real URL on each click.
export const DEFERRED_LABEL_MARKER = "deferred";

/**
 * POST /orders/:id/dispatch
 * Dispatch order to the assigned delivery company via its API.
 * Creates a shipment, records tracking number, logs the API call.
 * Requires DELIVERY_DISPATCH scope.
 */
export async function dispatchToCompany(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  // Load order
  const order = await queries.getOrderById(db, orderId);
  if (!order) {
    throw new NotFoundError("Order", orderId);
  }

  // Business rule: can't dispatch an already-dispatched order.
  if (order.trackingNumber) {
    throw new BusinessLogicError(
      `Order already dispatched — tracking number: ${order.trackingNumber}`,
      ERROR_CODES.ORDER_ALREADY_DISPATCHED,
      { orderId, trackingNumber: order.trackingNumber }
    );
  }

  // Business rule: delivery methods are mutually exclusive.
  // If a driver is already assigned for manual delivery, block company dispatch.
  if (order.driverId && order.deliveryMethod === "driver") {
    // Get driver name for context
    const driverName = order.driverName || "Unknown Driver";
    throw new BusinessLogicError(
      `Order is assigned to a driver for manual delivery. Remove the driver assignment first.`,
      ERROR_CODES.DRIVER_ALREADY_ASSIGNED,
      { orderId, driverId: order.driverId, driverName }
    );
  }

  // Optional body overrides — parse early so companyId can be used
  const body = await c.req.json().catch(() => ({})) as Record<string, string>;
  const bodyCompanyId = body.companyId?.trim() || null;

  // Use companyId from body if provided, otherwise fall back to order's existing value
  const effectiveCompanyId = bodyCompanyId ?? order.companyId;
  if (!effectiveCompanyId) {
    throw new ValidationError("Select a delivery company to dispatch", ERROR_CODES.REQUIRED_FIELD_MISSING);
  }

  // Load raw company (includes credentials needed by getProvider) - CHECK BEFORE ASSIGNING
  const company = await getDeliveryCompanyRaw(db, effectiveCompanyId);
  if (!company) {
    throw new NotFoundError("Delivery company", effectiveCompanyId);
  }
  if (!company.active) {
    throw new BusinessLogicError("Delivery company is inactive", ERROR_CODES.COMPANY_INACTIVE, { companyId: effectiveCompanyId });
  }

  // If a new companyId was supplied, persist it on the order before dispatching
  if (bodyCompanyId && bodyCompanyId !== order.companyId) {
    await queries.assignCompany(db, orderId, bodyCompanyId);
  }

  if (!order.wilayaId || !order.communeId) {
    throw new ValidationError(
      "Order must have wilaya and commune selected before dispatching",
      ERROR_CODES.MISSING_WILAYA_COMMUNE,
      { orderId }
    );
  }

  // Resolve French names from reference tables — used by both NOEST (commune text) and ZR Express (territory search keyword).
  const [wilayaRow, communeRow] = await Promise.all([
    db.select({ name: wilayas.name }).from(wilayas).where(eq(wilayas.id, order.wilayaId)).get(),
    db.select({ name: communes.name }).from(communes).where(eq(communes.id, order.communeId)).get(),
  ]);

  if (!wilayaRow || !communeRow) {
    throw new ValidationError("Wilaya or commune not found in reference tables", ERROR_CODES.MISSING_WILAYA_COMMUNE);
  }

  // station_code: prefer stored value on the order; allow request body to override.
  const stationCode = body.stationCode?.trim() || order.stationCode || undefined;
  const remarks = body.remarks;
  const weight   = body.weight   != null ? Number(body.weight)   : (order.weight   ?? undefined);
  // body.fragile arrives as a JS boolean from c.req.json(); the surrounding
  // `as Record<string, string>` cast is a lie — read through unknown to compare safely.
  const fragileRaw = (body as Record<string, unknown>).fragile;
  const isFragile = fragileRaw != null
    ? fragileRaw === true || fragileRaw === "true" || fragileRaw === "1"
    : (order.isFragile ?? undefined);

  // Stop-desk orders must have a station code — required by all providers.
  if (order.deliveryType === "stop_desk" && !stationCode) {
    throw new ValidationError(
      "Stop-desk orders require a station code. Select a pickup-point station before dispatching.",
      ERROR_CODES.MISSING_STATION_CODE,
      { orderId, deliveryType: order.deliveryType }
    );
  }

  // Get provider adapter (throws if unsupported or missing credentials)
  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(
      err instanceof Error ? err.message : "Provider not available",
      ERROR_CODES.PROVIDER_NOT_SUPPORTED,
      { companyId: effectiveCompanyId, provider: company.code }
    );
  }

  // Resolve the actual API endpoint path for audit logging — per-provider.
  const dispatchEndpoint: Record<string, string> = {
    noest: "/api/public/create/order",
    zr_express: "/api/v1/parcels",
    yalidine: "/v1/parcels/",
  };
  const logEndpoint = isEcotrackCompany(company.code)
    ? "/api/v1/create/order"
    : (dispatchEndpoint[company.code] ?? `${company.apiEndpoint ?? ""}/create`);

  const startMs = Date.now();
  try {
    // Build product description: unique product names joined, append order number
    const uniqueProductNames = [...new Set((order.products ?? []).map((p) => p.productName).filter(Boolean))];
    const productDescription = uniqueProductNames.length > 0
      ? `${uniqueProductNames.join(", ")} — ${order.orderNumber}`
      : order.orderNumber;

    const result = await provider.createShipment({
      orderId: order.id,
      customerName: order.customerName,
      phone: order.phone,
      address: order.address ?? "",
      wilayaId: order.wilayaId,
      wilaya: wilayaRow.name,
      commune: communeRow.name,
      amount: order.price,
      productDescription,
      stopDesk: order.deliveryType === "stop_desk",
      stationCode,
      reference: order.orderNumber,
      remarks: remarks ?? order.notes ?? undefined,
      weight,
      fragile: isFragile,
    });

    const durationMs = Date.now() - startMs;

    const persistedLabelUrl = result.labelUrl
      ?? (company.code === "zr_express" ? DEFERRED_LABEL_MARKER : undefined);

    const shipmentId = await createShipmentRecord(db, {
      orderId: order.id,
      companyId: company.id,
      trackingNumber: result.trackingNumber,
      labelUrl: persistedLabelUrl,
      rawResponse: result.rawResponse,
    });

    await queries.updateOrderTracking(db, order.id, result.trackingNumber);

    const dispatchUser = c.get("user");
    const PRE_DISPATCH_STATUSES = ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "dispatched"];

    await logApiCall(db, {
      companyId: company.id,
      orderId: order.id,
      action: "create_shipment",
      method: "POST",
      endpoint: logEndpoint,
      httpStatus: 200,
      responseBody: result.rawResponse,
      success: true,
      durationMs,
    });

    if (company.autoValidate) {
      // Auto-validate path: call valid/order immediately, advance to out_for_delivery.
      const validateEndpoint: Record<string, string> = {
        noest: "/api/public/valid/order",
        zr_express: "(auto)",
      };
      const resolveValidateEndpoint = (code: string) =>
        isEcotrackCompany(code) ? "/api/v1/valid/order" : (validateEndpoint[code] ?? "/validate");
      const validateStart = Date.now();
      try {
        const validated = await provider.validateShipment(result.trackingNumber);
        if (validated) {
          await setShipmentValidated(db, shipmentId, true);
          await logApiCall(db, {
            companyId: company.id,
            orderId: order.id,
            action: "validate_shipment",
            method: "POST",
            endpoint: resolveValidateEndpoint(company.code),
            httpStatus: 200,
            success: true,
            durationMs: Date.now() - validateStart,
          });
        }
      } catch (validateErr) {
        const validateMsg = validateErr instanceof Error ? validateErr.message : String(validateErr);
        await logApiCall(db, {
          companyId: company.id,
          orderId: order.id,
          action: "validate_shipment",
          method: "POST",
          endpoint: resolveValidateEndpoint(company.code),
          success: false,
          errorMessage: validateMsg,
          durationMs: Date.now() - validateStart,
        });
        console.warn(`[dispatch] validate failed order=${orderId} via ${company.code}:`, validateMsg);
      }
      if (PRE_DISPATCH_STATUSES.includes(order.status)) {
        await queries.updateOrderStatus(db, order.id, "out_for_delivery", dispatchUser?.id, dispatchUser?.name ?? undefined);
      }
    } else {
      // Manual-validate path: parcel created at carrier, waits for team to validate.
      if (PRE_DISPATCH_STATUSES.includes(order.status)) {
        await queries.updateOrderStatus(db, order.id, "dispatched", dispatchUser?.id, dispatchUser?.name ?? undefined);
      }
    }

    const dispatchActor = c.get("user");
    await logActivity(db, dispatchActor, ACTIONS.ORDER_DISPATCHED, {
      type: "order", id: order.id, label: order.orderNumber,
    }, { companyName: company.name, trackingNumber: result.trackingNumber });

    console.info(`[dispatch] order=${orderId} tracking=${result.trackingNumber} via ${company.code}`);
    return c.json({ success: true, data: { shipmentId, trackingNumber: result.trackingNumber, labelUrl: persistedLabelUrl ?? null }, message: "Shipment created successfully" }, 201);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await logApiCall(db, {
      companyId: company.id,
      orderId: order.id,
      action: "create_shipment",
      method: "POST",
      endpoint: logEndpoint,
      success: false,
      errorMessage,
      durationMs,
    });

    console.error(`[dispatch] failed order=${orderId} via ${company.code}:`, errorMessage);
    throw new BusinessLogicError(errorMessage, ERROR_CODES.SHIPMENT_CREATION_FAILED, { provider: company.code, orderId });
  }
}


/**
 * POST /orders/:id/validate-shipment
 * Manually validate a dispatched order at the carrier API.
 * Only applicable when the company has auto_validate=false (e.g. Packers).
 * Requires DELIVERY_DISPATCH scope.
 */
export async function validateShipmentManually(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (order.status !== "dispatched") {
    throw new BusinessLogicError(
      `Order is not in dispatched state — current status: ${order.status}`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      { orderId, currentStatus: order.status }
    );
  }

  if (!order.trackingNumber) {
    throw new BusinessLogicError(
      "Order has no tracking number — dispatch it first",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { orderId }
    );
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);
  if (!company.active) throw new BusinessLogicError("Delivery company is inactive", ERROR_CODES.COMPANY_INACTIVE, { companyId: order.companyId });

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(
      err instanceof Error ? err.message : "Provider not available",
      ERROR_CODES.PROVIDER_NOT_SUPPORTED,
      { companyId: order.companyId, provider: company.code }
    );
  }

  const resolveValidateLog = (code: string) =>
    isEcotrackCompany(code) ? "/api/v1/valid/order"
    : code === "noest" ? "/api/public/valid/order"
    : code === "zr_express" ? "(auto)"
    : "/validate";
  const startMs = Date.now();

  try {
    const validated = await provider.validateShipment(order.trackingNumber);
    const durationMs = Date.now() - startMs;

    if (validated) {
      const shipment = await getShipmentByOrder(db, orderId);
      if (shipment) {
        await setShipmentValidated(db, shipment.id, true);
      }

      await queries.updateOrderStatus(db, orderId, "out_for_delivery",
        c.get("user")?.id, c.get("user")?.name ?? undefined);

      await logApiCall(db, {
        companyId: company.id,
        orderId,
        action: "validate_shipment",
        method: "POST",
        endpoint: resolveValidateLog(company.code),
        httpStatus: 200,
        success: true,
        durationMs,
      });

      const actor = c.get("user");
      await logActivity(db, actor, ACTIONS.ORDER_DISPATCHED, {
        type: "order", id: orderId, label: order.orderNumber,
      }, { companyName: company.name, trackingNumber: order.trackingNumber, action: "validated" });

      return c.json({ success: true, message: "Shipment validated — order is now out for delivery" });
    }

    return c.json({ success: false, message: "Validation returned false" }, 400);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "validate_shipment",
      method: "POST",
      endpoint: resolveValidateLog(company.code),
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }
}

/**
 * POST /orders/bulk-dispatch
 * Dispatch multiple existing orders to a delivery company in a single API call.
 * Uses the provider's bulk shipment creation endpoint (up to 100 orders).
 *
 * ⚠️  NOT all providers support bulk creation. Providers without it will fall back
 *     to sequential single-order creation (same result, more API calls).
 *
 * ⚠️  EcoTrack Packers: POST /api/v1/create/orders returns 500 Server Error —
 *     this is a confirmed bug on Packers' server. When the provider throws,
 *     this handler surfaces the error with SHIPMENT_CREATION_FAILED.
 *     Other EcoTrack platform instances may work correctly.
 *
 * Provider support:
 *   ecotrack  ⚠️  adapter implemented; Packers returns 500 (server bug)
 *   others    ❌  OPERATION_NOT_SUPPORTED
 *
 * Request body: { companyId: string, orderIds: string[] }
 * Response:     { results: [{ orderId, trackingNumber?, labelUrl?, error? }] }
 */
export async function bulkDispatch(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const validated = validation.bulkDispatchSchema.parse(body);

  // Load the company (with credentials)
  const company = await getDeliveryCompanyRaw(db, validated.companyId);
  if (!company) throw new NotFoundError("Delivery company", validated.companyId);
  if (!company.active) throw new BusinessLogicError("Delivery company is inactive", ERROR_CODES.COMPANY_INACTIVE);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(
      err instanceof Error ? err.message : "Provider not available",
      ERROR_CODES.PROVIDER_NOT_SUPPORTED,
      { companyId: validated.companyId, provider: company.code }
    );
  }

  // Provider must implement createShipmentsBulk
  const providerWithBulk = provider as { createShipmentsBulk?: (inputs: unknown[]) => Promise<unknown[]> };
  if (typeof providerWithBulk.createShipmentsBulk !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support bulk order creation.`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  // Load all orders, validate them
  const orderResults: Array<{
    orderId: string;
    orderNumber?: string;
    trackingNumber?: string;
    labelUrl?: string;
    error?: string;
  }> = [];

  const validOrders: Array<{ order: NonNullable<Awaited<ReturnType<typeof queries.getOrderById>>>; input: import("@/endpoints/delivery-companies/providers/types").CreateShipmentInput }> = [];

  for (const orderId of validated.orderIds) {
    const order = await queries.getOrderById(db, orderId);
    if (!order) {
      orderResults.push({ orderId, error: `Order not found: ${orderId}` });
      continue;
    }
    if (order.trackingNumber) {
      orderResults.push({ orderId, orderNumber: order.orderNumber, error: `Already dispatched — tracking: ${order.trackingNumber}` });
      continue;
    }
    if (!order.wilayaId || !order.communeId) {
      orderResults.push({ orderId, orderNumber: order.orderNumber, error: "Missing wilaya or commune" });
      continue;
    }

    // Resolve commune name for this order
    const [wilayaRow, communeRow] = await Promise.all([
      db.select({ name: wilayas.name }).from(wilayas).where(eq(wilayas.id, order.wilayaId)).get(),
      db.select({ name: communes.name }).from(communes).where(eq(communes.id, order.communeId)).get(),
    ]);

    if (!wilayaRow || !communeRow) {
      orderResults.push({ orderId, orderNumber: order.orderNumber, error: "Wilaya or commune not found in reference tables" });
      continue;
    }

    validOrders.push({
      order,
      input: {
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address ?? "",
        wilayaId: order.wilayaId,
        wilaya: wilayaRow.name,
        commune: communeRow.name,
        amount: order.price,
        productDescription: order.orderNumber,
        stopDesk: order.deliveryType === "stop_desk",
        stationCode: order.stationCode ?? undefined,
        reference: order.orderNumber,
        remarks: order.notes ?? undefined,
      },
    });
  }

  if (validOrders.length === 0) {
    return c.json({
      success: false,
      message: "No valid orders to dispatch",
      results: orderResults,
    }, 400);
  }

  // Call the bulk API
  const startMs = Date.now();
  let bulkResults: Array<{ input: unknown; trackingNumber?: string; labelUrl?: string; error?: string }>;
  try {
    bulkResults = await providerWithBulk.createShipmentsBulk(validOrders.map((v) => v.input)) as typeof bulkResults;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      action: "bulk_create_shipment",
      method: "POST",
      endpoint: `${company.apiEndpoint ?? ""}/create/orders`,
      success: false,
      errorMessage,
      durationMs: Date.now() - startMs,
    });
    throw new BusinessLogicError(errorMessage, ERROR_CODES.SHIPMENT_CREATION_FAILED, { provider: company.code });
  }

  const durationMs = Date.now() - startMs;

  // Process each result — create shipment records, update orders.
  const actor = c.get("user");
  const PRE_DISPATCH_STATUSES = ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "dispatched"];
  const validateEndpointMap: Record<string, string> = {
    noest: "/api/public/valid/order",
    zr_express: "(auto)",
  };
  const resolveValidateEndpoint = (code: string) =>
    isEcotrackCompany(code) ? "/api/v1/valid/order" : (validateEndpointMap[code] ?? "/validate");

  for (let i = 0; i < validOrders.length; i++) {
    const { order } = validOrders[i];
    const result = bulkResults[i];

    if (result?.trackingNumber) {
      try {
        const persistedLabelUrl = result.labelUrl
          ?? (company.code === "zr_express" ? DEFERRED_LABEL_MARKER : undefined);

        const shipmentId = await createShipmentRecord(db, {
          orderId: order.id,
          companyId: company.id,
          trackingNumber: result.trackingNumber,
          labelUrl: persistedLabelUrl,
          rawResponse: result,
        });

        await queries.updateOrderTracking(db, order.id, result.trackingNumber);

        if (company.autoValidate) {
          const validateStart = Date.now();
          let validated = false;
          try {
            validated = await provider.validateShipment(result.trackingNumber);
            if (validated) await setShipmentValidated(db, shipmentId, true);
            await logApiCall(db, {
              companyId: company.id,
              orderId: order.id,
              action: "validate_shipment",
              method: "POST",
              endpoint: resolveValidateEndpoint(company.code),
              httpStatus: 200,
              success: true,
              durationMs: Date.now() - validateStart,
            });
          } catch (validateErr) {
            const validateMsg = validateErr instanceof Error ? validateErr.message : String(validateErr);
            await logApiCall(db, {
              companyId: company.id,
              orderId: order.id,
              action: "validate_shipment",
              method: "POST",
              endpoint: resolveValidateEndpoint(company.code),
              success: false,
              errorMessage: validateMsg,
              durationMs: Date.now() - validateStart,
            });
            console.warn(`[dispatch-bulk] validate failed order=${order.id} via ${company.code}:`, validateMsg);
          }

          if (validated && PRE_DISPATCH_STATUSES.includes(order.status)) {
            await queries.updateOrderStatus(db, order.id, "out_for_delivery", actor?.id, actor?.name ?? undefined);
          }
        } else {
          if (PRE_DISPATCH_STATUSES.includes(order.status)) {
            await queries.updateOrderStatus(db, order.id, "dispatched", actor?.id, actor?.name ?? undefined);
          }
        }

        orderResults.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          trackingNumber: result.trackingNumber,
          labelUrl: persistedLabelUrl,
        });
      } catch (err) {
        orderResults.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: err instanceof Error ? err.message : "Failed to save shipment record",
        });
      }
    } else {
      orderResults.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: result?.error ?? "No tracking number returned",
      });
    }
  }

  await logApiCall(db, {
    companyId: company.id,
    action: "bulk_create_shipment",
    method: "POST",
    endpoint: `${company.apiEndpoint ?? ""}/create/orders`,
    httpStatus: 200,
    success: true,
    durationMs,
  });

  const successCount = orderResults.filter((r) => r.trackingNumber).length;
  const failCount = orderResults.filter((r) => r.error).length;

  return c.json({
    success: successCount > 0,
    message: `Bulk dispatch: ${successCount} succeeded, ${failCount} failed`,
    data: { results: orderResults },
  }, successCount > 0 ? 201 : 400);
}
