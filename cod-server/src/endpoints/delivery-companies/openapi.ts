/**
 * Delivery Companies OpenAPI Paths
 *
 *   GET    /api/delivery-companies                        — list all companies
 *   POST   /api/delivery-companies                        — create company
 *   GET    /api/delivery-companies/{id}                   — get single company
 *   PATCH  /api/delivery-companies/{id}                   — update company
 *   DELETE /api/delivery-companies/{id}                   — delete company
 *   GET    /api/delivery-companies/{id}/stop-desks        — pickup-point / stop-desk list
 *   POST   /api/delivery-companies/{id}/webhook/register  — register ZR Express webhook
 *   DELETE /api/delivery-companies/{id}/webhook/register  — unregister ZR Express webhook
 *   PATCH  /api/delivery-companies/{id}/webhook/secret    — save Yalidine webhook secret
 *   PATCH  /api/delivery-companies/{id}/webhook/mapping   — save ZR status name mapping
 */

const companySchema = { $ref: "#/components/schemas/DeliveryCompany" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// ─── Reusable error examples ──────────────────────────────────────────────────

const companyNotFoundError = {
  error: "Delivery company with ID comp_123 not found",
  code: "ENTITY_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Delivery company", id: "comp_123" },
};

const duplicateEntityError = {
  error: 'A delivery company with code "yalidine" already exists',
  code: "DUPLICATE_ENTITY",
  category: "BUSINESS_LOGIC",
  context: { code: "yalidine", existingCompanyId: "comp_456" },
};

const missingCredentialsError = {
  error: "Yalidine is not connected — add API credentials first",
  code: "MISSING_API_CREDENTIALS",
  category: "VALIDATION",
  context: { companyId: "comp_123", companyName: "Yalidine" },
};

const providerNotSupportedError = {
  error: "Provider not available",
  code: "PROVIDER_NOT_SUPPORTED",
  category: "BUSINESS_LOGIC",
  context: { companyId: "comp_123", code: "unsupported_code" },
};

const operationNotSupportedError = {
  error: "The yalidine provider does not support stop desks.",
  code: "OPERATION_NOT_SUPPORTED",
  category: "BUSINESS_LOGIC",
  context: { provider: "yalidine" },
};

const externalApiFailureError = {
  error: "External API failure: Yalidine — Connection timeout",
  code: "EXTERNAL_API_FAILURE",
  category: "SYSTEM",
  context: { companyId: "comp_123", code: "yalidine" },
};

// ─── Reusable response blocks ─────────────────────────────────────────────────

/** Standard 422 block for all live-provider endpoints (not-connected, no provider, not supported). */
const liveProviderErrors422 = {
  "422": {
    description:
      "Company not connected (MISSING_API_CREDENTIALS), provider code unknown (PROVIDER_NOT_SUPPORTED), or provider does not implement this feature (OPERATION_NOT_SUPPORTED)",
    content: json({
      type: "object",
      properties: {
        error: { type: "string" },
        code: {
          type: "string",
          enum: [
            "MISSING_API_CREDENTIALS",
            "PROVIDER_NOT_SUPPORTED",
            "OPERATION_NOT_SUPPORTED",
          ],
        },
        category: { type: "string" },
        context: { type: "object" },
      },
      examples: {
        missingCredentials: { value: missingCredentialsError, summary: "API credentials not set" },
        providerNotSupported: { value: providerNotSupportedError, summary: "Unsupported provider code" },
        operationNotSupported: { value: operationNotSupportedError, summary: "Feature not available for this provider" },
      },
    }),
  },
};

/** Standard 502 block for live-provider endpoints. */
const externalApiError502 = {
  "502": {
    description: "Provider API returned an error or could not be reached (EXTERNAL_API_FAILURE)",
    content: json({
      type: "object",
      properties: {
        error: { type: "string", example: externalApiFailureError.error },
        code: { type: "string", example: "EXTERNAL_API_FAILURE" },
        category: { type: "string", example: "SYSTEM" },
        context: { type: "object", example: externalApiFailureError.context },
      },
      example: externalApiFailureError,
    }),
  },
};

/** Standard 404 for a company not found. */
const companyNotFound404 = {
  "404": {
    description: "Company not found (ENTITY_NOT_FOUND)",
    content: json({
      type: "object",
      properties: {
        error: { type: "string", example: companyNotFoundError.error },
        code: { type: "string", example: companyNotFoundError.code },
        category: { type: "string", example: companyNotFoundError.category },
        context: { type: "object", example: companyNotFoundError.context },
      },
      example: companyNotFoundError,
    }),
  },
};

