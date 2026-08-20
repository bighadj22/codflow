/**
 * Offers OpenAPI Paths
 *
 * CRM endpoints for managing "Buy X Get Y" promotional offers.
 * Offers are auto-applied server-side when a store order meets the trigger
 * conditions — no coupon code input is required from the customer.
 *
 * All routes require an API key with the appropriate offers scope.
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

/** Nested product reference returned inside an offer */
const offerProductRef = {
  type: "object",
  properties: {
    id:     { type: "string", description: "Product UUID" },
    name:   { type: "string", example: "Samsung Galaxy A54" },
    handle: { type: "string", example: "samsung-galaxy-a54", description: "URL-friendly product handle" },
  },
  required: ["id", "name", "handle"],
};

/** Nested variant reference returned inside an offer (nullable) */
const offerVariantRef = {
  nullable: true,
  description: "Resolved variant, or null when the offer applies to any variant.",
  type: "object",
  properties: {
    id:    { type: "string", description: "Variant UUID" },
    label: { type: "string", example: "أزرق / 128 GB", description: "Human-readable label built from variation values." },
  },
  required: ["id", "label"],
};

/**
 * Full offer object as returned by GET /api/offers and GET /api/offers/{id}.
 */
const offerSchema = {
  type: "object",
  properties: {
    id:   { type: "string", description: "Offer UUID" },
    name: { type: "string", example: "اشتري 2 واحصل على 1 مجاناً", description: "Merchant-facing display name." },

    // ── Trigger ──────────────────────────────────────────────────────────────
    triggerProduct: {
      ...offerProductRef,
      description: "The product the customer must purchase to trigger this offer.",
    },
    triggerVariant: {
      ...offerVariantRef,
      description: "Specific variant required to trigger the offer. null = any variant of the trigger product.",
    },
    triggerQuantity: {
      type: "integer",
      minimum: 1,
      example: 2,
      description: "Minimum quantity of the trigger product the customer must order.",
    },

    // ── Reward ───────────────────────────────────────────────────────────────
    rewardProduct: {
      ...offerProductRef,
      nullable: true,
      description: "The product the customer receives for free when the offer triggers. null for `free_shipping` offers.",
    },
    rewardVariant: {
      ...offerVariantRef,
      description: "Specific variant given as the reward. null = same variant as the ordered item (when same product) or the first active variant (when different product). Always null for `free_shipping` offers.",
    },
    rewardQuantity: {
      type: "integer",
      minimum: 0,
      example: 1,
      description: "Number of free reward units added to the order. 0 for `free_shipping` offers.",
    },

    // ── Discount type ────────────────────────────────────────────────────────
    discountType: {
      type: "string",
      enum: ["free", "free_shipping"],
      description: "`free` = reward product added at price 0. `free_shipping` = delivery fee waived (no reward product).",
    },

    // ── Schedule ─────────────────────────────────────────────────────────────
    startsAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "UTC ISO-8601 datetime when the offer becomes active. null = no start restriction.",
    },
    endsAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "UTC ISO-8601 datetime when the offer expires. null = no end restriction.",
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: "string",
      enum: ["active", "inactive"],
      description: "Only `active` offers within the schedule window are auto-applied to store orders.",
    },

    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id", "name",
    "triggerProduct", "triggerVariant", "triggerQuantity",
    "rewardProduct", "rewardVariant", "rewardQuantity",
    "discountType", "status", "createdAt", "updatedAt",
  ],
};

/** Request body for POST /api/offers and PATCH /api/offers/{id} */
const offerWriteSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 2,
      maxLength: 200,
      example: "اشتري 2 واحصل على 1 مجاناً",
    },
    discountType: {
      type: "string",
      enum: ["free", "free_shipping"],
      default: "free",
      description: "`free` = give reward product at $0. `free_shipping` = waive delivery fee.",
    },
    triggerProductId: {
      type: "string",
      description: "UUID of the product that must be ordered to trigger the offer.",
    },
    triggerVariantId: {
      type: "string",
      nullable: true,
      description: "Specific variant UUID required to trigger. Omit or send null to match any variant.",
    },
    triggerQuantity: {
      type: "integer",
      minimum: 1,
      default: 2,
      description: "Minimum order quantity of the trigger product.",
    },
    rewardProductId: {
      type: "string",
      nullable: true,
      description: "UUID of the product to give for free. Required for `free` discount type. Omit or send null for `free_shipping` offers.",
    },
    rewardVariantId: {
      type: "string",
      nullable: true,
      description: "Specific variant UUID to reward. Omit or send null for same-as-ordered (same product) or first active variant (different product). Always null for `free_shipping` offers.",
    },
    rewardQuantity: {
      type: "integer",
      minimum: 0,
      default: 1,
      description: "Number of free units added. Use 0 for `free_shipping` offers.",
    },
    startsAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "UTC ISO-8601. Omit or send null for no start restriction.",
    },
    endsAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "UTC ISO-8601. Omit or send null for no end restriction.",
    },
    status: {
      type: "string",
      enum: ["active", "inactive"],
      default: "active",
    },
  },
};

