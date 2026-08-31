/**
 * Webhook Routes
 *
 * Public router — NO auth middleware anywhere in this file.
 * Authentication is handled internally by each handler via signature
 * verification (Svix HMAC-SHA256 for ZR Express).
 *
 * Mount order in index.ts:
 *   app.route("/webhooks", webhooksRouter)  ← BEFORE app.use("/api/*", authMiddleware)
 *
 * Built with defineRoute() — the standard route-builder pattern.
 *
 * Deliberately NO request-body validation on the event-delivery routes:
 * handlers must read the RAW body (c.req.text()) before any JSON parsing
 * because Svix signatures verify raw bytes — framework parsing here would
 * break that contract. Payload shapes are documented in the route
 * descriptions and the handlers enforce their own specific error codes.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import {
  handleYalidineChallenge,
  handleYalidineWebhook,
  handleZrWebhook,
} from "./handlers";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Response schemas ─────────────────────────────────────────────────────────

const receivedResponse = {
  description: "Event received (always 200 — carriers retry on non-200)",
  content: jsonContent(
    z.object({
      received: z.boolean().openapi({ example: true }),
    })
  ),
};

const webhookErrorResponse = (code: string, category: string, description: string) => ({
  description,
  content: jsonContent(
    z.object({
      error: z.string(),
      code: z.string().openapi({ example: code }),
      category: z.string().openapi({ example: category }),
      context: z.record(z.string(), z.unknown()).optional(),
    })
  ),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const yalidineChallengeRoute = defineRoute({
  method: "get",
  path: "/yalidine",
  auth: "public",
  tags: ["Webhooks"],
  summary: "Yalidine CRC challenge",
  description:
    "Yalidine sends a GET request with ?subscribe=…&crc_token=<value> to validate the endpoint " +
    "at creation, edit, and periodically. The endpoint echoes the crc_token as plain text. " +
    "If this fails, Yalidine disables the webhook automatically.",
  operationId: "yalidineChallenge",
  query: z.object({
    subscribe: z.string().optional().openapi({
      description: "Sent by Yalidine to initiate the CRC challenge",
    }),
    crc_token: z.string().optional().openapi({
      description: "Token echoed back in the (plain-text) response body",
    }),
  }),
  responses: {
    // Documented contract: crc_token echoed as text/plain. Without challenge
    // params the legacy handler answers a tiny {ok:true} JSON ack instead —
    // the dual return predates typed routes.
    200: {
      description: "CRC token echoed as plain text",
      content: {
        "text/plain": {
          schema: z.string().openapi({ example: "abc123token" }),
        },
      },
    },
  },
  handler: handleYalidineChallenge,
});

const yalidineWebhookRoute = defineRoute({
  method: "post",
  path: "/yalidine",
  auth: "public",
  tags: ["Webhooks"],
  summary: "Yalidine event delivery",
  description: `Receives webhook event batches from Yalidine. One event type per request, multiple events per batch. Each event carries its own idempotency key (\`event_id\`). Always returns 200 — errors are logged internally.

**Payload:** \`{ type: "parcel_created" | "parcel_edited" | "parcel_deleted" | "parcel_status_updated" | "parcel_payment_updated", events: [{ event_id, occurred_at, data }] }\`

Invalid payloads are rejected with \`400 INVALID_WEBHOOK_PAYLOAD\`; processing failures surface as \`502 EXTERNAL_API_FAILURE\`.`,
  operationId: "yalidineWebhook",
  responses: {
    200: receivedResponse,
    400: webhookErrorResponse(
      "INVALID_WEBHOOK_PAYLOAD",
      "VALIDATION",
      "Invalid webhook payload (INVALID_WEBHOOK_PAYLOAD)"
    ),
    502: webhookErrorResponse(
      "EXTERNAL_API_FAILURE",
      "SYSTEM",
      "Webhook processing failed (EXTERNAL_API_FAILURE)"
    ),
  },
  handler: handleYalidineWebhook,
});

const zrWebhookRoute = defineRoute({
  method: "post",
  path: "/zr_express",
  auth: "public",
  tags: ["Webhooks"],
  summary: "ZR Express event delivery",
  description: `Receives webhook events from ZR Express via Svix. Signature is verified using HMAC-SHA256 with the stored whsec_ secret over the RAW request bytes. Idempotency key is the \`svix-id\` header. Always returns 200.

**Payload:** \`{ eventType: "parcel.state.updated" | "parcel.state.situation.created" | "parcel.isReturn.updated", occurredAt, data: ParcelWebhookDto }\`

Signature/payload failures are rejected with \`400 INVALID_WEBHOOK_PAYLOAD\`; processing failures surface as \`502 EXTERNAL_API_FAILURE\`.`,
  operationId: "zrExpressWebhook",
  headers: z.object({
    "svix-id": z.string().openapi({ description: "Svix idempotency key" }),
    "svix-timestamp": z.string().openapi({ description: "Svix signed timestamp" }),
    "svix-signature": z.string().openapi({ description: "Svix HMAC-SHA256 signature" }),
  }),
  responses: {
    200: receivedResponse,
    400: webhookErrorResponse(
      "INVALID_WEBHOOK_PAYLOAD",
      "VALIDATION",
      "Invalid webhook payload or signature (INVALID_WEBHOOK_PAYLOAD)"
    ),
    502: webhookErrorResponse(
      "EXTERNAL_API_FAILURE",
      "SYSTEM",
      "Webhook processing failed (EXTERNAL_API_FAILURE)"
    ),
  },
  handler: handleZrWebhook,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const webhooksRouter = new OpenAPIHono<AppContext>();

webhooksRouter.openapi(yalidineChallengeRoute.route, yalidineChallengeRoute.handler);
webhooksRouter.openapi(yalidineWebhookRoute.route, yalidineWebhookRoute.handler);
webhooksRouter.openapi(zrWebhookRoute.route, zrWebhookRoute.handler);

export default webhooksRouter;
