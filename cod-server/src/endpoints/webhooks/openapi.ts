/**
 * Webhooks OpenAPI Paths
 *
 * Documents:
 *   - Public webhook receiver endpoints (no auth; ZR Express is Svix-HMAC-verified)
 *   - Webhook management endpoints (require delivery:manage scope)
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const json = (schema: object) => ({ "application/json": { schema } });

const successSchema = {
  type: "object",
  properties: { success: { type: "boolean", example: true } },
};

const errorResponseExample = {
  error: "Invalid webhook signature",
  code: "INVALID_WEBHOOK_PAYLOAD",
  category: "VALIDATION",
  context: {
    provider: "zr_express"
  }
};

export const webhookPaths = {

  // ── Public Receiver: Yalidine ─────────────────────────────────────────────

  "/webhooks/yalidine": {
    get: {
      tags: ["Webhooks"],
      summary: "Yalidine CRC challenge",
      description:
        "Yalidine sends a GET request with `?subscribe=...&crc_token=<value>` to validate " +
        "the endpoint at creation, edit, and periodically. The endpoint echoes the crc_token " +
        "as plain text. If this fails, Yalidine disables the webhook automatically.",
      operationId: "yalidineChallenge",
      parameters: [
        {
          name: "subscribe",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Sent by Yalidine to initiate CRC challenge",
        },
        {
          name: "crc_token",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Token to echo back in the response body",
        },
      ],
      responses: {
        "200": {
          description: "CRC token echoed as plain text",
          content: { "text/plain": { schema: { type: "string", example: "abc123token" } } },
        },
      },
    },
    post: {
      tags: ["Webhooks"],
      summary: "Yalidine event delivery",
      description:
        "Receives webhook event batches from Yalidine. One event type per request, " +
        "multiple events per batch. Each event has its own idempotency key (`event_id`). " +
        "Always returns 200 — errors are logged internally.",
      operationId: "yalidineWebhook",
      requestBody: {
        required: true,
        content: json({
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "parcel_created",
                "parcel_edited",
                "parcel_deleted",
                "parcel_status_updated",
                "parcel_payment_updated",
              ],
              example: "parcel_status_updated",
            },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  event_id: { type: "string", example: "lkf6bUGvcepzPdV8sM9BKiHmRxSojan2" },
                  occurred_at: { type: "string", example: "2022-04-28 00:01:26" },
                  data: { type: "object" },
                },
              },
            },
          },
        }),
      },
      responses: {
        "200": {
          description: "Events received (always 200)",
          content: json({ type: "object", properties: { received: { type: "boolean" } } }),
        },
        "400": {
          description: "Invalid webhook payload",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid JSON payload" },
              code: { type: "string", example: "INVALID_WEBHOOK_PAYLOAD" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "yalidine" }
                }
              }
            },
            example: {
              error: "Invalid JSON payload",
              code: "INVALID_WEBHOOK_PAYLOAD",
              category: "VALIDATION",
              context: {
                provider: "yalidine"
              }
            }
          }),
        },
        "502": {
          description: "Webhook processing failed",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "External API failure: yalidine - Webhook processing failed" },
              code: { type: "string", example: "EXTERNAL_API_FAILURE" },
              category: { type: "string", example: "SYSTEM" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "yalidine" },
                  webhookId: { type: "string" },
                  tracking: { type: "string" },
                  errorMsg: { type: "string" }
                }
              }
            }
          }),
        },
      },
    },
  },

  // ── Public Receiver: ZR Express ───────────────────────────────────────────

  "/webhooks/zr_express": {
    post: {
      tags: ["Webhooks"],
      summary: "ZR Express event delivery",
      description:
        "Receives webhook events from ZR Express via Svix. " +
        "Signature is verified using HMAC-SHA256 with the stored whsec_ secret. " +
        "Idempotency key is the `svix-id` header. Always returns 200.",
      operationId: "zrExpressWebhook",
      parameters: [
        { name: "svix-id", in: "header", required: true, schema: { type: "string" } },
        { name: "svix-timestamp", in: "header", required: true, schema: { type: "string" } },
        { name: "svix-signature", in: "header", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          properties: {
            eventType: {
              type: "string",
              enum: ["parcel.state.updated", "parcel.state.situation.created", "parcel.isReturn.updated"],
              example: "parcel.state.updated",
            },
            occurredAt: { type: "string", format: "date-time", example: "2024-01-15T10:30:00.000Z" },
            data: { type: "object", description: "ParcelWebhookDto — all fields optional" },
          },
        }),
      },
      responses: {
        "200": {
          description: "Event received (always 200)",
          content: json({ type: "object", properties: { received: { type: "boolean" } } }),
        },
        "400": {
          description: "Invalid webhook payload or signature",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid webhook signature" },
              code: { type: "string", example: "INVALID_WEBHOOK_PAYLOAD" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "zr_express" }
                }
              }
            },
            example: errorResponseExample
          }),
        },
        "502": {
          description: "Webhook processing failed",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "External API failure: zr_express - Webhook processing failed" },
              code: { type: "string", example: "EXTERNAL_API_FAILURE" },
              category: { type: "string", example: "SYSTEM" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "zr_express" },
                  webhookId: { type: "string" },
                  trackingNumber: { type: "string" },
                  errorMsg: { type: "string" }
                }
              }
            }
          }),
        },
      },
    },
  },

  // ── Management: ZR Express Registration ──────────────────────────────────

  "/api/delivery-companies/{id}/webhook/register": {
    post: {
      tags: ["Webhooks"],
      summary: "Register ZR Express webhook",
      description:
        "Registers a webhook endpoint with ZR Express via their API. " +
        "Calls POST /api/v1/webhooks/endpoints on ZR's API using Bearer auth, " +
        "then fetches and stores the signing secret. " +
        "If an endpoint is already registered it is deleted first.",
      operationId: "registerZrWebhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Webhook registered",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean" },
              webhookUrl: { type: "string" },
              endpointId: { type: "string" },
            },
          }),
        },
        "400": { description: "Registration failed or not a ZR Express company", content: json(errorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { description: "Delivery company not found", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Webhooks"],
      summary: "Unregister ZR Express webhook",
      description:
        "Deletes the registered ZR Express webhook endpoint and clears the stored endpointId and secret.",
      operationId: "unregisterZrWebhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": { description: "Webhook unregistered", content: json(successSchema) },
        "400": { description: "No endpoint registered or wrong company type", content: json(errorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { description: "Delivery company not found", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ── Management: Yalidine Secret ───────────────────────────────────────────

  "/api/delivery-companies/{id}/webhook/secret": {
    patch: {
      tags: ["Webhooks"],
      summary: "Save Yalidine webhook secret",
      description:
        "Stores the Yalidine webhook secret key entered manually by the admin " +
        "from the Yalidine Webhooks Dashboard.",
      operationId: "saveYalidineSecret",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["secret"],
          properties: { secret: { type: "string", example: "yalidine_secret_key_here" } },
        }),
      },
      responses: {
        "200": { description: "Secret saved", content: json(successSchema) },
        "400": { description: "Invalid body or wrong company type", content: json(errorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { description: "Delivery company not found", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ── Management: ZR Custom State Mapping ──────────────────────────────────

  "/api/delivery-companies/{id}/webhook/mapping": {
    patch: {
      tags: ["Webhooks"],
      summary: "Save ZR Express custom status mapping",
      description:
        "Saves the admin-configured mapping from ZR state names (free text, company-specific) " +
        "to our order status strings. Keys must be valid our-status values. " +
        "Values are arrays of exact ZR state names (case-insensitive match).",
      operationId: "saveZrStatusMapping",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["mapping"],
          properties: {
            mapping: {
              type: "object",
              description:
                "Keys: our status strings (new, preparing, assigned, out_for_delivery, delivered, returned, cancelled). " +
                "Values: arrays of ZR state name strings.",
              example: {
                delivered: ["Delivered", "Livraison effectuée"],
                returned: ["Returned", "Retour"],
                out_for_delivery: ["En cours de livraison"],
              },
              additionalProperties: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        }),
      },
      responses: {
        "200": { description: "Mapping saved", content: json(successSchema) },
        "400": { description: "Invalid mapping keys/values or wrong company type", content: json(errorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { description: "Delivery company not found", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
