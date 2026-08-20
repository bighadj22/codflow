/**
 * Variants OpenAPI Paths
 *
 * Product variants represent different configurations of a product (e.g., different colors, sizes).
 * Each variant has its own price, inventory, SKU, and other attributes.
 *
 * All routes require an API key with the appropriate products scope.
 */

const json = (schema: object) => ({ "application/json": { schema } });

/** Full variant object as returned by GET endpoints */
const variantSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Variant UUID" },
    productId: { type: "string", description: "Parent product UUID" },
    variations: {
      type: "object",
      additionalProperties: { type: "string" },
      example: { Color: "Red", Size: "M" },
      description: "Key-value pairs representing variant attributes (e.g., Color: Red, Size: M)",
    },
    price: {
      type: "integer",
      minimum: 0,
      example: 45000,
      description: "Price in DZD",
    },
    compareAtPrice: {
      type: "integer",
      minimum: 0,
      nullable: true,
      example: 50000,
      description: "Original price for showing discounts (DZD). null if no comparison price.",
    },
    sku: {
      type: "string",
      nullable: true,
      example: "GALAXY-A54-RED-M",
      description: "Stock Keeping Unit identifier. null if not set.",
    },
    barcode: {
      type: "string",
      nullable: true,
      example: "1234567890123",
      description: "Product barcode. null if not set.",
    },
    inventory: {
      type: "integer",
      minimum: 0,
      example: 10,
      description: "Current stock quantity",
    },
    lowStockThreshold: {
      type: "integer",
      minimum: 0,
      example: 5,
      description: "Threshold for low stock alerts",
    },
    weightKg: {
      type: "number",
      minimum: 0,
      nullable: true,
      example: 0.5,
      description: "Weight in kilograms. null if not set.",
    },
    imageId: {
      type: "string",
      nullable: true,
      description: "Image UUID for this variant. null if using product's default image.",
    },
    isDefault: {
      type: "boolean",
      example: false,
      description: "Whether this is the default variant for the product",
    },
    active: {
      type: "boolean",
      example: true,
      description: "Whether this variant is available for sale",
    },
    position: {
      type: "integer",
      minimum: 1,
      example: 1,
      description: "Display order position (1-based)",
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id", "productId", "variations", "price", "inventory",
    "lowStockThreshold", "isDefault", "active", "position",
    "createdAt", "updatedAt",
  ],
};

/** Request body for POST /api/products/:productId/variants */
const createVariantSchema = {
  type: "object",
  properties: {
    variations: {
      type: "object",
      additionalProperties: { type: "string" },
      example: { Color: "Red", Size: "M" },
      description: "Key-value pairs representing variant attributes",
    },
    price: {
      type: "integer",
      minimum: 0,
      example: 45000,
      description: "Price in DZD",
    },
    compareAtPrice: {
      type: "integer",
      minimum: 0,
      nullable: true,
      example: 50000,
      description: "Original price for showing discounts (DZD)",
    },
    sku: {
      type: "string",
      nullable: true,
      example: "GALAXY-A54-RED-M",
      description: "Stock Keeping Unit identifier",
    },
    barcode: {
      type: "string",
      nullable: true,
      example: "1234567890123",
      description: "Product barcode",
    },
    inventory: {
      type: "integer",
      minimum: 0,
      default: 0,
      example: 10,
      description: "Initial stock quantity",
    },
    lowStockThreshold: {
      type: "integer",
      minimum: 0,
      default: 5,
      example: 5,
      description: "Threshold for low stock alerts",
    },
    weightKg: {
      type: "number",
      minimum: 0,
      nullable: true,
      example: 0.5,
      description: "Weight in kilograms",
    },
    imageId: {
      type: "string",
      nullable: true,
      description: "Image UUID for this variant",
    },
    isDefault: {
      type: "boolean",
      default: false,
      example: false,
      description: "Whether this is the default variant",
    },
    active: {
      type: "boolean",
      default: true,
      example: true,
      description: "Whether this variant is available for sale",
    },
    position: {
      type: "integer",
      minimum: 1,
      default: 1,
      example: 1,
      description: "Display order position",
    },
  },
  required: ["variations", "price"],
};

