/**
 * Store API OpenAPI Paths
 *
 * All store endpoints require the X-Store-API-Key header.
 * This key is issued per storefront (cod-astro/theme01) via STORE_API_KEY env var.
 * It is different from the dashboard X-API-Key used by the management API.
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });
const storeAuth = [{ StoreAuth: [] }];

/** ProductImage as returned by store endpoints */
const storeImageSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    src: { type: "string", format: "uri" },
    srcSm: { type: "string", nullable: true },
    srcMd: { type: "string", nullable: true },
    srcLg: { type: "string", nullable: true },
    altText: { type: "string", nullable: true },
    position: { type: "integer" },
  },
};

/**
 * Store product as returned by GET /store/products (list).
 * Shape differs from the dashboard Product schema:
 *   - has `coverImage` (first image by position, or null) instead of `primaryImageSrc`
 *   - has `reviewStats` (avg rating + count of approved reviews, or null)
 *   - does NOT have `variantsCount`, `totalInventory`, or `images`
 *   - `variantOptions` and `tags` are raw DB values (JSON strings) in the list
 */
const storeProductListSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string", example: "Samsung Galaxy A54" },
    description: { type: "string", nullable: true },
    handle: { type: "string", example: "samsung-galaxy-a54" },
    currency: { type: "string", example: "DZD" },
    price: { type: "number", example: 45000 },
    compareAtPrice: { type: "number", nullable: true },
    costPrice: { type: "number", nullable: true, description: "Internal cost price for merchant reference" },
    type: { type: "string", enum: ["PHYSICAL", "DIGITAL"] },
    hasVariants: { type: "boolean" },
    variantOptions: { type: "string", nullable: true, description: "Raw JSON string — parsed before use" },
    sku: { type: "string", nullable: true },
    inventory: { type: "integer" },
    trackInventory: { type: "boolean" },
    lowStockThreshold: { type: "integer", description: "Threshold for low stock warnings" },
    categoryId: { type: "string", nullable: true },
    tags: { type: "string", nullable: true, description: "Raw JSON string array — parsed before use" },
    visibility: { type: "boolean" },
    status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
    showInStore: { type: "boolean" },
    storeFeatured: { type: "boolean" },
    deletedAt: { type: "string", format: "date-time", nullable: true },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    coverImage: {
      nullable: true,
      description: "First image by position, or null if no images",
      allOf: [storeImageSchema],
    },
    reviewStats: {
      nullable: true,
      description: "Aggregate review stats (approved reviews only). null if no approved reviews exist for this product.",
      type: "object",
      properties: {
        avgRating:   { type: "number",  example: 4.5, description: "Average rating (1.0–5.0, rounded to 1 decimal)" },
        reviewCount: { type: "integer", example: 12,  description: "Number of approved reviews" },
      },
    },
  },
};

/**
 * Store product as returned by GET /store/products/{handle} (detail).
 * Shape differs from the list response:
 *   - `variantOptions` is parsed (array or null)
 *   - `tags` is parsed (string array)
 *   - includes `category`, `variants`, `images`, `reviewStats`
 *   - does NOT include `coverImage`
 */
const storeProductDetailSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string", example: "Samsung Galaxy A54" },
    description: { type: "string", nullable: true },
    handle: { type: "string", example: "samsung-galaxy-a54" },
    currency: { type: "string", example: "DZD" },
    price: { type: "number", example: 45000 },
    compareAtPrice: { type: "number", nullable: true },
    costPrice: { type: "number", nullable: true, description: "Internal cost price for merchant reference" },
    type: { type: "string", enum: ["PHYSICAL", "DIGITAL"] },
    hasVariants: { type: "boolean" },
    variantOptions: {
      type: "array",
      nullable: true,
      description: "Parsed variant option axes. null for simple products.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", example: "Color" },
          values: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string", example: "Red" },
                hexColor: { type: "string", nullable: true, example: "#FF0000" },
              },
            },
          },
        },
      },
    },
    sku: { type: "string", nullable: true },
    inventory: { type: "integer" },
    trackInventory: { type: "boolean" },
    lowStockThreshold: { type: "integer", description: "Threshold for low stock warnings" },
    categoryId: { type: "string", nullable: true },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Parsed tag list",
      example: ["sale", "new"],
    },
    visibility: { type: "boolean" },
    status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
    showInStore: { type: "boolean" },
    storeFeatured: { type: "boolean" },
    deletedAt: { type: "string", format: "date-time", nullable: true },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    category: {
      nullable: true,
      description: "Joined category, or null if no category assigned.",
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string", nullable: true },
        parentId: { type: "string", nullable: true, description: "Parent category ID for nested categories" },
        imageUrl: { type: "string", nullable: true },
        position: { type: "integer" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    variants: {
      type: "array",
      description: "Active variants ordered by position. Empty array for simple products.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          variations: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Parsed key-value map of option name → value",
            example: { "Color": "Red", "Size": "M" },
          },
          currency: { type: "string", example: "DZD" },
          price: { type: "number", example: 45000 },
          compareAtPrice: { type: "number", nullable: true },
          sku: { type: "string", nullable: true },
          barcode: { type: "string", nullable: true },
          inventory: { type: "integer" },
          lowStockThreshold: { type: "integer" },
          weightKg: { type: "number", nullable: true },
          imageId: { type: "string", nullable: true },
          isDefault: { type: "boolean" },
          active: { type: "boolean" },
          position: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
    images: {
      type: "array",
      description: "All product images ordered by position.",
      items: storeImageSchema,
    },
    reviewStats: {
      nullable: true,
      description: "Aggregate review stats (approved reviews only). null if no approved reviews exist for this product.",
      type: "object",
      properties: {
        avgRating:   { type: "number",  example: 4.5, description: "Average rating (1.0–5.0, rounded to 1 decimal)" },
        reviewCount: { type: "integer", example: 12,  description: "Number of approved reviews" },
      },
    },
    offers: {
      type: "array",
      description: "Active Buy X Get Y offers currently applicable to this product. Only includes offers where `status=active` and the current time is within the optional schedule window. The storefront uses this list to display offer banners and to show the free reward row in the order summary when the customer selects a matching variant and quantity.",
      items: {
        type: "object",
        properties: {
          id:   { type: "string", description: "Offer UUID" },
          name: { type: "string", example: "اشتري 2 واحصل على 1 مجاناً", description: "Merchant-facing offer name — display as the offer banner title." },
          discountType: {
            type: "string",
            enum: ["free", "free_shipping"],
            description: "`free` = Buy X Get Y (reward product added at $0). `free_shipping` = delivery fee waived for this order.",
          },
          triggerQuantity: {
            type: "integer",
            example: 2,
            description: "Minimum quantity the customer must order to trigger the offer.",
          },
          triggerVariantId: {
            type: "string",
            nullable: true,
            description: "Trigger variant restriction. null = offer applies to any variant. When non-null, the offer only activates if the customer selects this specific variant.",
          },
          rewardQuantity: {
            type: "integer",
            example: 1,
            description: "Number of free units of the reward product added to the order.",
          },
          rewardProductId:   { type: "string", description: "UUID of the product given for free." },
          rewardProductName: { type: "string", example: "Samsung Galaxy A54", description: "Display name of the reward product." },
          rewardVariantId: {
            type: "string",
            nullable: true,
            description: "UUID of the specific reward variant. null = server resolves automatically (same variant as ordered when same product, or first active variant when different product).",
          },
          rewardVariantLabel: {
            type: "string",
            nullable: true,
            description: "Human-readable reward variant label (e.g. 'أزرق / 128 GB'). null when no specific variant is fixed.",
          },
        },
        required: [
          "id", "name", "discountType", "triggerQuantity", "triggerVariantId",
          "rewardQuantity", "rewardProductId", "rewardProductName",
          "rewardVariantId", "rewardVariantLabel",
        ],
      },
    },
  },
};

