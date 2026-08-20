/**
 * Stock Management OpenAPI Paths
 *
 * Endpoints for inventory tracking, movement logging, and stock health monitoring.
 * Read operations require `products:read` scope; write operations require `products:manage`.
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// ─── Error examples ───────────────────────────────────────────────────────────

const productNotFoundError = {
  error: "Product with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  code: "PRODUCT_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Product", id: "550e8400-e29b-41d4-a716-446655440000" },
};

const variantNotFoundError = {
  error: "Variant with ID 550e8400-e29b-41d4-a716-446655440001 not found",
  code: "VARIANT_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Variant", id: "550e8400-e29b-41d4-a716-446655440001" },
};

const insufficientStockExample = {
  error: "Insufficient stock for Samsung Galaxy A54. Available: 5, Required: 10",
  code: "INSUFFICIENT_STOCK",
  category: "BUSINESS_LOGIC",
  context: {
    stockId: "550e8400-e29b-41d4-a716-446655440000",
    productName: "Samsung Galaxy A54",
    available: 5,
    required: 10,
  },
};

// ─── Shared schemas ───────────────────────────────────────────────────────────

const movementTypeEnum = [
  "PURCHASE",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "ORDER_DEDUCTED",
  "ORDER_CANCELLED",
  "ORDER_RETURNED",
  "OFFLINE_SALE",
];

const stockMovementSchema = {
  type: "object",
  properties: {
    id:            { type: "string" },
    productId:     { type: "string" },
    variantId:     { type: "string", nullable: true },
    type:          { type: "string", enum: movementTypeEnum },
    delta:         { type: "integer", description: "Positive = stock in, negative = stock out. Never zero." },
    qtyBefore:     { type: "integer" },
    qtyAfter:      { type: "integer" },
    reason:        { type: "string", nullable: true },
    reference:     { type: "string", nullable: true, description: "orderId for ORDER_* movement types; null otherwise." },
    createdBy:     { type: "string" },
    createdByName: { type: "string" },
    createdAt:     { type: "string", format: "date-time" },
  },
};

const stockAlertItemSchema = {
  type: "object",
  properties: {
    productId:         { type: "string" },
    variantId:         { type: "string", nullable: true },
    productName:       { type: "string" },
    variantLabel:      { type: "string", nullable: true, example: "أحمر / M", description: "Concatenated variant option values, e.g. 'Red / M'. Null for simple products." },
    inventory:         { type: "integer" },
    lowStockThreshold: { type: "integer" },
    isOutOfStock:      { type: "boolean" },
  },
};

const notFoundSchema = (code: string) => ({
  type: "object",
  properties: {
    error:    { type: "string" },
    code:     { type: "string", enum: [code] },
    category: { type: "string", enum: ["BUSINESS_LOGIC"] },
    context:  { type: "object" },
  },
});

const insufficientStockSchema = {
  type: "object",
  properties: {
    error:    { type: "string" },
    code:     { type: "string", enum: ["INSUFFICIENT_STOCK"] },
    category: { type: "string", enum: ["BUSINESS_LOGIC"] },
    context: {
      type: "object",
      properties: {
        stockId:     { type: "string", description: "variantId if a variant, otherwise productId" },
        productName: { type: "string", nullable: true },
        available:   { type: "integer" },
        required:    { type: "integer" },
      },
    },
  },
};

export const stockPaths = {
  // ─── Global stock routes ─────────────────────────────────────────────────────

  "/api/stock/overview": {
    get: {
      tags: ["Stock"],
      summary: "Stock overview",
      description:
        "Returns aggregated inventory health metrics across all tracked SKUs. Includes counters, total inventory value, and segmented lists of out-of-stock and low-stock items. Requires `products:read` scope.",
      operationId: "getStockOverview",
      responses: {
        "200": {
          description: "Stock health overview",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  totalSkus:           { type: "integer", description: "Total number of tracked SKUs (simple + variants)." },
                  outOfStockCount:     { type: "integer" },
                  lowStockCount:       { type: "integer" },
                  totalInventoryValue: { type: "integer", description: "Sum of (inventory × price) across all tracked SKUs, in DZD." },
                  currency:            { type: "string", example: "DZD" },
                  outOfStockItems:     { type: "array", items: stockAlertItemSchema },
                  lowStockItems:       { type: "array", items: stockAlertItemSchema, description: "Items at or below their low stock threshold (but still in stock)." },
                  allItems: {
                    type: "array",
                    items: stockAlertItemSchema,
                    description: "Every tracked SKU. Sorted: out-of-stock first, then by inventory ascending. Used by the inventory table.",
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:read", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/stock/alerts": {
    get: {
      tags: ["Stock"],
      summary: "Low stock and out-of-stock alerts",
      description:
        "Paginated list of all SKUs at or below their low stock threshold (includes out-of-stock). Sorted: out-of-stock first, then by inventory ascending. Requires `products:read` scope.",
      operationId: "getStockAlerts",
      parameters: [
        { name: "limit",  in: "query", schema: { type: "integer", default: 50, minimum: 1, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0,  minimum: 0 } },
      ],
      responses: {
        "200": {
          description: "Paginated alert items",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  items: { type: "array", items: stockAlertItemSchema },
                  total: { type: "integer", description: "Total alert items (for pagination)." },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:read", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ─── Product-level stock routes ──────────────────────────────────────────────

  "/api/products/{id}/stock/adjust": {
    post: {
      tags: ["Stock"],
      summary: "Adjust stock for a simple product",
      description:
        "Applies a signed integer delta to a simple product's inventory and appends a movement log entry.\n\n" +
        "**`reason` is required for types:** `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, `OFFLINE_SALE`.\n\n" +
        "**Delta sign convention:** positive = stock arriving, negative = stock leaving. The server rejects adjustments that would result in negative inventory (HTTP 422).\n\n" +
        "Requires `products:manage` scope.",
      operationId: "adjustProductStock",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["type", "delta"],
          properties: {
            type: {
              type: "string",
              enum: movementTypeEnum,
              description: "Movement type. `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, and `OFFLINE_SALE` require a `reason`.",
            },
            delta: {
              type: "integer",
              description: "Non-zero signed integer. Positive = stock in, negative = stock out.",
              example: 10,
            },
            reason: {
              type: "string",
              maxLength: 500,
              description: "Required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE. Max 500 chars.",
            },
          },
        }),
      },
      responses: {
        "200": {
          description: "Stock adjusted successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  movement:         stockMovementSchema,
                  currentInventory: { type: "integer", description: "Inventory level after the adjustment." },
                },
              },
            },
          }),
        },
        "400": { description: "Validation error — invalid type, zero delta, or missing reason (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:manage", content: json(errorSchema) },
        "404": {
          description: "Product not found (PRODUCT_NOT_FOUND)",
          content: json({ ...notFoundSchema("PRODUCT_NOT_FOUND"), example: productNotFoundError }),
        },
        "422": {
          description: "Adjustment would result in negative inventory (INSUFFICIENT_STOCK). Context includes `stockId`, `productName`, `available`, and `required`.",
          content: json({ ...insufficientStockSchema, example: insufficientStockExample }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/stock/history": {
    get: {
      tags: ["Stock"],
      summary: "Stock movement history for a product",
      description:
        "Paginated movement log for a product. Use `variantId` to narrow to a specific variant's history. Results are ordered newest-first. Requires `products:read` scope.",
      operationId: "getProductStockHistory",
      parameters: [
        { name: "id",        in: "path",  required: true, schema: { type: "string" } },
        { name: "variantId", in: "query", schema: { type: "string" }, description: "Filter movements to a specific variant." },
        { name: "limit",     in: "query", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
        { name: "offset",    in: "query", schema: { type: "integer", default: 0, minimum: 0 } },
      ],
      responses: {
        "200": {
          description: "Paginated movement history",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  movements: { type: "array", items: stockMovementSchema },
                  total:     { type: "integer", description: "Total matching movements (for pagination)." },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:read", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/stock/threshold": {
    patch: {
      tags: ["Stock"],
      summary: "Update low stock threshold for a simple product",
      description:
        "Sets the `lowStockThreshold` for a simple (non-variant) product. When inventory drops at or below this value, the product appears in stock alerts. Requires `products:manage` scope.",
      operationId: "updateProductThreshold",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["lowStockThreshold"],
          properties: {
            lowStockThreshold: { type: "integer", minimum: 0, maximum: 9999, example: 5 },
          },
        }),
      },
      responses: {
        "200": {
          description: "Threshold updated",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "400": { description: "Validation error — non-integer, negative value, or value > 9999 (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:manage", content: json(errorSchema) },
        "404": {
          description: "Product not found (PRODUCT_NOT_FOUND)",
          content: json({ ...notFoundSchema("PRODUCT_NOT_FOUND"), example: productNotFoundError }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  // ─── Variant-level stock routes ──────────────────────────────────────────────

  "/api/products/{productId}/variants/{variantId}/stock/adjust": {
    post: {
      tags: ["Stock"],
      summary: "Adjust stock for a product variant",
      description:
        "Same semantics as the simple-product adjust endpoint but targets a specific variant. The `variantId` must belong to `productId`. Requires `products:manage` scope.",
      operationId: "adjustVariantStock",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" } },
        { name: "variantId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["type", "delta"],
          properties: {
            type:   { type: "string", enum: movementTypeEnum },
            delta:  { type: "integer", description: "Non-zero signed integer.", example: -2 },
            reason: { type: "string", maxLength: 500, description: "Required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE." },
          },
        }),
      },
      responses: {
        "200": {
          description: "Variant stock adjusted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  movement:         stockMovementSchema,
                  currentInventory: { type: "integer" },
                },
              },
            },
          }),
        },
        "400": { description: "Validation error — invalid type, zero delta, or missing reason (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:manage", content: json(errorSchema) },
        "404": {
          description: "Variant not found or does not belong to the given product (VARIANT_NOT_FOUND)",
          content: json({ ...notFoundSchema("VARIANT_NOT_FOUND"), example: variantNotFoundError }),
        },
        "422": {
          description: "Adjustment would result in negative inventory (INSUFFICIENT_STOCK)",
          content: json({ ...insufficientStockSchema, example: insufficientStockExample }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{productId}/variants/{variantId}/stock/threshold": {
    patch: {
      tags: ["Stock"],
      summary: "Update low stock threshold for a variant",
      description:
        "Sets the `lowStockThreshold` for a specific product variant. The variant must belong to the specified product. Requires `products:manage` scope.",
      operationId: "updateVariantThreshold",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" } },
        { name: "variantId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["lowStockThreshold"],
          properties: {
            lowStockThreshold: { type: "integer", minimum: 0, maximum: 9999, example: 5 },
          },
        }),
      },
      responses: {
        "200": {
          description: "Threshold updated",
          content: json({ type: "object", properties: { success: { type: "boolean", example: true } } }),
        },
        "400": { description: "Validation error — non-integer, negative value, or value > 9999 (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires products:manage", content: json(errorSchema) },
        "404": {
          description: "Variant not found or does not belong to the given product (VARIANT_NOT_FOUND)",
          content: json({ ...notFoundSchema("VARIANT_NOT_FOUND"), example: variantNotFoundError }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
