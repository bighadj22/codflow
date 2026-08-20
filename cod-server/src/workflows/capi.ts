/**
 * CodCapiWorkflow — durable Cloudflare Workflow that sends a Meta CAPI Purchase event
 * when an order reaches a delivery-trigger status.
 *
 * Decoupled from the status handler: CAPI failure can never block delivery confirmation.
 * Instance ID: `capi-{orderId}-Purchase` — deterministic, prevents duplicate Workflows.
 *
 * Steps:
 *   1. fetch-order-and-config  — load fresh order + pixel config from D1
 *   2. check-7day-window       — guard: reject events older than Meta's 7-day hard limit
 *   3. send-capi-event         — POST to Meta with retries + exponential backoff
 *   4. log-result              — write audit row to capi_event_log
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env } from "@/types/env";
import { getDb } from "@/db";
import { orders, communes, wilayas, capiEventLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPixelConfig } from "../../../cod-shared/queries/pixel-config";
import { sendCapiEvent } from "@/lib/capi";


export type CodCapiParams = {
  orderId: string;
  eventName: "Lead" | "Purchase";
  triggeredAt: number; // Unix timestamp — becomes event_time
  triggerStatus: string;
};

export class CodCapiWorkflow extends WorkflowEntrypoint<Env, CodCapiParams> {
  async run(event: WorkflowEvent<CodCapiParams>, step: WorkflowStep) {
    const { orderId, eventName, triggeredAt } = event.payload;

    // Step 1 — fetch fresh data from D1 (never rely on stale params)
    const data = await step.do("fetch-order-and-config", async () => {
      const db = getDb(this.env.DB);

      const order = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          storeId: orders.id, // placeholder — store context from storeApiKeys
          customerId: orders.customerId,
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

      // Resolve commune name for city hashing
      const communeRow = order.communeId
        ? await db.select({ name: communes.name }).from(communes).where(eq(communes.id, order.communeId)).get()
        : null;

      // Resolve postal code from commune
      const postalRow = order.communeId
        ? await db.select({ postalCode: communes.postalCode }).from(communes).where(eq(communes.id, order.communeId)).get()
        : null;

      // Resolve storeId from store_api_keys — STORE_API_KEY env var is not available
      // inside the Workflow, but we can infer it from the DB since there's one store.
      const { stores } = await import("@/db/schema");
      const storeRow = await db.select({ id: stores.id }).from(stores).limit(1).get();
      if (!storeRow) throw new NonRetryableError("No store found");

      const pixelConfig = await getPixelConfig(db, storeRow.id);

      return {
        order,
        cityName: communeRow?.name ?? null,
        postalCode: postalRow?.postalCode ?? null,
        pixelConfig,
        storeId: storeRow.id,
      };
    });

    // Step 2 — guard: no pixel config or tracking disabled
    if (!data.pixelConfig?.enabled) {
      throw new NonRetryableError(`Tracking not enabled for store ${data.storeId} — skipping`);
    }
    if (!data.pixelConfig.accessToken) {
      throw new NonRetryableError(`No CAPI access token for store ${data.storeId} — configure it in Settings → Tracking`);
    }

    // Step 3 — guard: 7-day Meta hard limit
    await step.do("check-7day-window", async () => {
      const ageSeconds = Math.floor(Date.now() / 1000) - triggeredAt;
      const sevenDays = 7 * 24 * 3600;
      if (ageSeconds >= sevenDays) {
        throw new NonRetryableError(
          `event_time expired: order ${orderId} is ${Math.round(ageSeconds / 3600)}h old — outside Meta 7-day window`
        );
      }
    });

    // Step 4 — send CAPI event (retries: 5, exponential backoff starting 30s)
    const capiResult = await step.do(
      "send-capi-event",
      { retries: { limit: 5, delay: "30 seconds", backoff: "exponential" } },
      async () => {
        return sendCapiEvent(data.pixelConfig!.pixelId, data.pixelConfig!.accessToken, {
          eventName,
          eventId: orderId,
          eventTime: triggeredAt,
          userData: {
            phone: data.order.phone,
            city: data.cityName,
            postalCode: data.postalCode,
            fbc: data.order.fbc,
            fbp: data.order.fbp,
            clientIpAddress: data.order.ipAddress,
            clientUserAgent: data.order.userAgent,
          },
          value: eventName === "Purchase" ? data.order.price + data.order.deliveryFee : undefined,
          currency: "DZD",
          testEventCode: data.pixelConfig!.testEventCode,
        });
      }
    );

    // Step 5 — write audit row to capi_event_log
    await step.do("log-result", async () => {
      const db = getDb(this.env.DB);
      await db.insert(capiEventLog).values({
        id: crypto.randomUUID(),
        orderId,
        eventName,
        status: capiResult.success ? "sent" : "failed",
        metaEventId: capiResult.fbtrace_id ?? null,
        error: capiResult.error ?? null,
        sentAt: new Date().toISOString(),
      });
    });
  }
}

export { shouldTriggerCapiPurchase } from "./capi-helpers";
