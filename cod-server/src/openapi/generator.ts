export function generateOpenAPISpec(baseUrl: string) {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "CodFlow API",
      version: "1.0.0",
      description: `
# CodFlow API Documentation

Complete API reference for CodFlow - the white-label e-commerce platform for Algerian businesses.

## Authentication

All API endpoints require authentication using an API key in the request header.

### Dashboard API
For dashboard/admin endpoints, include your API key in the \`X-API-Key\` header:

\`\`\`
X-API-Key: cod_your_api_key_here
\`\`\`

### Store API
For public storefront endpoints, include your store API key in the \`X-Store-API-Key\` header:

\`\`\`
X-Store-API-Key: sk_store_your_store_api_key_here
\`\`\`

## Error Responses

All errors follow a standardized format with an error message, error code, category, and optional context:

\`\`\`json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "category": "ERROR_CATEGORY",
  "context": {
    "additionalInfo": "value"
  }
}
\`\`\`

### Error Categories
- \`VALIDATION\`: Input validation failures (400)
- \`AUTHENTICATION\`: Missing or invalid credentials (401)
- \`BUSINESS_LOGIC\`: Business rule violations (404, 409, 422)
- \`SYSTEM\`: Server errors (500)

### Validation Errors
Validation errors (400) include field-level details in the context:

\`\`\`json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "category": "VALIDATION",
  "context": {
    "fields": [
      {
        "path": "name",
        "message": "Name is required",
        "code": "too_small"
      }
    ]
  }
}
\`\`\`

### Common HTTP Status Codes
- \`200\`: Success
- \`201\`: Created
- \`400\`: Bad Request — Invalid input or validation failure
- \`401\`: Unauthorized — Missing or invalid API key
- \`403\`: Forbidden — Insufficient permissions (missing scope)
- \`404\`: Not Found — Resource doesn't exist
- \`409\`: Conflict — Duplicate resource
- \`422\`: Unprocessable Entity — Business rule violation
- \`500\`: Internal Server Error

## Success Responses

All successful responses follow this format:

\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

For list endpoints, a count is included:

\`\`\`json
{
  "success": true,
  "data": [...],
  "count": 42
}
\`\`\`
      `.trim(),
    },
    servers: [
      {
        url: baseUrl,
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API key for authentication. Get your API key from the Developers section.",
        },
        StoreAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Store-API-Key",
          description: "Store API key for public storefront endpoints. Different from the dashboard API key.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Resource not found" },
            code: { type: "string", example: "RESOURCE_NOT_FOUND" },
            category: { type: "string", enum: ["VALIDATION", "AUTHENTICATION", "BUSINESS_LOGIC", "SYSTEM"], example: "BUSINESS_LOGIC" },
            context: {
              type: "object",
              additionalProperties: true,
              description: "Additional context about the error (optional)",
            },
          },
          required: ["error", "code", "category"],
        },

        ValidationError: {
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
                      code: { type: "string", example: "too_small" },
                    },
                    required: ["path", "message", "code"],
                  },
                },
              },
              required: ["fields"],
            },
          },
          required: ["error", "code", "category", "context"],
        },

        StatusHistoryItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            orderId: { type: "string" },
            status: {
              type: "string",
              enum: ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "returned", "cancelled"],
            },
            timestamp: { type: "string", format: "date-time" },
            by: { type: "string", nullable: true, description: "User ID who triggered the status change" },
            byName: { type: "string", nullable: true, description: "User display name" },
          },
        },
        Customer: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Ahmed Benali" },
            phone: { type: "string", example: "0551234567" },
            phone2: { type: "string", nullable: true },
            wilayaId: { type: "integer", minimum: 1, maximum: 58, nullable: true, description: "Official wilaya number (1–58)", example: 16 },
            communeId: { type: "string", nullable: true, description: "Commune UUID from reference table", example: "550e8400-e29b-41d4-a716-446655440000" },
            wilaya: {
              type: "string",
              description: "Wilaya Arabic name — denormalized display value, derived from wilayaId",
              example: "الجزائر",
            },
            commune: { type: "string", nullable: true, description: "Commune Arabic name — denormalized display value, derived from communeId", example: "بئر مراد رايس" },
            address: { type: "string", nullable: true },
            totalOrders: { type: "integer", example: 5, description: "Denormalized count, incremented on each order created" },
            totalSpent: { type: "number", example: 25000 },
            createdAt: { type: "string", format: "date-time" },
            lastOrderAt: { type: "string", format: "date-time", nullable: true },
            recentOrders: {
              type: "array",
              description: "Included only in GET /api/customers/{id} (up to 10 most recent orders). Not present in list responses.",
              items: { $ref: "#/components/schemas/Order" },
            },
          },
        },

        CustomerGroup: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Wholesale Customers" },
            description: { type: "string", nullable: true },
            color: { type: "string", example: "#6366f1" },
            memberCount: { type: "integer", example: 12, description: "Denormalized count, kept in sync on add/remove member" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            members: {
              type: "array",
              description: "Included only when `?members=true` is passed to GET /api/customer-groups/{id}.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                  wilaya: { type: "string" },
                  totalOrders: { type: "integer" },
                  totalSpent: { type: "number" },
                  assignedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },

        CustomerTag: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "VIP" },
            color: { type: "string", example: "#64748b" },
            assignmentCount: { type: "integer", example: 8, description: "Denormalized count, kept in sync on assign/unassign" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            customers: {
              type: "array",
              description: "Included only when `?customers=true` is passed to GET /api/customer-tags/{id}.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                  wilaya: { type: "string" },
                  totalOrders: { type: "integer" },
                  totalSpent: { type: "number" },
                  assignedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        OrderProduct: {
          type: "object",
          properties: {
            id: { type: "string" },
            orderId: { type: "string" },
            productId: { type: "string" },
            productName: { type: "string" },
            variantId: { type: "string", nullable: true },
            variantLabel: { type: "string", nullable: true },
            sku: { type: "string", nullable: true, description: "Denormalized SKU at time of order" },
            quantity: { type: "integer", example: 2 },
            pricePerUnit: { type: "number", example: 4500 },
            lineTotal: { type: "number", example: 9000 },
            status: {
              type: "string",
              enum: ["fulfilled", "partially_returned", "returned"],
              default: "fulfilled",
              description: "Per-line fulfilment outcome — updated via PATCH /orders/{id}/products/{productLineId}/return",
            },
            returnedQuantity: {
              type: "integer",
              default: 0,
              description: "Units the customer refused at the door. Always 0 when status=fulfilled, = quantity when status=returned.",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        Order: {
          type: "object",
          properties: {
            id: { type: "string" },
            orderNumber: { type: "string", example: "ORD-20260327-0042" },
            customerId: { type: "string" },
            customerName: { type: "string", example: "Ahmed Benali" },
            phone: { type: "string", example: "0551234567" },
            wilayaId: { type: "integer", minimum: 1, maximum: 58, nullable: true },
            wilaya: { type: "string", nullable: true, description: "Wilaya Arabic name, joined from reference table", example: "الجزائر" },
            communeId: { type: "string", nullable: true },
            commune: { type: "string", nullable: true, description: "Commune Arabic name, joined from reference table", example: "بئر مراد رايس" },
            city: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            price: { type: "number", example: 9000, description: "Product subtotal (excluding delivery fee)" },
            notes: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "returned", "cancelled"],
            },
            orderType: { type: "string", enum: ["online", "offline"] },
            deliveryMethod: { type: "string", enum: ["unassigned", "driver", "company"], description: "Default 'unassigned' at creation; flips to 'driver' or 'company' on assignment." },
            driverId: { type: "string", nullable: true },
            driverName: { type: "string", nullable: true, description: "Driver display name, joined from drivers table" },
            companyId: { type: "string", nullable: true },
            assignedAt: { type: "string", format: "date-time", nullable: true },
            assignedBy: { type: "string", nullable: true },
            assignmentNotes: { type: "string", nullable: true },
            trackingNumber: { type: "string", nullable: true },
            trackingUrl: { type: "string", nullable: true },
            externalOrderId: { type: "string", nullable: true },
            deliveryType: { type: "string", enum: ["home", "stop_desk"] },
            stationCode: { type: "string", nullable: true },
            deliveryFee: { type: "number", example: 400 },
            driverFee: { type: "number", example: 250, description: "What the store pays the driver for this delivery, looked up from driver_compensations by (driverId, wilayaId). 0 when no compensation row exists or no driver assigned." },
            codAmount: { type: "number", nullable: true, example: 9400, description: "Amount the driver collects from customer: price + deliveryFee" },
            pickupTime: { type: "string", format: "date-time", nullable: true },
            deliveryTime: { type: "string", format: "date-time", nullable: true },
            deliveryAttempts: { type: "integer", nullable: true },
            photos: { type: "string", nullable: true, description: "JSON array of photo URLs — delivery proof photos" },
            codPaymentId: { type: "string", nullable: true },
            feePaymentId: { type: "string", nullable: true },
            hasReview: { type: "integer", enum: [0, 1], description: "1 if a customer review exists for this order, 0 otherwise. Included in list responses only (GET /api/orders)." },
            lastUpdatedBy: { type: "string", nullable: true, description: "User ID of the last status-change actor. Included in list responses only (GET /api/orders)." },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            products: {
              type: "array",
              items: { $ref: "#/components/schemas/OrderProduct" },
              description: "Order line items. Included in GET /api/orders/{id} (detail view only).",
            },
            statusHistory: {
              type: "array",
              items: { $ref: "#/components/schemas/StatusHistoryItem" },
              description: "Full status change log. Included in GET /api/orders/{id} (detail view only).",
            },
          },
        },
        Driver: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string", example: "Mohamed" },
            lastName: { type: "string", example: "Amiri" },
            phone: { type: "string", example: "0661234567" },
            phone2: { type: "string", nullable: true },
            vehicleType: { type: "string", enum: ["motorcycle", "car", "van"], nullable: true },
            status: { type: "string", enum: ["available", "busy", "inactive"] },
            totalDelivered: { type: "integer", example: 142, description: "Incremented automatically when an order is marked delivered" },
            totalEarnings: { type: "number", example: 35500, description: "Cumulative driver earnings (DZD)" },
            pendingCash: { type: "number", example: 12000, description: "COD cash collected but not yet remitted to business" },
            totalPaid: { type: "number", example: 23500, description: "Cumulative cash remitted to business" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            compensationWilayaCount: {
              type: "integer",
              example: 1,
              description: "Number of wilayas with a configured per-delivery fee for this driver. Always present on every driver response.",
            },
            recentOrders: {
              type: "array",
              description: "Up to 10 most recent orders assigned to this driver. Included in single-driver responses (GET /api/drivers/{id}, POST /api/drivers, PATCH /api/drivers/{id}, PATCH /api/drivers/{id}/status). **Excluded** from the list response (GET /api/drivers).",
              items: { $ref: "#/components/schemas/Order" },
            },
          },
        },
        DriverPayment: {
          type: "object",
          properties: {
            id: { type: "string" },
            driverId: { type: "string" },
            type: { type: "string", enum: ["cod_remittance", "fee_payment", "net_settlement"] },
            amount: { type: "number", example: 15000 },
            orderCount: { type: "integer", example: 12 },
            notes: { type: "string", nullable: true },
            createdBy: { type: "string" },
            createdByName: { type: "string", example: "Ahmed Benali" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        DeliveryCompany: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Yalidine" },
            nameAr: { type: "string", example: "ياليدين" },
            code: { type: "string", example: "yalidine" },
            website: { type: "string", nullable: true },
            active: { type: "boolean" },
            apiEndpoint: { type: "string", nullable: true },
            isConnected: { type: "boolean", description: "True when API credentials (token/GUID) are stored. The credentials themselves are never returned in any response." },
            supportsHomeDelivery: { type: "boolean" },
            supportsStopDesk: { type: "boolean" },
            supportsTracking: { type: "boolean" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email", nullable: true },
            name: { type: "string", nullable: true, example: "Ahmed Benali" },
            role: { type: "string", enum: ["admin", "staff"] },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            scopes: {
              type: "array",
              items: { type: "string" },
              description: "['*'] for admin users, named permission scopes for staff",
              example: ["orders:read", "customers:read"],
            },
          },
        },
        Wilaya: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, maximum: 58, example: 16 },
            name: { type: "string", example: "Alger" },
            nameAr: { type: "string", example: "الجزائر" },
          },
        },

        Commune: {
          type: "object",
          properties: {
            id: { type: "string" },
            wilayaId: { type: "integer", example: 16 },
            name: { type: "string", example: "Bir Mourad Raïs" },
            nameAr: { type: "string", example: "بئر مراد رايس" },
            postalCode: { type: "string", nullable: true, example: "16012" },
          },
        },
        ProductCategory: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Electronics" },
            slug: { type: "string", example: "electronics" },
            description: { type: "string", nullable: true },
            parentId: { type: "string", nullable: true },
            imageUrl: { type: "string", nullable: true },
            position: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        Product: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Samsung Galaxy A54" },
            description: { type: "string", nullable: true },
            handle: { type: "string", example: "samsung-galaxy-a54" },
            currency: { type: "string", example: "DZD" },
            price: { type: "integer", example: 45000, description: "Price in DZD" },
            compareAtPrice: { type: "integer", nullable: true },
            costPrice: { type: "integer", nullable: true },
            type: { type: "string", enum: ["PHYSICAL", "DIGITAL"] },
            hasVariants: { type: "boolean" },
            variantOptions: {
              type: "array",
              nullable: true,
              description: "Parsed variant option axes. null for products without variants.",
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
            sku: { type: "string", nullable: true, description: "SKU for simple (non-variant) products" },
            inventory: { type: "integer", description: "Stock for simple products. Use totalInventory for variant products." },
            lowStockThreshold: { type: "integer", default: 5, description: "Low stock alert threshold for simple products. Alert fires when inventory ≤ this value. Per-variant threshold is set on each ProductVariant." },
            trackInventory: { type: "boolean" },
            categoryId: { type: "string", nullable: true },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tag list (parsed — not a raw JSON string)",
              example: ["sale", "new"],
            },
            visibility: { type: "boolean" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            showInStore: { type: "boolean" },
            storeFeatured: { type: "boolean" },
            shippingProfileId: { type: "string", nullable: true, description: "Shipping profile ID for this product. null if using default shipping profile." },
            publishedAt: { type: "string", format: "date-time", nullable: true },
            deletedAt: { type: "string", format: "date-time", nullable: true, description: "Non-null means soft-deleted. Never returned in list/detail responses." },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            category: {
              nullable: true,
              description: "Populated in GET /api/products/{id}. null if no category assigned.",
              allOf: [{ $ref: "#/components/schemas/ProductCategory" }],
            },
            variants: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductVariant" },
              description: "Included in all responses (empty array for simple products).",
            },
            images: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductImage" },
              description: "Included in GET /api/products/{id} only.",
            },
            variantsCount: { type: "integer", description: "Number of variants. Present in all product responses (list, detail, create)." },
            totalInventory: { type: "integer", description: "Sum of variant inventories for variant products; equals inventory for simple products. Present in all product responses (list, detail, create)." },
            primaryImageSrc: { type: "string", nullable: true, description: "src of the first image by position. Included in list responses." },
            reviewCount: { type: "integer", description: "Number of approved reviews for this product. Included in list responses.", example: 12 },
            avgRating: { type: "number", nullable: true, description: "Average star rating (1–5, rounded to 1 decimal) of approved reviews. null when no reviews exist. Included in list responses.", example: 4.3 },
          },
        },

        ProductVariant: {
          type: "object",
          properties: {
            id: { type: "string" },
            productId: { type: "string" },
            variations: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Key-value map of option name → selected value",
              example: { "Color": "Red", "Size": "M" },
            },
            currency: { type: "string", example: "DZD" },
            price: { type: "integer", example: 45000 },
            compareAtPrice: { type: "integer", nullable: true },
            sku: { type: "string", nullable: true },
            barcode: { type: "string", nullable: true },
            inventory: { type: "integer" },
            lowStockThreshold: { type: "integer", default: 5, description: "Low stock alert threshold for this variant. Alert fires when this variant's inventory ≤ this value." },
            weightKg: { type: "number", nullable: true },
            imageId: { type: "string", nullable: true },
            isDefault: { type: "boolean" },
            active: { type: "boolean" },
            position: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        ProductImage: {
          type: "object",
          properties: {
            id: { type: "string" },
            productId: { type: "string" },
            src: { type: "string", format: "uri" },
            r2Key: { type: "string", nullable: true },
            srcSm: { type: "string", nullable: true },
            srcMd: { type: "string", nullable: true },
            srcLg: { type: "string", nullable: true },
            altText: { type: "string", nullable: true },
            width: { type: "integer", nullable: true },
            height: { type: "integer", nullable: true },
            type: { type: "integer", description: "1=image, 2=video" },
            position: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ShippingProfile: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Standard Rates" },
            isDefault: { type: "boolean" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        ShippingRule: {
          type: "object",
          properties: {
            id: { type: "string" },
            profileId: { type: "string" },
            wilayaId: { type: "integer", minimum: 1, maximum: 58 },
            homePrice: { type: "number", example: 400 },
            stopDeskPrice: { type: "number", example: 350 },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ActivityLog: {
          type: "object",
          properties: {
            id: { type: "string" },
            actorId: { type: "string" },
            actorName: { type: "string", example: "Ahmed Benali" },
            actorRole: { type: "string", enum: ["admin", "staff"] },
            action: {
              type: "string",
              description: "Dot-notation action identifier. Valid values: `order.created`, `order.status_changed`, `order.driver_assigned`, `order.dispatched`, `order.deleted`, `customer.created`, `customer.updated`, `customer.deleted`, `customer_group.created`, `customer_group.updated`, `customer_group.deleted`, `customer_group.member_added`, `customer_group.member_removed`, `customer_tag.created`, `customer_tag.updated`, `customer_tag.deleted`, `customer_tag.assigned`, `customer_tag.unassigned`, `driver.created`, `driver.updated`, `driver.status_changed`, `driver.deleted`, `product.created`, `product.updated`, `product.status_changed`, `product.deleted`, `review.approved`, `review.rejected`, `review.deleted`, `user.created`, `user.updated`, `user.role_changed`, `user.scope_granted`, `user.scope_revoked`, `user.api_key_generated`, `user.api_key_revoked`",
              example: "order.created",
            },
            entityType: {
              type: "string",
              description: "Entity category the action applies to. Valid values: `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `review`, `user`",
              example: "order",
            },
            entityId: { type: "string" },
            entityLabel: { type: "string", nullable: true, example: "ORD-0042", description: "Human-readable label at the time of action (order number, customer name, etc.)" },
            metadata: {
              type: "string",
              nullable: true,
              description: "JSON-encoded extra context. Shape varies by action: `{ from, to }` for `order.status_changed`, `{ amount }` for payments, `{ scope }` for permission changes, `{ role }` for role changes, `{ rating, orderNumber }` for review actions",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Offer: {
          type: "object",
          description: "Buy X Get Y promotional offer. Auto-applied server-side when store orders meet trigger conditions.",
          properties: {
            id: { type: "string", description: "Offer UUID", example: "9eae51c0-8fd0-450c-9429-4a88b4ecf6ed" },
            name: { type: "string", example: "اشتري 2 واحصل على 1 مجاناً", description: "Merchant-facing display name" },
            status: { type: "string", enum: ["active", "inactive"], description: "Only active offers within schedule window are auto-applied", example: "active" },
            triggerQuantity: { type: "integer", minimum: 1, example: 2, description: "Minimum quantity of trigger product customer must order" },
            rewardQuantity: { type: "integer", minimum: 0, example: 1, description: "Number of free reward units added. 0 for free_shipping offers" },
            discountType: { type: "string", enum: ["free", "free_shipping"], description: "free = reward product at $0. free_shipping = delivery fee waived", example: "free" },
            startsAt: { type: "string", format: "date-time", nullable: true, description: "UTC ISO-8601 when offer becomes active. null = no start restriction", example: null },
            endsAt: { type: "string", format: "date-time", nullable: true, description: "UTC ISO-8601 when offer expires. null = no end restriction", example: null },
            createdAt: { type: "string", format: "date-time", example: "2026-04-15T15:24:53.031Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-15T15:24:53.031Z" },
            triggerProduct: {
              type: "object",
              description: "Product customer must purchase to trigger offer",
              properties: {
                id: { type: "string", example: "prod-4" },
                name: { type: "string", example: "ساعة أنيقة" },
                handle: { type: "string", example: "saaa-aneeka" },
              },
              required: ["id", "name", "handle"],
            },
            triggerVariant: {
              type: "object",
              nullable: true,
              description: "Specific variant required to trigger. null = any variant of trigger product",
              properties: {
                id: { type: "string", example: "var-1-1" },
                label: { type: "string", example: "أبيض / M" },
              },
            },
            rewardProduct: {
              type: "object",
              nullable: true,
              description: "Product customer receives for free. null for free_shipping offers",
              properties: {
                id: { type: "string", example: "prod-5" },
                name: { type: "string", example: "حقيبة يد" },
                handle: { type: "string", example: "haqiba-yad" },
              },
            },
            rewardVariant: {
              type: "object",
              nullable: true,
              description: "Specific variant given as reward. null = same as ordered or first active variant",
              properties: {
                id: { type: "string", example: "var-1-2" },
                label: { type: "string", example: "أسود / L" },
              },
            },
          },
          required: [
            "id", "name", "status", "triggerQuantity", "rewardQuantity", "discountType",
            "startsAt", "endsAt", "createdAt", "updatedAt",
            "triggerProduct", "triggerVariant", "rewardProduct", "rewardVariant"
          ],
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    paths: {},
  };

  return spec;
}
