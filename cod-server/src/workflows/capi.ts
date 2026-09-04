/**
 * CodCapiWorkflow — durable Cloudflare Workflow that sends a Meta CAPI Purchase event
 * when an order reaches a delivery-trigger status.
 *
 * Decoupled from the status handler: CAPI failure can never block delivery confirmation.
 * Instance ID: `capi-{orderId}-Purchase` — deterministic, prevents duplicate Workflows.
 *
 * Steps:
 *   1. fetch-order-and-config  — load fresh order + pixel config + product ids from D1
 *   2. log-skip                — audit row when the send could never happen
 *                                (no access token, or event_time outside Meta's 7-day window)
 *   3. send-capi-event         — POST to Meta; network/5xx throw so the Workflow
 *                                retries (5 attempts, exponential backoff). 4xx returns
 *                                success:false — Meta rejected the batch, retrying won't help.
 *   4. log-result / log-failure — audit row in capi_event_log for every outcome
 *
 * Skips silently when tracking is disabled or the merchant chose Lead as the
 * conversion event — normal operation, not an anomaly worth an audit row.
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env } from "@/types/env";
import { getDb } from "@/db";
import { orders, communes, orderProducts, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPixelConfig } from "../../../cod-shared/queries/pixel-config";
import { sendCapiEvent, type CapiResult } from "@/lib/capi";
import { resolveCapiDispatch } from "./capi-helpers";
import { logCapiEvent } from "@/lib/capi-log";

const SEVEN_DAYS_SECONDS = 7 * 24 * 3600;

export type CodCapiParams = {
  orderId: string;
  eventName: "Lead" | "Purchase";
  triggeredAt: number; // Unix timestamp — becomes event_time
  triggerStatus: string;
  /** Verified-domain page URL — required by Meta for website events. */
  eventSourceUrl?: string;
};

function splitName(customerName: string): { firstName?: string; lastName?: string } {
  const parts = customerName.trim().split(/\s+/);
  return {
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
  };
}

export class CodCapiWorkflow extends WorkflowEntrypoint<Env, CodCapiParams> {
  async run(event: WorkflowEvent<CodCapiParams>, step: WorkflowStep) {
    const { orderId, eventName, triggeredAt, eventSourceUrl } = event.payload;

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
          fbc: orders.fbc,
          fbp: orders.fbp,
          ipAddress: orders.ipAddress,
          userAgent: orders.userAgent,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .get();

      if (!order) throw new NonRetryableError(`Order ${orderId} not found`);

      // Resolve commune name and postal code for user_data
      const communeRow = order.communeId
        ? await db.select({ name: communes.name, postalCode: communes.postalCode }).from(communes).where(eq(communes.id, order.communeId)).get()
        : null;

      // Single-tenant: one store per database
      const storeRow = await db.select({ id: stores.id }).from(stores).limit(1).get();
      if (!storeRow) throw new NonRetryableError("No store found");

      const productRows = await db
        .select({ productId: orderProducts.productId })
        .from(orderProducts)
        .where(eq(orderProducts.orderId, orderId));

      const pixelConfig = await getPixelConfig(db, storeRow.id);

      return {
        order,
        cityName: communeRow?.name ?? null,
        postalCode: communeRow?.postalCode ?? null,
        contentIds: [...new Set(productRows.map((r) => r.productId))],
        pixelConfig,
      };
    });

    // Step 2 — gate: merchant must have chosen this event, with a token, tracking on
    const dispatch = resolveCapiDispatch(data.pixelConfig, eventName);
    if (!dispatch.send) {
      if (dispatch.reason === "no-access-token") {
        await step.do("log-skip", async () => {
          await logCapiEvent(getDb(this.env.DB), {
            orderId,
            eventName,
            status: "skipped",
            error: dispatch.message,
          });
        });
      }
      return;
    }

    // Step 3 — guard: 7-day Meta hard limit on event_time
    const ageSeconds = Math.floor(Date.now() / 1000) - triggeredAt;
    if (ageSeconds >= SEVEN_DAYS_SECONDS) {
      await step.do("log-skip", async () => {
        await logCapiEvent(getDb(this.env.DB), {
          orderId,
          eventName,
          status: "skipped",
          error: `event_time expired: order ${orderId} is ${Math.round(ageSeconds / 3600)}h old — outside Meta 7-day window`,
        });
      });
      return;
    }

    // Step 4 — send CAPI event. Network errors and Meta 5xx throw, which
    // engages the Workflow's retry (5 attempts, 30s exponential backoff).
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
            eventSourceUrl,
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
        await logCapiEvent(getDb(this.env.DB), {
          orderId,
          eventName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      });
      throw err;
    }

    // Step 5 — write audit row to capi_event_log
    await step.do("log-result", async () => {
      await logCapiEvent(getDb(this.env.DB), {
        orderId,
        eventName,
        status: capiResult.success ? "sent" : "failed",
        metaEventId: capiResult.fbtrace_id ?? null,
        error: capiResult.error ?? null,
      });
    });
  }
}

export { shouldTriggerCapiPurchase } from "./capi-helpers";