export const storePaths = {
  "/store/config": {
    get: {
      tags: ["Store API"],
      summary: "Get store configuration",
      description: "Get store settings used by the storefront (theme, locale, branding). Requires X-Store-API-Key.",
      operationId: "getStoreConfig",
      security: storeAuth,
      responses: {
        "200": {
          description: "Store configuration",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Store UUID" },
                  name: { type: "string", example: "متجري" },
                  domain: { type: "string", nullable: true },
                  logoUrl: { type: "string", nullable: true },
                  themeId: { type: "string", example: "theme01" },
                  primaryColor: { type: "string", example: "#3a58ee" },
                  accentColor: { type: "string", example: "#f59e0b" },
                  bgColor: { type: "string", example: "#f8f8f8" },
                  fontFamily: { type: "string", example: "Cairo, sans-serif" },
                  fontUrl: { type: "string", nullable: true, description: "Google Fonts CSS URL override" },
                  lang: { type: "string", enum: ["ar", "en"] },
                  currency: { type: "string", example: "DZD" },
                  currencySymbol: { type: "string", example: "دج" },
                  contentJson: {
                    type: "string",
                    nullable: true,
                    description: "JSON blob of storefront text overrides (StoreFrontContent partial). null = use theme defaults.",
                  },
                  metaTitle: { type: "string", nullable: true },
                  metaDescription: { type: "string", nullable: true },
                  ogImage: { type: "string", nullable: true },
                  announcementBar: { type: "string", nullable: true },
                  reviewsEnabled: { type: "boolean", example: true, description: "When false, the reviews section is hidden on the storefront" },
                  status: { type: "string", enum: ["active", "inactive"] },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
        "404": {
          description: "Store not found for this API key",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Store with ID store_123 not found" },
              code: { type: "string", example: "STORE_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Store" },
                  id: { type: "string", example: "store_123" },
                },
              },
            },
          }),
        },
      },
    },
  },

  "/store/products": {
    get: {
      tags: ["Store API"],
      summary: "List store products",
      description: "Get the public product catalog for the storefront. Only returns products where `status=ACTIVE`, `showInStore=true`, `visibility=true`, and `deletedAt=null`. Requires X-Store-API-Key.",
      operationId: "listStoreProducts",
      security: storeAuth,
      parameters: [
        {
          name: "featured",
          in: "query",
          description: "When true, only return products where `storeFeatured=true`.",
          schema: { type: "boolean" },
        },
        {
          name: "categoryId",
          in: "query",
          description: "Filter by category ID.",
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          description: "Maximum number of products to return. Server cap: 100.",
          schema: { type: "integer", default: 24, maximum: 100 },
        },
      ],
      responses: {
        "200": {
          description: "List of products",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: storeProductListSchema },
              count: { type: "integer", description: "Number of items in `data`" },
            },
          }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },
  },

  "/store/products/{handle}": {
    get: {
      tags: ["Store API"],
      summary: "Get store product",
      description: "Get a single product by its URL handle. Only returns products where `status=ACTIVE`, `showInStore=true`, `visibility=true`, and `deletedAt=null` — the same filters as the list endpoint. Returns parsed `variantOptions`, `tags`, joined `category`, active `variants`, all `images`, and `offers` — the list of active Buy X Get Y promotions currently applicable to this product. Requires X-Store-API-Key.",
      operationId: "getStoreProduct",
      security: storeAuth,
      parameters: [
        { name: "handle", in: "path", required: true, schema: { type: "string", example: "samsung-galaxy-a54" } },
      ],
      responses: {
        "200": {
          description: "Product details",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: storeProductDetailSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
        "404": {
          description: "Product not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Product with ID samsung-galaxy-a54 not found" },
              code: { type: "string", example: "PRODUCT_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Product" },
                  id: { type: "string", example: "samsung-galaxy-a54" },
                },
              },
            },
          }),
        },
      },
    },
  },

  "/store/categories": {
    get: {
      tags: ["Store API"],
      summary: "List store categories",
      description: "Get product categories ordered by position. Requires X-Store-API-Key.",
      operationId: "listStoreCategories",
      security: storeAuth,
      responses: {
        "200": {
          description: "List of categories",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string", example: "Electronics" },
                    slug: { type: "string", example: "electronics" },
                    description: { type: "string", nullable: true },
                    parentId: { type: "string", nullable: true, description: "Parent category ID for nested categories" },
                    imageUrl: { type: "string", nullable: true },
                    position: { type: "integer" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
              count: { type: "integer", description: "Number of items in `data`" },
            },
          }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },
  },

  "/store/shipping-rates": {
    get: {
      tags: ["Store API"],
      summary: "Get shipping rates",
      description: "Get per-wilaya shipping rates for the order form. Returns all wilayas that have a rule in the default shipping profile. Wilayas without a rule are absent from the map (treat as unknown/free). Requires X-Store-API-Key.",
      operationId: "getShippingRates",
      security: storeAuth,
      responses: {
        "200": {
          description: "Shipping rates keyed by wilaya ID (as string)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                description: "Map of wilayaId (string) → { home, stopDesk } prices in DZD. Empty object if no default shipping profile exists.",
                example: { "16": { "home": 400, "stopDesk": 350 }, "31": { "home": 500, "stopDesk": 400 } },
                additionalProperties: {
                  type: "object",
                  properties: {
                    home: { type: "number", description: "Home delivery price (DZD)", example: 400 },
                    stopDesk: { type: "number", description: "Stop-desk / post-office pickup price (DZD)", example: 350 },
                  },
                  required: ["home", "stopDesk"],
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },
  },

  "/store/communes/{wilayaId}": {
    get: {
      tags: ["Store API"],
      summary: "List communes for a wilaya",
      description: "Get all communes for a given wilaya. Use the returned `id` as `communeId` when submitting an order. Requires X-Store-API-Key.",
      operationId: "listStoreCommunes",
      security: storeAuth,
      parameters: [
        {
          name: "wilayaId",
          in: "path",
          required: true,
          description: "Wilaya number (1–58).",
          schema: { type: "integer", minimum: 1, maximum: 58, example: 16 },
        },
      ],
      responses: {
        "200": {
          description: "List of communes for the wilaya",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Commune ID — use as `communeId` in POST /store/orders. Format is not UUID.",
                      example: "c-16-001",
                    },
                    name: { type: "string", example: "Bab El Oued" },
                    nameAr: { type: "string", example: "باب الوادي" },
                  },
                  required: ["id", "name", "nameAr"],
                },
              },
              count: { type: "integer" },
            },
          }),
        },
        "400": { description: "Invalid wilaya ID — must be 1–58", content: json({
          type: "object",
          properties: {
            error: { type: "string", example: "Invalid wilaya ID — must be an integer between 1 and 58" },
            code: { type: "string", example: "VALUE_OUT_OF_RANGE" },
            category: { type: "string", example: "VALIDATION" },
            context: {
              type: "object",
              properties: {
                wilayaId: { type: "number", example: 99 },
                min: { type: "number", example: 1 },
                max: { type: "number", example: 58 },
              },
            },
          },
        }) },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },
  },

  "/store/orders": {
    post: {
      tags: ["Store API"],
      summary: "Create store order",
      description: `Submit a customer order from the public storefront. Finds or creates the customer by phone number. Delivery fee is resolved from the default shipping profile.

**Offer selection:**
Send the \`offerId\` field to explicitly select the offer tier the customer chose (as shown in the storefront). The server validates the offer is still active and the quantity qualifies; if not, it falls back to auto-detecting the best applicable offer. When no \`offerId\` is sent, the server picks the offer with the highest \`triggerQuantity\` that the order satisfies.

**Buy X Get Y (\`discountType: "free"\`):**
The reward product is appended as a \`$0\` line item. If the reward product/variant is out of stock, the offer is silently skipped and the order still succeeds. The response \`total\` reflects only the paid product + delivery fee.

**Free Shipping (\`discountType: "free_shipping"\`):**
The delivery fee is overridden to 0 — this is reflected in both \`deliveryFee\` and \`total\` in the response.

**Multi-unit variant orders:**
When the customer buys multiple units and selects a different variant per unit (e.g. 1× Red + 1× Blue), send \`variantSelections\` — an array with one entry per unit. The server groups identical variants into a single order line and deducts inventory per-variant. If \`variantSelections\` is omitted, \`variantId\` is used for all units.

Requires X-Store-API-Key.`,
      operationId: "createStoreOrder",
      security: storeAuth,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["customerName", "phone", "wilayaId", "communeId", "productId", "productName", "pricePerUnit"],
              properties: {
                customerName: { type: "string", minLength: 2, maxLength: 100, example: "أحمد بن علي" },
                phone: {
                  type: "string",
                  minLength: 9,
                  maxLength: 20,
                  description: "Customer phone number. Must contain only digits, spaces, + or -.",
                  example: "0551234567",
                },
                wilayaId: { type: "integer", minimum: 1, maximum: 58, example: 16 },
                communeId: {
                  type: "string",
                  minLength: 1,
                  description: "Commune ID from GET /store/communes/{wilayaId}. Not a UUID — use the exact `id` value returned by that endpoint.",
                  example: "c-16-001",
                },
                address: { type: "string", maxLength: 300, description: "Optional street address" },
                deliveryType: {
                  type: "string",
                  enum: ["home", "stop_desk"],
                  default: "home",
                  description: "home = door delivery, stop_desk = post office pickup",
                },
                productId: {
                  type: "string",
                  minLength: 1,
                  maxLength: 200,
                  description: "Product ID from the store catalog.",
                },
                productName: { type: "string", minLength: 1, maxLength: 200 },
                variantId: {
                  type: "string",
                  minLength: 1,
                  description: "Variant ID if the product has variants. Omit or send empty string for simple products.",
                },
                variantLabel: {
                  type: "string",
                  maxLength: 100,
                  description: "Human-readable variant label (e.g. 'Red / L'). Stored for display in the dashboard.",
                },
                quantity: { type: "integer", minimum: 1, maximum: 100, default: 1 },
                pricePerUnit: {
                  type: "number",
                  exclusiveMinimum: 0,
                  description: "Price per unit in the store currency (DZD). Must be positive.",
                  example: 4500,
                },
                notes: { type: "string", maxLength: 500 },
                offerId: {
                  type: "string",
                  description: "Explicit offer ID selected by the customer (from GET /store/products/{handle} → offers[].id). When present the server validates and applies this exact offer. Omit or send empty string for the base tier (no offer).",
                },
                variantSelections: {
                  type: "array",
                  description: "Per-unit variant selections for multi-unit offers. One entry per ordered unit. When present, the server groups identical variants into single order lines and deducts inventory per-variant. Ignored when `offerId` is the base tier or for simple products.",
                  items: {
                    type: "object",
                    required: ["variantId"],
                    properties: {
                      variantId:    { type: "string", description: "Variant ID for this unit." },
                      variantLabel: { type: "string", description: "Human-readable label for this unit's variant (e.g. 'Red / M'). Stored for display in the dashboard." },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Order created successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  orderNumber: {
                    type: "string",
                    example: "ORD-20260327-0042",
                    description: "Unique order reference in format ORD-{YYYYMMDD}-{random4}",
                  },
                  price: {
                    type: "number",
                    example: 9000,
                    description: "Product subtotal (quantity × pricePerUnit). Excludes delivery fee and any free reward items.",
                  },
                  deliveryFee: { type: "number", example: 400, description: "Resolved from default shipping profile rule for this wilaya and deliveryType." },
                  total: { type: "number", example: 9400, description: "price + deliveryFee — the COD amount the customer pays on delivery. Free Buy X Get Y reward items are excluded from this total." },
                },
                required: ["orderNumber", "price", "deliveryFee", "total"],
              },
            },
          }),
        },
        "400": {
          description: "Validation error — request body did not pass schema validation",
          content: json({ $ref: "#/components/schemas/ValidationError" }),
        },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },
  },

  "/store/reviews": {
    get: {
      tags: ["Store API"],
      summary: "List approved reviews for a product",
      description: "Get approved product reviews for the storefront. Returns only reviews with `status=approved`. Requires X-Store-API-Key.",
      operationId: "listStoreReviews",
      security: storeAuth,
      parameters: [
        {
          name: "productId",
          in: "query",
          required: true,
          description: "Product ID to fetch reviews for.",
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20, maximum: 50 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        "200": {
          description: "List of approved reviews",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id:           { type: "string" },
                    customerName: { type: "string" },
                    rating:       { type: "integer", minimum: 1, maximum: 5 },
                    title:        { type: "string", nullable: true },
                    body:         { type: "string" },
                    createdAt:    { type: "string", format: "date-time" },
                  },
                },
              },
              count: { type: "integer" },
              total: { type: "integer", description: "Total approved reviews for this product" },
            },
          }),
        },
        "400": { description: "productId is required", content: json({
          type: "object",
          properties: {
            error: { type: "string", example: "productId is required" },
            code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
            category: { type: "string", example: "VALIDATION" },
            context: {
              type: "object",
              properties: {
                field: { type: "string", example: "productId" },
              },
            },
          },
        }) },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
      },
    },

    post: {
      tags: ["Store API"],
      summary: "Submit a product review",
      description: `Submit a product review from the storefront.

**Identifier (important):** the request takes the customer-facing **order number** (e.g. \`ORD-20260327-0042\`) — the same value shown on the thank-you page — not the internal UUID. The storefront form only ever asks the customer for this number, and the server resolves it to the underlying order internally before writing the review row.

Identity (customerName) is derived from the resolved order — no customer login required. One review per order: submitting a second review for the same order returns 409. Reviews are created with \`status=pending\` and require merchant approval before they appear publicly. Requires X-Store-API-Key.`,
      operationId: "submitStoreReview",
      security: storeAuth,
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["orderNumber", "productId", "rating", "body"],
          properties: {
            orderNumber: {
              type: "string",
              pattern: "^ORD-\\d{8}-\\d+$",
              example: "ORD-20260327-0042",
              description: "Customer-facing order reference (format `ORD-YYYYMMDD-NNNN`) — the same value returned by POST /store/orders and displayed on the thank-you page. Case-insensitive.",
            },
            productId: { type: "string", description: "Product ID being reviewed." },
            rating:    { type: "integer", minimum: 1, maximum: 5, example: 5 },
            title:     { type: "string", maxLength: 150, description: "Optional review title." },
            body:      { type: "string", minLength: 10, maxLength: 2000, example: "منتج رائع، جودة عالية!" },
          },
        }),
      },
      responses: {
        "201": {
          description: "Review submitted (pending moderation)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    { type: "object", properties: { id: { type: "string" } } },
            },
          }),
        },
        "400": { description: "Validation error — typically a malformed order number or missing/invalid field", content: json({
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
                      path:    { type: "string", example: "orderNumber" },
                      message: { type: "string", example: "Invalid order number format (expected ORD-YYYYMMDD-NNNN)" },
                      code:    { type: "string", example: "invalid_string" },
                    },
                  },
                },
              },
            },
          },
        }) },
        "401": { description: "Missing or invalid X-Store-API-Key", content: json(errorSchema) },
        "404": {
          description: "No order in this store matches the supplied order number",
          content: json({
            type: "object",
            properties: {
              error:    { type: "string", example: "Order with ID ORD-20260327-0042 not found" },
              code:     { type: "string", example: "ORDER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context:  {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Order" },
                  id:     { type: "string", example: "ORD-20260327-0042", description: "The order number that was not found." },
                },
              },
            },
          }),
        },
        "409": {
          description: "A review has already been submitted for this order",
          content: json({
            type: "object",
            properties: {
              error:    { type: "string", example: "A review has already been submitted for this order" },
              code:     { type: "string", example: "ORDER_ALREADY_REVIEWED" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context:  {
                type: "object",
                properties: {
                  orderNumber: { type: "string", example: "ORD-20260327-0042" },
                },
              },
            },
          }),
        },
      },
    },
  },
};
