/**
 * Stores (Management) OpenAPI Paths
 *
 * These are the dashboard management endpoints for reading and updating
 * the store configuration. Require X-API-Key with settings:view scope.
 * Not to be confused with /api/store/* (storefront public API).
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// Error response examples
const storeNotFoundError = {
  error: "Store not found",
  code: "STORE_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: {
    entity: "Store"
  }
};

const validationError = {
  error: "Validation failed",
  code: "VALIDATION_FAILED",
  category: "VALIDATION",
  context: {
    fields: [
      {
        path: "primaryColor",
        message: "Invalid hex color",
        code: "invalid_string"
      }
    ]
  }
};

const storeSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "store_01" },
    name: { type: "string", example: "My Shop" },
    logoUrl: { type: "string", nullable: true, example: "https://cdn.example.com/logo.png" },
    primaryColor: { type: "string", example: "#3b82f6" },
    accentColor: { type: "string", example: "#f97316" },
    bgColor: { type: "string", example: "#ffffff" },
    fontFamily: { type: "string", example: "Cairo" },
    fontUrl: { type: "string", nullable: true, example: "https://fonts.googleapis.com/css2?family=Cairo" },
    lang: { type: "string", enum: ["ar", "en"], example: "ar" },
    currencySymbol: { type: "string", example: "دج" },
    contentJson: { type: "string", nullable: true, description: "Serialized JSON for storefront content blocks" },
    metaTitle: { type: "string", nullable: true, example: "My Shop — Best Products" },
    metaDescription: { type: "string", nullable: true, example: "Find the best products at My Shop." },
    ogImage: { type: "string", nullable: true, example: "https://cdn.example.com/og.png" },
    announcementBar: { type: "string", nullable: true, example: "Free delivery on orders above 3000 دج" },
    reviewsEnabled: { type: "boolean", example: true },
    status: { type: "string", enum: ["active", "inactive"], example: "active" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const storeMgmtPaths = {
  "/api/stores/me": {
    get: {
      tags: ["Store Settings"],
      summary: "Get store configuration",
      description: "Returns the current store's configuration including branding, localization, and storefront settings. Requires the `settings:view` scope.",
      operationId: "getMyStore",
      responses: {
        "200": {
          description: "Store configuration",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: storeSchema,
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
              category: { type: "string", example: "AUTHENTICATION" }
            }
          })
        },
        "403": { 
          description: "Missing settings:view scope", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" }
            }
          })
        },
        "404": { 
          description: "Store not found (STORE_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Store not found" },
              code: { type: "string", example: "STORE_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Store" }
                }
              }
            },
            example: storeNotFoundError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Store Settings"],
      summary: "Update store configuration",
      description: "Partially updates the store configuration. All fields are optional — only include the fields you want to change. Requires the `settings:view` scope.",
      operationId: "updateMyStore",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100, example: "My Shop" },
                logoUrl: { type: "string", format: "uri", nullable: true, example: "https://cdn.example.com/logo.png" },
                primaryColor: { type: "string", pattern: "^#[0-9a-fA-F]{3,8}$", example: "#3b82f6" },
                accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{3,8}$", example: "#f97316" },
                bgColor: { type: "string", pattern: "^#[0-9a-fA-F]{3,8}$", example: "#ffffff" },
                fontFamily: { type: "string", minLength: 1, maxLength: 200, example: "Cairo" },
                fontUrl: { type: "string", format: "uri", nullable: true, example: "https://fonts.googleapis.com/css2?family=Cairo" },
                lang: { type: "string", enum: ["ar", "en"], example: "ar" },
                currencySymbol: { type: "string", minLength: 1, maxLength: 10, example: "دج" },
                contentJson: { type: "string", nullable: true },
                metaTitle: { type: "string", maxLength: 200, nullable: true, example: "My Shop — Best Products" },
                metaDescription: { type: "string", maxLength: 500, nullable: true, example: "Find the best products at My Shop." },
                ogImage: { type: "string", format: "uri", nullable: true, example: "https://cdn.example.com/og.png" },
                announcementBar: { type: "string", maxLength: 500, nullable: true, example: "Free delivery on orders above 3000 دج" },
                reviewsEnabled: { type: "boolean", example: true },
                status: { type: "string", enum: ["active", "inactive"], example: "active" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Updated store configuration",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: storeSchema,
            },
          }),
        },
        "400": { 
          description: "Validation error (VALIDATION_FAILED)", 
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
                        path: { type: "string", example: "primaryColor" },
                        message: { type: "string", example: "Invalid hex color" },
                        code: { type: "string", example: "invalid_string" }
                      }
                    }
                  }
                }
              }
            },
            example: validationError
          })
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
              code: { type: "string", example: "INVALID_API_KEY" },
              category: { type: "string", example: "AUTHENTICATION" }
            }
          })
        },
        "403": { 
          description: "Missing settings:view scope", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" }
            }
          })
        },
        "404": { 
          description: "Store not found (STORE_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Store not found" },
              code: { type: "string", example: "STORE_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Store" }
                }
              }
            },
            example: storeNotFoundError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
