/**
 * Orders Shipment Operations
 * 
 * Handles post-dispatch shipment operations: update, cancel, remarks, tracking, and label retrieval.
 * These operations interact with carrier APIs after initial dispatch.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { communes } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as queries from "./queries";
import { clearOrderTracking, syncOrderAfterCarrierUpdate } from "./queries";
import { logActivity, ACTIONS } from "@/lib/activity";
import { getProvider, isEcotrackCompany } from "@/endpoints/delivery-companies/providers/registry";
import { ZrExpressProvider } from "@/endpoints/delivery-companies/providers/zr_express/adapter";
import { getDeliveryCompanyRaw } from "@/endpoints/delivery-companies/queries";
import { setShipmentValidated, getShipmentByOrder, logApiCall } from "@/endpoints/delivery-companies/providers/shipments";
import { NotFoundError, BusinessLogicError, ValidationError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { DEFERRED_LABEL_MARKER } from "./dispatch";

/**
 * PATCH /orders/:id/update-shipment
 * Update an existing shipment at the carrier API (before validation only).
 * Updates customer info / amount at the carrier. Does not change DB order fields.
 * Supported providers: ecotrack (Packers). Others return OPERATION_NOT_SUPPORTED.
 */
export async function updateShipmentInfo(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

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

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.updateShipment !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support updating shipments`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  // EcoTrack platform (all company codes — ecotrack, packers_ecotrack, etc.) silently returns
  // success=true on validated orders but does NOT apply changes. Tested 2026-04-18 on Packers:
  // update after valid/order → success=true but recipientName unchanged.
  // Guard: only allow update while status is "dispatched" (= created but not yet validated).
  // This prevents DB desync where our DB would reflect new values but EcoTrack still has old ones.
  if (isEcotrackCompany(company.code) && order.status !== "dispatched") {
    throw new BusinessLogicError(
      `EcoTrack orders can only be updated before validation. This order is already validated (status: ${order.status}).`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { orderId, status: order.status }
    );
  }

  // Resolve French commune name — required by Packers on every update call.
  const communeRow = order.communeId
    ? await db.select({ name: communes.name }).from(communes).where(eq(communes.id, order.communeId)).get()
    : null;

  const bodyData: any = (c.req as any).valid?.("json");
  const body = bodyData ?? (await c.req.json().catch(() => ({})) as Record<string, unknown>);

  // Packers requires ALL of these fields on every update call — even if only one field changes.
  // We pre-fill from the order record and let the body override individual fields.
  // amount (montant at the carrier) is the COD total: price + delivery fee.
  // When the merchant did not send an explicit amount we do NOT sync price back
  // (the pre-filled COD differs from the product subtotal whenever a fee exists).
  const codAmount = order.price + (order.deliveryFee ?? 0);
  const input = {
    customerName: (body.customerName as string | undefined) ?? order.customerName,
    phone:        (body.phone        as string | undefined) ?? order.phone,
    phone2:       (body.phone2       as string | undefined) ?? undefined,
    address:      (body.address      as string | undefined) ?? order.address ?? "",
    commune:      (body.commune      as string | undefined) ?? communeRow?.name ?? "",
    wilayaId:     body.wilayaId != null ? Number(body.wilayaId) : (order.wilayaId ?? undefined),
    amount:       body.amount   != null ? Number(body.amount)   : codAmount,
    remarks:      body.remarks  as string | undefined,
    fragile:      body.fragile  != null ? Boolean(body.fragile) : undefined,
    weight:       body.weight   != null ? Number(body.weight)   : undefined,
  };

  // ZR Express addresses parcels by UUID, not by tracking number.
  // The UUID was captured in companyShipments.rawResponse.parcelId at dispatch time.
  let identifier = order.trackingNumber;
  if (company.code === "zr_express") {
    const shipment = await getShipmentByOrder(db, orderId);
    let parcelId: string | undefined;
    if (shipment?.rawResponse) {
      try {
        const raw = JSON.parse(shipment.rawResponse) as { parcelId?: string };
        parcelId = raw.parcelId;
      } catch {
        // ignore — parcelId stays undefined
      }
    }
    if (!parcelId) {
      throw new BusinessLogicError(
        "ZR Express: parcelId not available for this order. Re-dispatch may be required.",
        ERROR_CODES.OPERATION_NOT_SUPPORTED,
        { orderId, trackingNumber: order.trackingNumber }
      );
    }
    identifier = parcelId;
  }

  const startMs = Date.now();
  try {
    await provider.updateShipment(identifier, input);
    const durationMs = Date.now() - startMs;

    // Sync changed fields back to our DB so the order record stays in sync with the carrier.
    await syncOrderAfterCarrierUpdate(db, orderId, {
      customerName: input.customerName !== order.customerName ? input.customerName : undefined,
      phone:        input.phone        !== order.phone        ? input.phone        : undefined,
      price:        body.amount != null ? Number(body.amount) : undefined,
    });

    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "update_shipment",
      method: "POST",
      endpoint: `/api/v1/update/order`,
      httpStatus: 200,
      requestBody: input,
      success: true,
      durationMs,
    });

    const actor = c.get("user");
    console.info(`[shipment] updated order=${orderId} tracking=${order.trackingNumber} via ${company.code}`);
    await logActivity(db, actor, ACTIONS.ORDER_STATUS_CHANGED, {
      type: "order", id: orderId, label: order.orderNumber,
    }, { action: "update_shipment", trackingNumber: order.trackingNumber });

    return c.json({ success: true, message: "Shipment updated successfully" }, 200);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "update_shipment",
      method: "POST",
      endpoint: `/api/v1/update/order`,
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }
}

/**
 * POST /orders/:id/cancel-shipment
 * Delete/cancel a shipment at the carrier API (before validation only).
 * On success: clears trackingNumber from order, resets status to "ready".
 * Supported providers: ecotrack (Packers). Others return OPERATION_NOT_SUPPORTED.
 *
 * Uses POST (not DELETE) to avoid routing ambiguity with DELETE /orders/:id.
 */
export async function cancelShipment(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError(
      "Order has no tracking number — nothing to cancel at the carrier",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { orderId }
    );
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.deleteShipment !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support cancelling shipments`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const startMs = Date.now();
  try {
    await provider.deleteShipment(order.trackingNumber);
    const durationMs = Date.now() - startMs;

    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "cancel_shipment",
      method: "DELETE",
      endpoint: `/api/v1/delete/order`,
      httpStatus: 200,
      success: true,
      durationMs,
    });

    // Clear tracking from order and reset to "ready" so it can be re-dispatched.
    // The old shipment row loses its validated flag; orders.status carries the cancel state.
    const shipment = await getShipmentByOrder(db, orderId);
    if (shipment) await setShipmentValidated(db, shipment.id, false);

    await clearOrderTracking(db, orderId);

    const actor = c.get("user");
    const PRE_DISPATCH_STATUSES = ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "dispatched"];
    if (PRE_DISPATCH_STATUSES.includes(order.status)) {
      await queries.updateOrderStatus(db, orderId, "ready", actor?.id, actor?.name ?? undefined);
    }

    await logActivity(db, actor, ACTIONS.ORDER_STATUS_CHANGED, {
      type: "order", id: orderId, label: order.orderNumber,
    }, { action: "cancel_shipment", trackingNumber: order.trackingNumber });

    console.info(`[shipment] cancelled order=${orderId} tracking=${order.trackingNumber} via ${company.code}`);
    return c.json({ success: true, message: "Shipment cancelled — order reset to ready" }, 200);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "cancel_shipment",
      method: "DELETE",
      endpoint: `/api/v1/delete/order`,
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }
}

