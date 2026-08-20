/**
 * Product Groups OpenAPI Paths
 */

const categorySchema = { $ref: "#/components/schemas/ProductCategory" };
const errorResponseSchema = { $ref: "#/components/schemas/ErrorResponse" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

export const productGroupPaths = {
  "/api/product-groups": {
    get: {
      tags: ["Product Groups"],
      summary: "List product groups",
      description: "Get all product categories/groups",
      operationId: "listProductGroups",
      parameters: [
        { name: "search", in: "query", description: "Search by name", schema: { type: "string" } },
        { name: "parentId", in: "query", description: "Filter by parent group", schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "List of product groups",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: categorySchema },
              count: { type: "integer" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing product_groups:read scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Product Groups"],
      summary: "Create product group",
      operationId: "createProductGroup",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string", example: "Electronics" },
                slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", example: "electronics" },
                description: { type: "string", nullable: true },
                parentId: { type: "string", nullable: true },
                imageUrl: { type: "string", format: "uri", nullable: true },
                position: { type: "integer", minimum: 0, default: 0 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Group created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: categorySchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing product_groups:manage scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/product-groups/{id}": {
    get: {
      tags: ["Product Groups"],
      summary: "Get product group",
      operationId: "getProductGroup",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Group details with children and product count",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: categorySchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing product_groups:read scope", content: json(errorResponseSchema) },
        "404": {
          description: "Product group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Product Group with ID group_123 not found" },
              code: { type: "string", example: "PRODUCT_GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Product Group" },
                  id: { type: "string", example: "group_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Product Groups"],
      summary: "Update product group",
      description: "Partial update — only include fields you want to change.",
      operationId: "updateProductGroup",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
                description: { type: "string", nullable: true },
                parentId: { type: "string", nullable: true },
                imageUrl: { type: "string", format: "uri", nullable: true },
                position: { type: "integer", minimum: 0 },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Group updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: categorySchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing product_groups:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Product group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Product Group with ID group_123 not found" },
              code: { type: "string", example: "PRODUCT_GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Product Group" },
                  id: { type: "string", example: "group_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Product Groups"],
      summary: "Delete product group",
      operationId: "deleteProductGroup",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Group deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing product_groups:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Product group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Product Group with ID group_123 not found" },
              code: { type: "string", example: "PRODUCT_GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Product Group" },
                  id: { type: "string", example: "group_123" },
                },
              },
            },
          }),
        },
        "422": {
          description: "Product group has existing products - cannot delete",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot delete product group with existing products" },
              code: { type: "string", example: "PRODUCT_GROUP_HAS_PRODUCTS" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  groupId: { type: "string", example: "group_123" },
                  groupName: { type: "string", example: "Electronics" },
                  productsCount: { type: "integer", example: 5 },
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
