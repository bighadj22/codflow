/**
 * Products OpenAPI Paths
 */

const productSchema = { $ref: "#/components/schemas/Product" };
const variantSchema = { $ref: "#/components/schemas/ProductVariant" };
const imageSchema = { $ref: "#/components/schemas/ProductImage" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// Error response examples for products endpoint
const productNotFoundError = {
  error: "Product with ID abc123 not found",
  code: "PRODUCT_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Product", id: "abc123" }
};

const productHasOrdersError = {
  error: "Cannot delete product with existing orders",
  code: "PRODUCT_HAS_ORDERS",
  category: "BUSINESS_LOGIC",
  context: { productId: "abc123", productName: "Samsung Galaxy A54" }
};

const duplicateSkuError = {
  error: 'Product with SKU "GALAXY-A54" already exists',
  code: "DUPLICATE_SKU",
  category: "BUSINESS_LOGIC",
  context: { sku: "GALAXY-A54", existingProductId: "xyz789" }
};

const variantNotFoundError = {
  error: "Variant with ID def456 not found",
  code: "VARIANT_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Variant", id: "def456" }
};

const variantOptionsProp = {
  type: "array",
  nullable: true,
  description: "Variant option axes. Optional — define when hasVariants is true.",
  items: {
    type: "object",
    required: ["name", "values"],
    properties: {
      name: { type: "string", example: "Color" },
      values: {
        type: "array",
        items: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "string", example: "Red" },
            hexColor: { type: "string", nullable: true, example: "#FF0000" },
          },
        },
      },
    },
  },
};