/**
 * POST /orders/:id/ask-return
 * Ask the carrier to return a parcel that is currently in delivery.
 * This is a REQUEST, not a state change — the carrier may ignore it
 * (platform-documented), so the order status stays out_for_delivery until
 * the return is confirmed via /confirm-return-reception or tracking shows it.
 * Supported providers: ecotrack. Others return OPERATION_NOT_SUPPORTED.
 */
export async function askShipmentReturn(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError(
      "Order has no tracking number — dispatch it first",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { orderId }
    );
  }

  if (order.status !== "out_for_delivery") {
    throw new BusinessLogicError(
      `Return can only be requested while the parcel is in delivery — current status: ${order.status}`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      { orderId, currentStatus: order.status }
    );
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.askReturn !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support return requests`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const startMs = Date.now();
  try {
    await provider.askReturn(order.trackingNumber);
    const durationMs = Date.now() - startMs;

    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "ask_return",
      method: "POST",
      endpoint: "/api/v1/ask/for/order/return",
      httpStatus: 200,
      success: true,
      durationMs,
    });

    const actor = c.get("user");
    await logActivity(db, actor, ACTIONS.ORDER_STATUS_CHANGED, {
      type: "order", id: orderId, label: order.orderNumber,
    }, { action: "ask_return", trackingNumber: order.trackingNumber });

    console.info(`[shipment] return requested order=${orderId} tracking=${order.trackingNumber} via ${company.code}`);
    return c.json({
      success: true,
      message: "Return requested — the courier may take up to a day to action it (they can decline). Track the parcel for the return outcome.",
    }, 200);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "ask_return",
      method: "POST",
      endpoint: "/api/v1/ask/for/order/return",
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }
}

/**
 * POST /orders/:id/confirm-return-reception
 * Confirm at the carrier that the merchant physically received the returned
 * parcel (EcoTrack POST /api/v1/valid/returns), then flip the order to
 * "returned" through the normal status path (inventory restore, customer
 * stats, history — all handled by updateOrderStatus).
 * Forward-only: only callable from out_for_delivery.
 * Supported providers: ecotrack. Others return OPERATION_NOT_SUPPORTED.
 */
export async function confirmReturnReception(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError(
      "Order has no tracking number — dispatch it first",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { orderId }
    );
  }

  if (order.status !== "out_for_delivery") {
    throw new BusinessLogicError(
      `Return reception can only be confirmed from out_for_delivery — current status: ${order.status}`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      { orderId, currentStatus: order.status }
    );
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.validateReturns !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support confirming return reception`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const startMs = Date.now();
  let confirmed: boolean;
  try {
    confirmed = await provider.validateReturns([order.trackingNumber]);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "confirm_return_reception",
      method: "POST",
      endpoint: "/api/v1/valid/returns",
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }

  const durationMs = Date.now() - startMs;
  await logApiCall(db, {
    companyId: company.id,
    orderId,
    action: "confirm_return_reception",
    method: "POST",
    endpoint: "/api/v1/valid/returns",
    httpStatus: 200,
    success: confirmed,
    durationMs,
  });

  if (!confirmed) {
    throw new BusinessLogicError(
      "The carrier reports nothing eligible for return confirmation — the parcel may not be transferred to a return state yet, or was already confirmed. Check its tracking events.",
      ERROR_CODES.SHIPMENT_UPDATE_FAILED,
      { orderId, trackingNumber: order.trackingNumber, provider: company.code }
    );
  }

  const actor = c.get("user");
  await queries.updateOrderStatus(db, orderId, "returned", actor?.id, actor?.name ?? undefined);
  await logActivity(db, actor, ACTIONS.ORDER_STATUS_CHANGED, {
    type: "order", id: orderId, label: order.orderNumber,
  }, { action: "confirm_return_reception", trackingNumber: order.trackingNumber });

  console.info(`[shipment] return reception confirmed order=${orderId} tracking=${order.trackingNumber} via ${company.code}`);
  return c.json({ success: true, message: "Return reception confirmed at the carrier — order marked returned" }, 200);
}

