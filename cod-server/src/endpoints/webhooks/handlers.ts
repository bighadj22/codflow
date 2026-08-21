/**
 * Webhook Handlers
 *
 * Handles inbound webhook deliveries from ZR Express and Yalidine.
 *
 * Key rules (from docs):
 *   - rawBody MUST be read before JSON.parse (both providers verify raw bytes)
 *   - Always return 200 — both providers retry on non-200
 *   - Yalidine GET challenge must always respond, before any DB calls
 *   - parcel.state.situation.created → log only, never change order status
 *   - Idempotency is per-event, not per-request (Yalidine batches events)
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { getDeliveryCompanyByCode } from "@/endpoints/delivery-companies/queries";
import {
  insertWebhookEvent,
  updateWebhookEvent,
  getOrderByTracking,
  getOrderByReference,
} from "./queries";
import {
  updateOrderStatusWebhook,
  incrementDeliveryAttempts,
} from "@/endpoints/orders/queries";
import { ORDER_STATUSES } from "../orders/validation";
import type { OrderStatus } from "../../../../cod-shared/db/schema";
import { verifySvixSignature } from "./svix-verify";
import { mapZrStateName, parseCustomMapping } from "./zr-status-mapper";
import { mapYalidineStatus } from "./yalidine-status-mapper";
import { ValidationError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/** Guard: carrier mappers return admin-configured strings — verify before use. */
function isOrderStatus(value: string): value is (typeof ORDER_STATUSES)[number] {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
import { shouldTriggerCapiPurchase } from "@/workflows/capi-helpers";

// ─── ZR Express ───────────────────────────────────────────────────────────────

/**
 * POST /webhooks/zr_express
 *
 * Receives ZR Express webhook events via Svix.
 * Payload: { eventType, occurredAt, data: ParcelWebhookDto }
 * Idempotency key: svix-id header
 */
export async function handleZrWebhook(c: Context<AppContext>) {
  // MUST read raw body first — Svix signature verification requires raw bytes
  const rawBody = await c.req.text();
  const db = getDb(c.env.DB);

  // Locate the ZR Express delivery company record
  const company = await getDeliveryCompanyByCode(db, "zr_express");
  if (!company) {
    console.warn("[webhook][zr] No zr_express delivery company configured");
    return c.json({ received: true }, 200);
  }

  // Verify Svix signature if secret is configured
  if (company.webhookSecret) {
    const valid = await verifySvixSignature(
      rawBody,
      c.req.header("svix-id") ?? null,
      c.req.header("svix-timestamp") ?? null,
      c.req.header("svix-signature") ?? null,
      company.webhookSecret
    );
    if (!valid) {
      console.warn("[webhook][zr] Signature verification failed");
      throw new ValidationError(
        "Invalid webhook signature",
        ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
        { provider: "zr_express" }
      );
    }
  } else {
    console.warn("[webhook][zr] webhookSecret not set — skipping signature verification");
  }

  // Parse the payload
  let payload: {
    eventType?: string;
    occurredAt?: string;
    data?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[webhook][zr] Failed to parse JSON body");
    throw new ValidationError(
      "Invalid JSON payload",
      ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
      { provider: "zr_express" }
    );
  }

  const eventType = payload.eventType ?? "unknown";
  const data = payload.data ?? {};
  const trackingNumber = (data.trackingNumber as string | undefined) ?? null;
  const externalId = (data.externalId as string | undefined) ?? null;

  // Use the svix-id header as the idempotency key
  const eventId = c.req.header("svix-id") ?? crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert event record for idempotency + audit
  const { id: webhookEventId, isDuplicate } = await insertWebhookEvent(db, {
    provider: "zr_express",
    eventId,
    companyId: company.id,
    tracking: trackingNumber,
    eventType,
    rawPayload: rawBody,
  });

  if (isDuplicate) {
    // Already processed — return 200 without reprocessing
    return c.json({ received: true }, 200);
  }

  // Handle parcel.state.situation.created — log only, never change order status.
  // Situation slugs and names are not documented as fixed values.
  if (eventType === "parcel.state.situation.created") {
    const situation = data.situation as Record<string, unknown> | undefined;
    const situationName = (situation?.name as string | undefined) ?? null;
    await updateWebhookEvent(db, webhookEventId, {
      result: "ignored",
      reason: situationName,
      processedAt: now,
    });
    return c.json({ received: true }, 200);
  }

  try {
    let newStatus: OrderStatus | null = null;

    if (eventType === "parcel.isReturn.updated") {
      // isReturn=true is the only 100% reliable ZR terminal signal — hardcoded, no mapping needed
      const isReturn = data.isReturn as boolean | undefined;
      if (isReturn === true) {
        newStatus = "returned";
      } else {
        // isReturn=false means the return flag was cleared — no action on our side
        await updateWebhookEvent(db, webhookEventId, {
          result: "ignored",
          processedAt: now,
        });
        return c.json({ received: true }, 200);
      }
    } else if (eventType === "parcel.state.updated") {
      const state = data.state as Record<string, unknown> | undefined;
      const stateName = (state?.name as string | undefined) ?? null;
      const customMap = parseCustomMapping(company.webhookStatusMapping ?? null);
      const mappedZr = mapZrStateName(stateName, customMap);
      if (mappedZr === null || !isOrderStatus(mappedZr)) {
        newStatus = null;
        await updateWebhookEvent(db, webhookEventId, {
          result: "unmapped",
          reason: stateName ?? undefined,
          processedAt: now,
        });
        return c.json({ received: true }, 200);
      }
      newStatus = mappedZr;
    } else {
      // Unknown event type — log and ignore
      await updateWebhookEvent(db, webhookEventId, {
        result: "ignored",
        processedAt: now,
      });
      return c.json({ received: true }, 200);
    }

    // Look up the order — try tracking number first, then externalId (our order number)
    const order = trackingNumber
      ? await getOrderByTracking(db, trackingNumber)
      : null;
    const resolvedOrder = order ?? (externalId ? await getOrderByReference(db, externalId) : null);

    if (!resolvedOrder) {
      await updateWebhookEvent(db, webhookEventId, {
        result: "ignored",
        processedAt: now,
      });
      return c.json({ received: true }, 200);
    }

    const { updated } = await updateOrderStatusWebhook(
      db,
      resolvedOrder.id,
      newStatus,
      "webhook:zr_express"
    );

    if (updated && shouldTriggerCapiPurchase(newStatus, resolvedOrder.wilayaId)) {
      if (!c.env.CAPI_WORKFLOW) {
        console.error("[capi-workflow] CAPI_WORKFLOW binding is undefined — worker needs re-provision");
      } else {
        void c.env.CAPI_WORKFLOW.create({
          id: `capi-${resolvedOrder.id}-Purchase`,
          params: { orderId: resolvedOrder.id, eventName: "Purchase", triggeredAt: Math.floor(Date.now() / 1000), triggerStatus: newStatus },
        }).catch((err: unknown) => console.error("[capi-workflow] zr trigger failed:", (err as Error)?.message));
      }
    }

    await updateWebhookEvent(db, webhookEventId, {
      result: updated ? "ok" : "ignored",
      newStatus: updated ? newStatus : undefined,
      orderId: resolvedOrder.id,
      processedAt: now,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[webhook][zr] Processing error:", errorMsg);
    await updateWebhookEvent(db, webhookEventId, {
      result: "error",
      errorMsg,
      processedAt: now,
    }).catch(() => {}); // never throw from error handler
    
    throw new ExternalApiError(
      "zr_express",
      "Webhook processing failed",
      { webhookId: eventId, trackingNumber, errorMsg }
    );
  }

  return c.json({ received: true }, 200);
}

// ─── Yalidine ─────────────────────────────────────────────────────────────────

/**
 * GET /webhooks/yalidine
 *
 * CRC challenge endpoint required by Yalidine.
 * Yalidine sends GET ?subscribe=...&crc_token=<value>
 * We must echo the crc_token as plain text with 200.
 *
 * This check occurs at:
 *   - Webhook creation
 *   - Webhook edit
 *   - Periodically (if it fails, Yalidine disables the webhook)
 *
 * IMPORTANT: No DB calls, no auth. Must respond within 10 seconds.
 */
export async function handleYalidineChallenge(c: Context<AppContext>) {
  const subscribe = c.req.query("subscribe");
  const crcToken = c.req.query("crc_token");

  // Both params must be present — per Yalidine docs
  if (subscribe !== undefined && crcToken !== undefined) {
    return c.text(crcToken, 200);
  }

  return c.json({ ok: true }, 200);
}

/**
 * POST /webhooks/yalidine
 *
 * Receives Yalidine webhook event batches.
 * Payload: { type: string, events: [{ event_id, occurred_at, data }] }
 * Idempotency key: event.event_id (per event, not per request)
 *
 * Each event in the array is processed independently with its own try/catch.
 * Always returns 200.
 */
export async function handleYalidineWebhook(c: Context<AppContext>) {
  // MUST read raw body first — needed for future signature verification
  const rawBody = await c.req.text();
  const db = getDb(c.env.DB);

  const company = await getDeliveryCompanyByCode(db, "yalidine");
  if (!company) {
    console.warn("[webhook][yalidine] No yalidine delivery company configured");
    return c.json({ received: true }, 200);
  }

  // TODO: implement Yalidine signature verification once "Secure Your Webhook"
  // documentation is obtained. The header name and algorithm are not documented
  // in the currently available Yalidine webhook docs. The webhookSecret is stored
  // in the DB but verification is deferred until docs are available.
  if (company.webhookSecret) {
    console.warn(
      "[webhook][yalidine] webhookSecret is set but signature verification is not yet implemented — " +
      "obtain the 'Secure Your Webhook' section from Yalidine docs to implement"
    );
  }

  let payload: {
    type?: string;
    events?: Array<{
      event_id: string;
      occurred_at: string;
      data: Record<string, unknown>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[webhook][yalidine] Failed to parse JSON body");
    throw new ValidationError(
      "Invalid JSON payload",
      ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
      { provider: "yalidine" }
    );
  }

  const eventType = payload.type ?? "unknown";
  const events = payload.events ?? [];

  for (const event of events) {
    const eventId = event.event_id;
    const eventData = event.data ?? {};
    const tracking = (eventData.tracking as string | undefined) ?? null;
    const now = new Date().toISOString();

    const { id: webhookEventId, isDuplicate } = await insertWebhookEvent(db, {
      provider: "yalidine",
      eventId,
      companyId: company.id,
      tracking,
      eventType,
      rawPayload: JSON.stringify({ type: eventType, event }),
    });

    if (isDuplicate) continue;

    try {
      // Non-status event types — log and ignore
      if (eventType !== "parcel_status_updated") {
        await updateWebhookEvent(db, webhookEventId, {
          result: "ignored",
          processedAt: now,
        });
        continue;
      }

      const statusStr = (eventData.status as string | undefined) ?? null;
      const reason = (eventData.reason as string | null | undefined) ?? null;
      const { status: mappedStatus, incrementAttempts } = mapYalidineStatus(statusStr);

      if (mappedStatus === null || !isOrderStatus(mappedStatus)) {
        await updateWebhookEvent(db, webhookEventId, {
          result: "unmapped",
          reason: statusStr ?? undefined,
          processedAt: now,
        });
        continue;
      }
      const nextStatus: OrderStatus = mappedStatus;

      // "Tentative échouée" — stays out_for_delivery, only increments attempts
      if (incrementAttempts) {
        if (tracking) {
          const order = await getOrderByTracking(db, tracking);
          if (order) {
            await incrementDeliveryAttempts(db, order.id);
            await updateWebhookEvent(db, webhookEventId, {
              result: "ignored", // not a status transition
              reason: reason ?? undefined,
              orderId: order.id,
              processedAt: now,
            });
            continue;
          }
        }
        await updateWebhookEvent(db, webhookEventId, {
          result: "ignored",
          reason: reason ?? undefined,
          processedAt: now,
        });
        continue;
      }

      // Regular status transition
      if (!tracking) {
        await updateWebhookEvent(db, webhookEventId, {
          result: "ignored",
          processedAt: now,
        });
        continue;
      }

      const order = await getOrderByTracking(db, tracking);
      if (!order) {
        await updateWebhookEvent(db, webhookEventId, {
          result: "ignored",
          processedAt: now,
        });
        continue;
      }

      const { updated } = await updateOrderStatusWebhook(
        db,
        order.id,
        nextStatus,
        "webhook:yalidine"
      );

      if (updated && shouldTriggerCapiPurchase(nextStatus, order.wilayaId)) {
        if (!c.env.CAPI_WORKFLOW) {
          console.error("[capi-workflow] CAPI_WORKFLOW binding is undefined — worker needs re-provision");
        } else {
          void c.env.CAPI_WORKFLOW.create({
            id: `capi-${order.id}-Purchase`,
            params: { orderId: order.id, eventName: "Purchase", triggeredAt: Math.floor(Date.now() / 1000), triggerStatus: nextStatus },
          }).catch((err: unknown) => console.error("[capi-workflow] yalidine trigger failed:", (err as Error)?.message));
        }
      }

      await updateWebhookEvent(db, webhookEventId, {
        result: updated ? "ok" : "ignored",
        newStatus: updated ? nextStatus : undefined,
        reason: reason ?? undefined,
        orderId: order.id,
        processedAt: now,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[webhook][yalidine] Event processing error:", errorMsg);
      await updateWebhookEvent(db, webhookEventId, {
        result: "error",
        errorMsg,
        processedAt: now,
      }).catch(() => {});
      
      throw new ExternalApiError(
        "yalidine",
        "Webhook processing failed",
        { webhookId: eventId, tracking, errorMsg }
      );
    }
  }

  return c.json({ received: true }, 200);
}