export const productPaths = {
  "/api/products": {
    get: {
      tags: ["Products"],
      summary: "List products",
      description: "Returns a paginated list of products. Soft-deleted products are never returned.",
      operationId: "listProducts",
      parameters: [
        { name: "categoryId", in: "query", description: "Filter by category ID", schema: { type: "string" } },
        {
          name: "status",
          in: "query",
          description: "Filter by status",
          schema: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
        },
        {
          name: "visibility",
          in: "query",
          description: "Filter by visibility. Pass `true` or `false` (string).",
          schema: { type: "string", enum: ["true", "false"] },
        },
        { name: "search", in: "query", description: "Search by name, handle, or description", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of products. Each item includes `variantsCount`, `totalInventory`, `primaryImageSrc`, and `variants` array.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: productSchema },
              count: { type: "integer" },
            },
          }),
        },
        "400": { description: "Invalid filter value e.g. unknown status (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Products"],
      summary: "Create product",
      operationId: "createProduct",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "price"],
              description: "SKU rules: simple products (`hasVariants=false`, the default) **must** include `sku`. Variant products (`hasVariants=true`) must omit `sku` here — set it on each variant via `POST /products/{productId}/variants`.",
              properties: {
                name: { type: "string", example: "Samsung Galaxy A54" },
                description: { type: "string", nullable: true },
                handle: { type: "string", description: "URL slug — auto-generated from name if not provided", example: "samsung-galaxy-a54" },
                price: { type: "integer", minimum: 0, description: "Price in DZD (smallest unit)", example: 45000 },
                compareAtPrice: { type: "integer", minimum: 0, nullable: true },
                costPrice: { type: "integer", minimum: 0, nullable: true },
                type: { type: "string", enum: ["PHYSICAL", "DIGITAL"], default: "PHYSICAL" },
                hasVariants: { type: "boolean", default: false },
                variantOptions: variantOptionsProp,
                sku: {
                  type: "string",
                  minLength: 1,
                  description: "**Required when `hasVariants=false` (default).** Must be unique across all products. Not used for variant products — each variant carries its own SKU.",
                  example: "GALAXY-A54",
                },
                inventory: { type: "integer", minimum: 0, default: 0 },
                lowStockThreshold: { type: "integer", minimum: 0, default: 5, description: "Alert when stock drops to this level. Ignored for variant products (threshold is per-variant)." },
                trackInventory: { type: "boolean", default: true },
                categoryId: { type: "string", nullable: true },
                shippingProfileId: { type: "string", nullable: true, description: "Shipping profile ID for this product. Omit or set to null to use the default shipping profile." },
                tags: { type: "array", items: { type: "string" } },
                visibility: { type: "boolean", default: true },
                status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "ACTIVE", description: "Setting to ACTIVE auto-sets publishedAt" },
                showInStore: { type: "boolean", default: true },
                storeFeatured: { type: "boolean", default: false },
              },
              if: { properties: { hasVariants: { const: false } } },
              then: { required: ["name", "price", "sku"] },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Product created. Returns full product record including variants and images (empty arrays for new products).",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: productSchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "409": { 
          description: "Duplicate SKU (DUPLICATE_SKU)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["DUPLICATE_SKU"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: duplicateSkuError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}": {
    get: {
      tags: ["Products"],
      summary: "Get product",
      operationId: "getProduct",
      description: "Returns full product detail including `category`, `variants`, and `images`.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Product detail",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: productSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:read scope", content: json(errorSchema) },
        "404": { 
          description: "Product not found (PRODUCT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: productNotFoundError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Products"],
      summary: "Update product",
      operationId: "updateProduct",
      description: "Partial update — only include fields you want to change. Setting `status` to `ACTIVE` auto-sets `publishedAt`. Send `variantOptions: null` to clear all variant options when converting a variant product to simple.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string", nullable: true },
                handle: { type: "string" },
                price: { type: "integer", minimum: 0 },
                compareAtPrice: { type: "integer", minimum: 0, nullable: true },
                costPrice: { type: "integer", minimum: 0, nullable: true },
                type: { type: "string", enum: ["PHYSICAL", "DIGITAL"] },
                hasVariants: { type: "boolean" },
                variantOptions: variantOptionsProp,
                sku: {
                  type: "string",
                  minLength: 1,
                  description: "**Required when setting `hasVariants=false`** (converting a variant product to simple). Cannot be cleared to null — if provided, must be a non-empty string.",
                },
                inventory: { type: "integer", minimum: 0 },
                lowStockThreshold: { type: "integer", minimum: 0, description: "Alert when stock drops to this level." },
                trackInventory: { type: "boolean" },
                categoryId: { type: "string", nullable: true },
                tags: { type: "array", items: { type: "string" } },
                visibility: { type: "boolean" },
                status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
                showInStore: { type: "boolean" },
                storeFeatured: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Product updated. Returns full updated product record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: productSchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Product not found (PRODUCT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: productNotFoundError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Products"],
      summary: "Delete product",
      operationId: "deleteProduct",
      description: "Soft-deletes the product by setting `deletedAt`. The product is excluded from all list and detail responses. **Returns 422 if the product has existing orders (PRODUCT_HAS_ORDERS).**",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Product deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Product deleted" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Product not found (PRODUCT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: productNotFoundError
          }) 
        },
        "422": { 
          description: "Cannot delete product with existing orders (PRODUCT_HAS_ORDERS)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_HAS_ORDERS"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: productHasOrdersError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/status": {
    patch: {
      tags: ["Products"],
      summary: "Update product status",
      operationId: "updateProductStatus",
      description: "Dedicated endpoint for status-only updates. Setting `ACTIVE` auto-sets `publishedAt`.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Status updated. Returns full updated product record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: productSchema,
            },
          }),
        },
        "400": { description: "Validation error (invalid status value)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Product not found (PRODUCT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: productNotFoundError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/images": {
    get: {
      tags: ["Products"],
      summary: "List product images",
      operationId: "listProductImages",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of product images ordered by position",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: imageSchema },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Products"],
      summary: "Save product image",
      operationId: "saveProductImage",
      description: "Associates an already-uploaded R2 image with a product. Upload the file first via `POST /api/images/upload`, then call this endpoint with the returned `key` and `url`.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["key", "src"],
              properties: {
                key: { type: "string", description: "R2 object key returned by the upload endpoint", example: "products/abc123def456.jpg" },
                src: { type: "string", format: "uri", description: "Public URL of the image", example: "https://cdn.example.com/products/abc123.jpg" },
                altText: { type: "string", nullable: true, description: "Alt text for accessibility" },
                position: { type: "integer", minimum: 1, description: "Display order (auto-appended at end if not provided)" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Image record created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: imageSchema,
            },
          }),
        },
        "400": { description: "Missing key or src", content: json(errorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/images/reorder": {
    patch: {
      tags: ["Products"],
      summary: "Reorder product images",
      operationId: "reorderProductImages",
      description: "Sets the display order of a product's images. Send the **complete** ordered array of image IDs — every existing image ID must be included exactly once. The server assigns `position` 1, 2, 3… based on the array order. Returns the full reordered image list.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["imageIds"],
              properties: {
                imageIds: {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: { type: "string" },
                  description: "Complete ordered list of all image IDs for this product. All existing image IDs must be included — no duplicates, no omissions.",
                  example: ["uuid-b", "uuid-a", "uuid-c"],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Images reordered successfully. Returns updated image list in new order.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: imageSchema },
            },
          }),
        },
        "400": {
          description: "Validation error — empty array, duplicate IDs, or image IDs that don't belong to this product, or incomplete set (must include all existing images)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "imageIds must include all existing image IDs for this product" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": {
          description: "Product not found (PRODUCT_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["PRODUCT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" },
            },
            example: productNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{id}/images/{imageId}": {
    delete: {
      tags: ["Products"],
      summary: "Delete product image",
      operationId: "deleteProductImage",
      description: "Deletes the image record from the database and removes the object from R2.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "imageId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Image deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": { description: "Image not found", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{productId}/variants": {
    get: {
      tags: ["Products"],
      summary: "List product variants",
      operationId: "listVariants",
      parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of variants ordered by position",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: variantSchema },
              count: { type: "integer" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Products"],
      summary: "Create product variant",
      operationId: "createVariant",
      parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["variations", "price", "sku"],
              properties: {
                variations: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  description: "Key-value map matching the product's variantOptions axes",
                  example: { "Color": "Red", "Size": "M" },
                },
                price: { type: "integer", minimum: 0, description: "Price in DZD", example: 45000 },
                compareAtPrice: { type: "integer", minimum: 0, nullable: true },
                sku: { type: "string", description: "**Required.** Unique stock-keeping unit identifier for this variant. Used for order tracking and inventory management.", example: "GALAXY-A54-RED-M" },
                barcode: { type: "string", nullable: true },
                inventory: { type: "integer", minimum: 0, default: 0 },
                lowStockThreshold: { type: "integer", minimum: 0, default: 5, description: "Alert when this variant's stock drops to this level." },
                weightKg: { type: "number", minimum: 0, nullable: true },
                imageId: { type: "string", nullable: true, description: "Product image ID to associate with this variant" },
                isDefault: { type: "boolean", default: false },
                active: { type: "boolean", default: true },
                position: { type: "integer", minimum: 1, default: 1 },
              },
            },
          },
        },
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
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/products/{productId}/variants/{variantId}": {
    get: {
      tags: ["Products"],
      summary: "Get product variant",
      operationId: "getVariant",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" } },
        { name: "variantId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Variant detail",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: variantSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:read scope", content: json(errorSchema) },
        "404": { 
          description: "Variant not found (VARIANT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["VARIANT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: variantNotFoundError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Products"],
      summary: "Update product variant",
      operationId: "updateVariant",
      description: "Partial update — only include fields you want to change.",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" } },
        { name: "variantId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                variations: { type: "object", additionalProperties: { type: "string" } },
                price: { type: "integer", minimum: 0 },
                compareAtPrice: { type: "integer", minimum: 0, nullable: true },
                sku: { type: "string", minLength: 1, description: "Non-empty SKU string. Cannot be cleared to null — if provided, must be a non-empty string." },
                barcode: { type: "string", nullable: true },
                inventory: { type: "integer", minimum: 0 },
                lowStockThreshold: { type: "integer", minimum: 0, description: "Alert when this variant's stock drops to this level." },
                weightKg: { type: "number", minimum: 0, nullable: true },
                imageId: { type: "string", nullable: true },
                isDefault: { type: "boolean" },
                active: { type: "boolean" },
                position: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Variant updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: variantSchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Variant not found (VARIANT_NOT_FOUND)", 
          content: json({ 
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["VARIANT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" }
            },
            example: variantNotFoundError
          }) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Products"],
      summary: "Delete product variant",
      operationId: "deleteVariant",
      description: "Permanently deletes the variant. Any order line items referencing this variant will have their `variantId` set to `null` — order history is fully preserved.",
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "string" } },
        { name: "variantId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Variant deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "404": {
          description: "Variant not found (VARIANT_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string", enum: ["VARIANT_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context: { type: "object" },
            },
            example: variantNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