/**
 * POST /orders/:id/add-remark
 * Add a remark/note to the shipment at the carrier API.
 * Works at any time after dispatch. Visible to carrier and sender.
 * Supported providers: ecotrack (Packers). Others return OPERATION_NOT_SUPPORTED.
 */
export async function addShipmentRemark(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError("Order has no tracking number", ERROR_CODES.REQUIRED_FIELD_MISSING, { orderId });
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.addRemark !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support adding remarks`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const bodyData: any = (c.req as any).valid?.("json");
  const body = bodyData ?? (await c.req.json().catch(() => ({})) as { content?: string });
  if (!body.content?.trim()) {
    throw new ValidationError("Remark content is required", ERROR_CODES.REQUIRED_FIELD_MISSING);
  }

  const startMs = Date.now();
  try {
    await provider.addRemark(order.trackingNumber, body.content.trim());
    const durationMs = Date.now() - startMs;

    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "add_remark",
      method: "POST",
      endpoint: `/api/v1/add/maj`,
      httpStatus: 200,
      requestBody: { content: body.content.trim() },
      success: true,
      durationMs,
    });

    return c.json({ success: true, message: "Remark added" }, 200);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logApiCall(db, {
      companyId: company.id,
      orderId,
      action: "add_remark",
      method: "POST",
      endpoint: `/api/v1/add/maj`,
      success: false,
      errorMessage,
      durationMs,
    });
    throw new ExternalApiError(company.code, errorMessage, { orderId });
  }
}

/**
 * GET /orders/:id/remarks
 * Fetch the list of remarks/notes for a shipment from the carrier API.
 * Returns entries from both sender and courier.
 * Supported providers: ecotrack (Packers). Others return OPERATION_NOT_SUPPORTED.
 */
export async function getShipmentRemarks(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError("Order has no tracking number", ERROR_CODES.REQUIRED_FIELD_MISSING, { orderId });
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.getRemarks !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support fetching remarks`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const remarks = await provider.getRemarks(order.trackingNumber);
  return c.json({ success: true, data: remarks }, 200);
}