/** Request body for PATCH /api/products/:productId/variants/:variantId */
const updateVariantSchema = {
  type: "object",
  properties: {
    variations: {
      type: "object",
      additionalProperties: { type: "string" },
      example: { Color: "Blue", Size: "L" },
      description: "Key-value pairs representing variant attributes",
    },
    price: {
      type: "integer",
      minimum: 0,
      example: 48000,
      description: "Price in centimes",
    },
    compareAtPrice: {
      type: "integer",
      minimum: 0,
      nullable: true,
      example: 55000,
      description: "Original price for showing discounts",
    },
    sku: {
      type: "string",
      nullable: true,
      example: "GALAXY-A54-BLUE-L",
      description: "Stock Keeping Unit identifier",
    },
    barcode: {
      type: "string",
      nullable: true,
      example: "1234567890124",
      description: "Product barcode",
    },
    inventory: {
      type: "integer",
      minimum: 0,
      example: 15,
      description: "Stock quantity",
    },
    lowStockThreshold: {
      type: "integer",
      minimum: 0,
      example: 3,
      description: "Threshold for low stock alerts",
    },
    weightKg: {
      type: "number",
      minimum: 0,
      nullable: true,
      example: 0.6,
      description: "Weight in kilograms",
    },
    imageId: {
      type: "string",
      nullable: true,
      description: "Image UUID for this variant",
    },
    isDefault: {
      type: "boolean",
      example: true,
      description: "Whether this is the default variant",
    },
    active: {
      type: "boolean",
      example: false,
      description: "Whether this variant is available for sale",
    },
    position: {
      type: "integer",
      minimum: 1,
      example: 2,
      description: "Display order position",
    },
  },
};

export const variantPaths = {
  "/api/products/{productId}/variants": {
    get: {
      tags: ["Variants"],
      summary: "List product variants",
      description: "Get all variants for a specific product ordered by position. Requires `products:read` scope.",
      operationId: "listVariants",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product UUID" },
      ],
      responses: {
        "200": {
          description: "List of variants",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: variantSchema },
              count: { type: "integer", example: 3, description: "Number of variants returned" },
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
          description: "Insufficient scope — requires products:read",
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
      tags: ["Variants"],
      summary: "Create product variant",
      description: "Create a new variant for a product. Each variant represents a different configuration (e.g., color, size) with its own price and inventory. Requires `products:manage` scope.",
      operationId: "createVariant",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product UUID" },
      ],
      requestBody: {
        required: true,
        content: json(createVariantSchema),
      },
      responses: {
        "201": {
          description: "Variant created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: variantSchema,
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
                        path: { type: "string", example: "price" },
                        message: { type: "string", example: "Price must be a non-negative integer" },
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
          description: "Insufficient scope — requires products:manage",
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

  "/api/products/{productId}/variants/{variantId}": {
    get: {
      tags: ["Variants"],
      summary: "Get variant",
      description: "Get a single variant by ID. Requires `products:read` scope.",
      operationId: "getVariant",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product UUID" },
        { name: "variantId", in: "path", required: true, schema: { type: "string" }, description: "Variant UUID" },
      ],
      responses: {
        "200": {
          description: "Variant details",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: variantSchema,
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
          description: "Insufficient scope — requires products:read",
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
          description: "Variant not found (code: VARIANT_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Variant with ID 550e8400-e29b-41d4-a716-446655440001 not found" },
              code: { type: "string", example: "VARIANT_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Variant" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    patch: {
      tags: ["Variants"],
      summary: "Update variant",
      description: "Partially update a variant. All fields are optional — send only the fields you want to change. Requires `products:manage` scope.",
      operationId: "updateVariant",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product UUID" },
        { name: "variantId", in: "path", required: true, schema: { type: "string" }, description: "Variant UUID" },
      ],
      requestBody: {
        required: true,
        content: json(updateVariantSchema),
      },
      responses: {
        "200": {
          description: "Updated variant",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: variantSchema,
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
                        path: { type: "string", example: "inventory" },
                        message: { type: "string", example: "Inventory must be a non-negative integer" },
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
          description: "Insufficient scope — requires products:manage",
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
          description: "Variant not found (code: VARIANT_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Variant with ID 550e8400-e29b-41d4-a716-446655440001 not found" },
              code: { type: "string", example: "VARIANT_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Variant" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    delete: {
      tags: ["Variants"],
      summary: "Delete variant",
      description: "Permanently deletes the variant. Any order line items referencing this variant will have their `variantId` set to `null` — order history is fully preserved. Requires `products:manage` scope.",
      operationId: "deleteVariant",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" }, description: "Product UUID" },
        { name: "variantId", in: "path", required: true, schema: { type: "string" }, description: "Variant UUID" },
      ],
      responses: {
        "200": {
          description: "Variant deleted",
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
          description: "Insufficient scope — requires products:manage",
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
          description: "Variant not found (code: VARIANT_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Variant with ID 550e8400-e29b-41d4-a716-446655440001 not found" },
              code: { type: "string", example: "VARIANT_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Variant" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
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