// ─── StopDesk schema (inline — returned by /stop-desks) ──────────────────────
const stopDeskSchema = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description:
        "Station code to use as `stationCode` when dispatching a stop-desk order. " +
        "Format differs by provider: Noest = alphanumeric code (e.g. \"16A\"); " +
        "Yalidine = numeric center_id (e.g. \"160101\"); " +
        "ZR Express = territory UUID; EcoTrack = postal code string.",
      example: "16A",
    },
    name: { type: "string", example: "Agence Alger Centre" },
    address: { type: "string", nullable: true, example: "5 Rue Didouche Mourad, Alger" },
    phones: {
      type: "array",
      nullable: true,
      items: { type: "string" },
      description: "Contact phone numbers for the stop-desk station. May be null if not provided by the API.",
      example: ["0555123456"],
    },
    wilayaId: {
      type: "integer",
      minimum: 1,
      maximum: 58,
      description: "Wilaya number this station belongs to (1–58).",
      example: 16,
    },
  },
  required: ["code", "name", "wilayaId"],
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const deliveryCompanyPaths = {
  // ── List / Create ────────────────────────────────────────────────────────────
  "/api/delivery-companies": {
    get: {
      tags: ["Delivery Companies"],
      summary: "List delivery companies",
      description:
        "Returns all delivery companies stored in the database (Yalidine, ZR Express, Packers/EcoTrack, Noest, etc.). " +
        "Sensitive fields (`apiToken`, `apiUserGuid`, `webhookSecret`) are never included in responses — " +
        "use `isConnected` to check whether credentials are stored.",
      operationId: "listDeliveryCompanies",
      parameters: [
        {
          name: "active",
          in: "query",
          description: "Filter by active status. `true` = only active companies; `false` = only inactive.",
          schema: { type: "string", enum: ["true", "false"] },
        },
        {
          name: "search",
          in: "query",
          description: "Case-insensitive search by company name.",
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50, maximum: 100 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        "200": {
          description: "List of delivery companies",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: companySchema },
              count: { type: "integer", example: 4 },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:read` scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Delivery Companies"],
      summary: "Create delivery company",
      description:
        "Creates a new delivery company record. The `code` field selects which provider adapter is used — " +
        "it must match a supported value. Credentials (`apiToken`, `apiUserGuid`) can be stored here or added later via PATCH.",
      operationId: "createDeliveryCompany",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "nameAr", "code"],
              properties: {
                name: { type: "string", example: "Yalidine" },
                nameAr: { type: "string", example: "ياليدين" },
                code: {
                  type: "string",
                  pattern: "^[a-z0-9_]+$",
                  description:
                    "Provider adapter code. Must be one of: `noest` | `zr_express` | `yalidine` | `ecotrack`. " +
                    "EcoTrack-platform companies (e.g. Packers) use code `ecotrack` — " +
                    "`apiEndpoint` must then be set to the company-specific base URL (e.g. https://packers.ecotrack.dz).",
                  example: "yalidine",
                },
                website: { type: "string", format: "uri", nullable: true, example: "https://yalidine.app" },
                active: { type: "boolean", default: true },
                apiEndpoint: {
                  type: "string",
                  format: "uri",
                  nullable: true,
                  description:
                    "Base URL for the provider API. Required for `ecotrack` (varies per account). " +
                    "Not used for `noest`, `yalidine`, or `zr_express` (hardcoded in adapters).",
                  example: "https://packers.ecotrack.dz",
                },
                apiToken: {
                  type: "string",
                  nullable: true,
                  description:
                    "Bearer token / API key for the provider. " +
                    "Stored securely — never returned in any read response. " +
                    "noest: Bearer token. yalidine: APP-TOKEN header value. zr_express: X-Api-Key header value. ecotrack: Bearer token.",
                },
                apiUserGuid: {
                  type: "string",
                  nullable: true,
                  description:
                    "Secondary credential. " +
                    "noest: user_guid (sent in every POST body). yalidine: APP-ID header value. " +
                    "zr_express: tenantId (X-Tenant header). ecotrack: not used.",
                },
                supportsHomeDelivery: { type: "boolean", default: true },
                supportsStopDesk: { type: "boolean", default: true },
                supportsTracking: { type: "boolean", default: false },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Company created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: companySchema,
            },
          }),
        },
        "400": { description: "Validation error — missing required field or invalid value", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        "409": {
          description: "A company with that code already exists (DUPLICATE_ENTITY)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: duplicateEntityError.error },
              code: { type: "string", example: duplicateEntityError.code },
              category: { type: "string", example: duplicateEntityError.category },
              context: { type: "object", example: duplicateEntityError.context },
            },
            example: duplicateEntityError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ── Get / Update / Delete ─────────────────────────────────────────────────────
  "/api/delivery-companies/{id}": {
    get: {
      tags: ["Delivery Companies"],
      summary: "Get delivery company",
      description: "Returns a single delivery company by its ID. API credentials are never included in the response.",
      operationId: "getDeliveryCompany",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Company details",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true }, data: companySchema },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:read` scope", content: json(errorSchema) },
        ...companyNotFound404,
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Delivery Companies"],
      summary: "Update delivery company",
      description:
        "Partial update — include only the fields to change. " +
        "If `code` is changed it must remain unique. " +
        "Credentials can be updated here — they are write-only and will not be returned.",
      operationId: "updateDeliveryCompany",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                nameAr: { type: "string" },
                code: { type: "string", pattern: "^[a-z0-9_]+$" },
                website: { type: "string", format: "uri", nullable: true },
                active: { type: "boolean" },
                apiEndpoint: { type: "string", format: "uri", nullable: true },
                apiToken: { type: "string", nullable: true },
                apiUserGuid: { type: "string", nullable: true },
                supportsHomeDelivery: { type: "boolean" },
                supportsStopDesk: { type: "boolean" },
                supportsTracking: { type: "boolean" },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Company updated",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true }, data: companySchema },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
        "409": {
          description: "Another company already uses that code (DUPLICATE_ENTITY)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: duplicateEntityError.error },
              code: { type: "string", example: duplicateEntityError.code },
              category: { type: "string", example: duplicateEntityError.category },
              context: { type: "object", example: duplicateEntityError.context },
            },
            example: duplicateEntityError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Delivery Companies"],
      summary: "Delete delivery company",
      description: "Permanently deletes the company record. Fails with 409 if the company has orders referencing it.",
      operationId: "deleteDeliveryCompany",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Company deleted",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
        "409": {
          description: "Company has active orders — complete or reassign them first (COMPANY_INACTIVE)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot delete company" },
              code: { type: "string", example: "COMPANY_INACTIVE" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: { type: "object", example: { companyId: "comp_123" } },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ── Live Provider Endpoints ───────────────────────────────────────────────────

  "/api/delivery-companies/{id}/stop-desks": {
    get: {
      tags: ["Delivery Companies"],
      summary: "Fetch stop-desk / pickup-point stations",
      description:
        "Returns the list of pickup-point stations from the provider's API. " +
        "The `code` field from each station must be used as the `stationCode` field when dispatching stop-desk orders.\n\n" +
        "**Provider support and station counts (verified 2026-04-17):**\n" +
        "- `noest`: ✅ 100 stations — `code` = alphanumeric string (e.g. `\"16A\"`)\n" +
        "- `yalidine`: ✅ 176 centers — `code` = numeric center_id (e.g. `\"160101\"`)\n" +
        "- `zr_express`: ✅ 200 pickup-point territories — `code` = UUID string\n" +
        "- `ecotrack`: ✅ communes with `has_stop_desk=1` — `code` = postal code string",
      operationId: "fetchCompanyStopDesks",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of stop-desk stations. Use `code` as `stationCode` when dispatching.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: stopDeskSchema,
                example: [
                  { code: "16A", name: "Agence Alger Centre", wilayaId: 16 },
                  { code: "160101", name: "Agence de Alger Centre [Yalidine]", wilayaId: 16 },
                ],
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:read` scope", content: json(errorSchema) },
        ...companyNotFound404,
        ...liveProviderErrors422,
        ...externalApiError502,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ── Webhook Management ────────────────────────────────────────────────────────

  "/api/delivery-companies/{id}/webhook/register": {
    post: {
      tags: ["Delivery Companies"],
      summary: "Register ZR Express webhook endpoint",
      description:
        "Registers a webhook endpoint with ZR Express via their API, stores the returned `endpointId` " +
        "and signing `secret` in the database, and returns the webhook URL.\n\n" +
        "**ZR Express only.** Returns 400 for any other provider code.\n\n" +
        "**What this does:**\n" +
        "1. If a previous endpoint is registered (`webhookEndpointId` is set), deletes it first\n" +
        "2. Registers a new endpoint at `POST https://api.zrexpress.app/api/v1/webhooks/endpoints` " +
        "   with `eventTypes: [\"parcel.state.updated\"]`\n" +
        "3. Fetches the signing secret from `/api/v1/webhooks/endpoints/{id}/secret`\n" +
        "4. Stores `endpointId` + `secret` in the delivery_companies row\n\n" +
        "**Webhook URL** is derived from the incoming request host: `https://{host}/webhooks/zr_express`. " +
        "Set `X-Worker-URL` header to override the detected base URL (useful in local dev).\n\n" +
        "**Auth:** Requires `delivery:manage` scope. Uses ZR `X-Api-Key` + `X-Tenant` internally.",
      operationId: "registerZrWebhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Webhook registered successfully.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              webhookUrl: {
                type: "string",
                description: "The URL registered with ZR Express. ZR will POST events to this URL.",
                example: "https://your-worker.example.com/webhooks/zr_express",
              },
              endpointId: {
                type: "string",
                description: "ZR Express endpoint ID. Stored internally — needed to unregister.",
                example: "ep_abc123",
              },
              warning: {
                type: "string",
                nullable: true,
                description:
                  "Present only if the secret could not be fetched. " +
                  "In this case HMAC signature verification will be skipped on incoming webhooks.",
                example: "Endpoint registered but secret could not be fetched — signature verification will be skipped",
              },
            },
          }),
        },
        "400": {
          description:
            "Wrong provider (not `zr_express`), missing API credentials, or ZR Express rejected the registration.",
          content: json({
            type: "object",
            properties: {
              error: { type: "string" },
              detail: { type: "string", nullable: true, description: "Raw response from ZR Express if registration failed" },
              hint: { type: "string", nullable: true },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Delivery Companies"],
      summary: "Unregister ZR Express webhook endpoint",
      description:
        "Deletes the registered webhook endpoint from ZR Express and clears `webhookEndpointId` + `webhookSecret` from the database.\n\n" +
        "**ZR Express only.** Returns 400 if no endpoint is registered or for other providers.\n\n" +
        "If ZR Express returns 404 (endpoint already deleted), the local DB is still cleared — treated as success.",
      operationId: "unregisterZrWebhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Webhook endpoint unregistered and DB cleared.",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "400": {
          description: "Wrong provider, no endpoint registered, or missing API credentials.",
          content: json({
            type: "object",
            properties: {
              error: { type: "string" },
              detail: { type: "string", nullable: true },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/delivery-companies/{id}/webhook/secret": {
    patch: {
      tags: ["Delivery Companies"],
      summary: "Save Yalidine webhook secret",
      description:
        "Stores the Yalidine webhook signing secret in the database. " +
        "This secret is **entered manually** by the admin after setting up the webhook in the Yalidine dashboard.\n\n" +
        "**Yalidine only.** Returns 400 for any other provider code.\n\n" +
        "Once stored, incoming Yalidine webhooks are verified with HMAC-SHA256 using this secret.",
      operationId: "saveYalidineWebhookSecret",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["secret"],
              properties: {
                secret: {
                  type: "string",
                  minLength: 1,
                  description: "Webhook secret key from the Yalidine dashboard.",
                  example: "my_yalidine_webhook_secret",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Secret saved.",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "400": {
          description: "Wrong provider (not `yalidine`), missing or empty `secret` field, or invalid JSON.",
          content: json({ type: "object", properties: { error: { type: "string" } } }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/delivery-companies/{id}/webhook/mapping": {
    patch: {
      tags: ["Delivery Companies"],
      summary: "Save ZR Express custom status mapping",
      description:
        "Saves a custom ZR Express state-name → our-status mapping for this company. " +
        "ZR Express uses free-text state names that can differ per account — this mapping allows " +
        "normalizing them to our internal statuses when processing incoming webhooks.\n\n" +
        "**ZR Express only.** Returns 400 for any other provider code.\n\n" +
        "**Body format:** `{ mapping: { [ourStatus]: string[] } }` where:\n" +
        "- keys must be valid our-status values: `new | preparing | assigned | out_for_delivery | delivered | returned | cancelled`\n" +
        "- values are arrays of ZR state name strings that map to that status\n\n" +
        "**Example:**\n" +
        "```json\n" +
        '{ "mapping": { "delivered": ["Livré", "Livree"], "returned": ["Retour"] } }\n' +
        "```",
      operationId: "saveZrStatusMapping",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["mapping"],
              properties: {
                mapping: {
                  type: "object",
                  description:
                    "Map from our status key to an array of ZR Express state name strings. " +
                    "Valid keys: `new`, `preparing`, `assigned`, `out_for_delivery`, `delivered`, `returned`, `cancelled`.",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                  example: {
                    delivered: ["Livré", "Livree"],
                    returned: ["Retour", "Retourné"],
                    out_for_delivery: ["En cours de livraison"],
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Mapping saved.",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "400": {
          description:
            "Wrong provider (not `zr_express`), invalid `mapping` structure (not an object, invalid status key, or non-string-array value), or invalid JSON.",
          content: json({
            type: "object",
            properties: {
              error: {
                type: "string",
                example: 'Invalid status key: "livré". Valid keys: new, preparing, assigned, out_for_delivery, delivered, returned, cancelled',
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing `delivery:manage` scope", content: json(errorSchema) },
        ...companyNotFound404,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