/**
 * GET /orders/:id/tracking-events
 * Fetch the full tracking history for a shipment from the carrier API.
 * Returns chronological events (pickup, hub reception, delivery attempts, etc.).
 * Supported providers: all (ecotrack, noest, zr_express, yalidine).
 */
export async function getShipmentTracking(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError("Order has no tracking number", ERROR_CODES.REQUIRED_FIELD_MISSING, { orderId });
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(err instanceof Error ? err.message : "Provider not available", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
  }

  if (typeof provider.getTrackingInfo !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support live tracking`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  const events = await provider.getTrackingInfo(order.trackingNumber);
  return c.json({ success: true, data: events }, 200);
}

/**
 * GET /orders/:id/label
 * Proxy the shipment label PDF from the carrier API.
 *
 * EcoTrack label URLs require a Bearer token — they are not publicly accessible.
 * This endpoint fetches the PDF server-side and streams it to the client so the
 * browser never needs to hold the API token.
 *
 * Returns: application/pdf with Content-Disposition: inline (opens in browser tab)
 */
export async function proxyShipmentLabel(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await queries.getOrderById(db, orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  if (!order.trackingNumber) {
    throw new BusinessLogicError("Order has no tracking number", ERROR_CODES.REQUIRED_FIELD_MISSING, { orderId });
  }

  if (!order.companyId) throw new ValidationError("Order has no delivery company assigned", ERROR_CODES.REQUIRED_FIELD_MISSING);

  const company = await getDeliveryCompanyRaw(db, order.companyId);
  if (!company) throw new NotFoundError("Delivery company", order.companyId);

  if (!company.apiToken) {
    throw new BusinessLogicError("Delivery company has no API token configured", ERROR_CODES.MISSING_API_CREDENTIALS, { companyId: order.companyId });
  }

  // ZR Express: label URLs are time-limited SAS tokens generated on demand by
  // POST /parcels/labels/individual/pdf. The stored labelUrl is the DEFERRED_LABEL_MARKER
  // sentinel (just signaling availability to the UI), so always re-resolve here.
  if (company.code === "zr_express") {
    const provider = getProvider(company);
    if (!(provider instanceof ZrExpressProvider)) {
      throw new BusinessLogicError("Provider mismatch for zr_express", ERROR_CODES.PROVIDER_NOT_SUPPORTED, { companyId: order.companyId });
    }
    const sasUrl = await provider.getLabelUrl(order.trackingNumber);
    if (!sasUrl) {
      throw new ExternalApiError(company.code, "Label not yet available from carrier", { orderId, trackingNumber: order.trackingNumber });
    }
    try {
      // SAS URLs are pre-signed — no Authorization header.
      const pdfRes = await fetch(sasUrl, { redirect: "follow" });
      if (!pdfRes.ok) {
        throw new Error(`Carrier returned HTTP ${pdfRes.status}`);
      }
      return new Response(pdfRes.body, {
        status: 200,
        headers: {
          "Content-Type": pdfRes.headers.get("Content-Type") ?? "application/pdf",
          "Content-Disposition": `inline; filename="label-${order.trackingNumber}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ExternalApiError(company.code, `Failed to fetch label: ${msg}`, { orderId, trackingNumber: order.trackingNumber });
    }
  }

  // Other providers (ecotrack, noest, yalidine): label URL points at the carrier
  // and requires the bearer token. Use the stored labelUrl if it matches the
  // current tracking number (guards against stale records from re-dispatches).
  const shipment = await getShipmentByOrder(db, orderId);
  const labelUrl = (shipment?.trackingNumber === order.trackingNumber && shipment?.labelUrl && shipment.labelUrl !== DEFERRED_LABEL_MARKER)
    ? shipment.labelUrl
    : `${company.apiEndpoint}/api/v1/get/order/label?tracking=${encodeURIComponent(order.trackingNumber)}`;

  try {
    const pdfRes = await fetch(labelUrl, {
      headers: { Authorization: `Bearer ${company.apiToken}` },
      redirect: "follow",
    });

    if (!pdfRes.ok) {
      throw new Error(`Carrier returned HTTP ${pdfRes.status}`);
    }

    return new Response(pdfRes.body, {
      status: 200,
      headers: {
        "Content-Type": pdfRes.headers.get("Content-Type") ?? "application/pdf",
        "Content-Disposition": `inline; filename="label-${order.trackingNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ExternalApiError(company.code, `Failed to fetch label: ${msg}`, { orderId, trackingNumber: order.trackingNumber });
  }
}