export const offerPaths = {
  "/api/offers": {
    get: {
      tags: ["Offers"],
      summary: "List offers",
      description: "Get all Buy X Get Y promotional offers ordered by creation date (newest first). Requires `offers:read` scope.",
      operationId: "listOffers",
      responses: {
        "200": {
          description: "List of offers",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    { type: "array", items: offerSchema },
            },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "403": { 
          description: "Insufficient scope — requires offers:read", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    post: {
      tags: ["Offers"],
      summary: "Create offer",
      description: `Create a new Buy X Get Y promotional offer.

**Auto-application rules (applied at order time, not here):**
- When a store order is submitted via \`POST /store/orders\`, the server checks for any active offer
  where \`triggerProductId\` matches, the ordered quantity ≥ \`triggerQuantity\`, and — if \`triggerVariantId\`
  is set — the ordered variantId also matches.
- If the reward item is out of stock, the offer is silently skipped (order still succeeds).
- The reward is inserted as a \`$0\` order line item; the COD total only reflects paid products + delivery.

Requires \`offers:manage\` scope.`,
      operationId: "createOffer",
      requestBody: {
        required: true,
        content: json({
          ...offerWriteSchema,
          required: ["name", "triggerProductId", "discountType"],
        }),
      },
      responses: {
        "201": {
          description: "Offer created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    offerSchema,
            },
          }),
        },
        "400": { 
          description: "Validation error", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", example: "name" },
                        message: { type: "string", example: "Name is required" },
                        code: { type: "string", example: "invalid_type" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "403": { 
          description: "Insufficient scope — requires offers:manage", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/offers/{id}": {
    get: {
      tags: ["Offers"],
      summary: "Get offer",
      description: "Get a single offer by ID with fully resolved product and variant references. Requires `offers:read` scope.",
      operationId: "getOffer",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Offer details",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    offerSchema,
            },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "403": { 
          description: "Insufficient scope — requires offers:read", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "404": { 
          description: "Offer not found", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Offer with ID 123e4567-e89b-12d3-a456-426614174000 not found" },
              code: { type: "string", example: "OFFER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Offer" },
                  id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    patch: {
      tags: ["Offers"],
      summary: "Update offer",
      description: "Partially update an offer. All fields are optional — send only the fields you want to change. Requires `offers:manage` scope.",
      operationId: "updateOffer",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json(offerWriteSchema),
      },
      responses: {
        "200": {
          description: "Updated offer",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    offerSchema,
            },
          }),
        },
        "400": { 
          description: "Validation error", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", example: "triggerQuantity" },
                        message: { type: "string", example: "Trigger quantity must be at least 1" },
                        code: { type: "string", example: "too_small" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "403": { 
          description: "Insufficient scope — requires offers:manage", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "404": { 
          description: "Offer not found", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Offer with ID 123e4567-e89b-12d3-a456-426614174000 not found" },
              code: { type: "string", example: "OFFER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Offer" },
                  id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    delete: {
      tags: ["Offers"],
      summary: "Delete offer",
      description: "Permanently delete an offer. Already-placed orders are not affected. Requires `offers:manage` scope.",
      operationId: "deleteOffer",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Offer deleted",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true } },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "403": { 
          description: "Insufficient scope — requires offers:manage", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
            },
          }),
        },
        "404": { 
          description: "Offer not found", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Offer with ID 123e4567-e89b-12d3-a456-426614174000 not found" },
              code: { type: "string", example: "OFFER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Offer" },
                  id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
