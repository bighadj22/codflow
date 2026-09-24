/**
 * CodCapiWorkflow — durable Cloudflare Workflow that sends Meta CAPI events
 * across the COD lifecycle (Checkout, Phone Confirmation, Delivery).
 *
 * Decoupled from the status handler: CAPI failure can never block order or delivery confirmation.
 * Instance ID: `capi-{orderId}-{stage}-{eventName}` — deterministic, prevents duplicate Workflows.
 *
 * Steps:
 *   0. validate-payload        — Zod schema validation (NonRetryableError on malformed inputs)
 *   1. fetch-order-and-config  — load fresh order + pixel config + verify stage eligibility
 *   2. log-skip                — audit row when the send could never happen (no token / expired)
 *   3. claim-event             — atomic D1 insert with unique key constraint on (order_id, stage, event_name)
 *   4. send-capi-event         — POST to Meta; network/5xx throw to trigger exponential retry
 *   5. log-result / log-failure — updates the claimed row with final outcome
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { z } from "zod";
import type { Env } from "@/types/env";
import { getDb } from "@/db";
import { orders, communes, orderProducts, stores, capiEventLog, landingPages } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveTrackingConfig } from "../../../cod-shared/queries/tracking-config";
import { sendCapiEvent, type CapiResult } from "@/lib/capi";
import {
  resolveCapiDispatch,
  resolveConversionForStage,
  getCapiWorkflowId,
  conversionSourceUrl,
  shouldTriggerCapiPurchase,
  shouldTriggerCapiConfirmed,
  type ConversionStage,
  type MetaEventName,
} from "./capi-helpers";
import { logCapiEvent } from "@/lib/capi-log";

const SEVEN_DAYS_SECONDS = 7 * 24 * 3600;

export const CodCapiParamsSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  eventName: z.enum(["Lead", "Purchase"]),
  stage: z.enum(["checkout", "confirmed", "delivered"]).default("delivered"),
  triggeredAt: z.number().int().positive("triggeredAt must be a positive integer"),
  triggerStatus: z.string().min(1, "triggerStatus is required"),
  eventSourceUrl: z.string().url().optional(),
});

export type CodCapiParams = z.infer<typeof CodCapiParamsSchema>;

function splitName(customerName: string): { firstName?: string; lastName?: string } {
  const parts = customerName.trim().split(/\s+/);
  return {
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
  };
}

export class CodCapiWorkflow extends WorkflowEntrypoint<Env, CodCapiParams> {
  async run(event: WorkflowEvent<CodCapiParams>, step: WorkflowStep) {
    // Step 0 — Runtime schema validation
    const parsed = CodCapiParamsSchema.safeParse(event.payload);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new NonRetryableError(`Invalid CAPI workflow payload: ${errorMsg}`);
    }

    const { orderId, eventName, stage, triggeredAt, eventSourceUrl, triggerStatus } = parsed.data;

    // Step 1 — fetch fresh data from D1 (never rely on stale params)
    const data = await step.do("fetch-order-and-config", async () => {
      const db = getDb(this.env.DB);

      const order = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerId: orders.customerId,
          customerName: orders.customerName,
          phone: orders.phone,
          wilayaId: orders.wilayaId,
          communeId: orders.communeId,
          city: orders.city,
          price: orders.price,
          deliveryFee: orders.deliveryFee,
          landingPageId: orders.landingPageId,
          // The page the ad actually pointed at — Events Manager shows this,
          // and "/thank-you" says nothing about which creative sold.
          landingPageSlug: landingPages.slug,
          fbc: orders.fbc,
          fbp: orders.fbp,
          ipAddress: orders.ipAddress,
          userAgent: orders.userAgent,
        })
        .from(orders)
        .leftJoin(landingPages, eq(orders.landingPageId, landingPages.id))
        .where(eq(orders.id, orderId))
        .get();

      if (!order) throw new NonRetryableError(`Order ${orderId} not found`);

      // Resolve commune name and postal code for user_data
      const communeRow = order.communeId
        ? await db
            .select({ name: communes.name, postalCode: communes.postalCode })
            .from(communes)
            .where(eq(communes.id, order.communeId))
            .get()
        : null;

      // Single-tenant: one store per database
      const storeRow = await db.select({ id: stores.id, domain: stores.domain }).from(stores).limit(1).get();
      if (!storeRow) throw new NonRetryableError("No store found");

      const productRows = await db
        .select({ productId: orderProducts.productId })
        .from(orderProducts)
        .where(eq(orderProducts.orderId, orderId));

      // The ORDER decides the destination, not the store: a sale that came
      // from a landing page with its own pixel must mirror to that pixel, or
      // Meta sees a browser event on one pixel and a server event on another
      // and counts two conversions instead of merging them.
      const pixelConfig = await resolveTrackingConfig(db, {
        storeId: storeRow.id,
        landingPageId: order.landingPageId,
      });

      // Shared conversion model resolver check
      const decision = resolveConversionForStage(pixelConfig?.conversionEvent, stage);

      return {
        order,
        storeDomain: storeRow.domain,
        cityName: communeRow?.name ?? null,
        postalCode: communeRow?.postalCode ?? null,
        contentIds: [...new Set(productRows.map((r) => r.productId))],
        pixelConfig,
        shouldFire: decision.shouldFire && decision.eventName === eventName,
        skipReason: decision.reason,
      };
    });

    if (!data.shouldFire) {
      return { skipped: true, reason: data.skipReason ?? "stage_mismatch" };
    }

    // Step 2 — gate: merchant must have chosen this event, with a token, tracking on
    const dispatch = resolveCapiDispatch(data.pixelConfig, eventName, stage);
    if (!dispatch.send) {
      if (dispatch.reason === "no-access-token") {
        await step.do("log-skip", async () => {
          await logCapiEvent(getDb(this.env.DB), {
            orderId,
            eventName,
            stage,
            status: "skipped",
            pixelId: data.pixelConfig?.pixelId ?? null,
            error: dispatch.message,
          });
        });
      }
      return { skipped: true, reason: dispatch.reason };
    }

    // Step 3 — guard: 7-day Meta hard limit on event_time
    const ageSeconds = Math.floor(Date.now() / 1000) - triggeredAt;
    if (ageSeconds >= SEVEN_DAYS_SECONDS) {
      await step.do("log-skip", async () => {
        await logCapiEvent(getDb(this.env.DB), {
          orderId,
          eventName,
          stage,
          status: "skipped",
          pixelId: data.pixelConfig?.pixelId ?? null,
          error: `event_time expired: order ${orderId} is ${Math.round(ageSeconds / 3600)}h old — outside Meta 7-day window`,
        });
      });
      return { skipped: true, reason: "event_time_expired" };
    }

    // Step 4 — Atomic Event Claim in D1
    const claim = await step.do("claim-event", async () => {
      const db = getDb(this.env.DB);
      const now = new Date().toISOString();
      const claimId = `claim-${orderId}-${stage}-${eventName}`;
      // The destination is written with the claim, not with the result, so an
      // event that never completes still says where it was headed.
      const destination = data.pixelConfig!.pixelId;

      try {
        const res = await db.run(
          sql`INSERT INTO capi_event_log (id, order_id, event_name, stage, status, pixel_id, sent_at)
              VALUES (${claimId}, ${orderId}, ${eventName}, ${stage}, 'claimed', ${destination}, ${now})
              ON CONFLICT (order_id, stage, event_name) DO NOTHING`
        );

        if (res.meta.changes === 1) {
          return { claimed: true };
        }
      } catch {
        // Fallback check if driver does not support changes property or syntax
      }

      // Check existing row
      const existing = await db
        .select({ status: capiEventLog.status, sentAt: capiEventLog.sentAt })
        .from(capiEventLog)
        .where(
          and(
            eq(capiEventLog.orderId, orderId),
            eq(capiEventLog.stage, stage),
            eq(capiEventLog.eventName, eventName)
          )
        )
        .get();

      if (existing) {
        if (existing.status === "sent") {
          return { claimed: false, reason: "already_sent" };
        }
        if (existing.status === "claimed") {
          const elapsed = Date.now() - new Date(existing.sentAt).getTime();
          if (elapsed < 10 * 60 * 1000) {
            return { claimed: false, reason: "already_in_flight" };
          }
        }
      }

      return { claimed: true };
    });

    if (!claim.claimed) {
      return { skipped: true, reason: claim.reason };
    }

    // Step 5 — Send CAPI Event to Meta
    const finalEventSourceUrl =
      eventSourceUrl ?? conversionSourceUrl(data.storeDomain, data.order.landingPageSlug);

    const { firstName, lastName } = splitName(data.order.customerName);
    let capiResult: CapiResult;

    try {
      capiResult = await step.do(
        "send-capi-event",
        { retries: { limit: 5, delay: "30 seconds", backoff: "exponential" } },
        async () => {
          return sendCapiEvent(data.pixelConfig!.pixelId, data.pixelConfig!.accessToken, {
            eventName,
            eventId: orderId,
            eventTime: triggeredAt,
            eventSourceUrl: finalEventSourceUrl,
            userData: {
              phone: data.order.phone,
              firstName,
              lastName,
              externalId: data.order.customerId,
              city: data.cityName,
              postalCode: data.postalCode,
              fbc: data.order.fbc,
              fbp: data.order.fbp,
              clientIpAddress: data.order.ipAddress,
              clientUserAgent: data.order.userAgent,
            },
            value: eventName === "Purchase" ? data.order.price + data.order.deliveryFee : undefined,
            currency: "DZD",
            contentIds: data.contentIds,
            testEventCode: dispatch.testEventCode,
          });
        }
      );
    } catch (err) {
      await step.do("log-failure", async () => {
        const db = getDb(this.env.DB);
        const now = new Date().toISOString();
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db.run(
          sql`UPDATE capi_event_log
              SET status = 'failed', error = ${errorMsg}, sent_at = ${now}
              WHERE order_id = ${orderId} AND stage = ${stage} AND event_name = ${eventName}`
        );
      });
      throw err;
    }

    // Step 6 — Update claim row in capi_event_log
    await step.do("log-result", async () => {
      const db = getDb(this.env.DB);
      const now = new Date().toISOString();
      const status = capiResult.success ? "sent" : "failed";
      const metaEventId = capiResult.fbtrace_id ?? null;
      const error = capiResult.error ?? null;

      await db.run(
        sql`UPDATE capi_event_log
            SET status = ${status}, meta_event_id = ${metaEventId}, error = ${error}, sent_at = ${now}
            WHERE order_id = ${orderId} AND stage = ${stage} AND event_name = ${eventName}`
      );
    });

    return { success: capiResult.success, metaEventId: capiResult.fbtrace_id };
  }
}

export { shouldTriggerCapiPurchase, shouldTriggerCapiConfirmed, getCapiWorkflowId } from "./capi-helpers";
