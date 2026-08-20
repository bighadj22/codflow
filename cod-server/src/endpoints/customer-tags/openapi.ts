/**
 * Customer Tags OpenAPI Paths
 */

const tagSchema = { $ref: "#/components/schemas/CustomerTag" };
const errorResponseSchema = { $ref: "#/components/schemas/ErrorResponse" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

export const customerTagPaths = {
  "/api/customer-tags": {
    get: {
      tags: ["Customer Tags"],
      summary: "List customer tags",
      operationId: "listCustomerTags",
      parameters: [
        { name: "search", in: "query", description: "Search by name", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of customer tags",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: tagSchema },
              count: { type: "integer" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:read scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Customer Tags"],
      summary: "Create customer tag",
      operationId: "createCustomerTag",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 50, example: "VIP" },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", default: "#64748b", example: "#FF5733" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Tag created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: tagSchema,
              message: { type: "string", example: "Tag created" },
            },
          }),
        },
        "400": { description: "Validation error (missing name, invalid hex color)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:manage scope", content: json(errorResponseSchema) },
        "409": {
          description: "Duplicate tag name",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Tag name already exists" },
              code: { type: "string", example: "DUPLICATE_TAG_NAME" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  name: { type: "string", example: "VIP" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-tags/{id}": {
    get: {
      tags: ["Customer Tags"],
      summary: "Get customer tag",
      operationId: "getCustomerTag",
      description: "Returns the tag. Pass `?customers=true` to include the full list of assigned customers (each with `assignedAt` timestamp).",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        {
          name: "customers",
          in: "query",
          description: "Set to `true` to include the `customers` array in the response",
          schema: { type: "string", enum: ["true", "false"] },
        },
      ],
      responses: {
        "200": {
          description: "Tag detail. When `?customers=true`, includes a `customers` array of customer summaries.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: tagSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:read scope", content: json(errorResponseSchema) },
        "404": {
          description: "Tag not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Tag not found" },
              code: { type: "string", example: "TAG_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_tag" },
                  id: { type: "string", example: "tag_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Customer Tags"],
      summary: "Update customer tag",
      operationId: "updateCustomerTag",
      description: "Partial update — only include fields you want to change.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 1, maxLength: 50 },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Tag updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: tagSchema,
            },
          }),
        },
        "400": { description: "Validation error (invalid hex color)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Tag not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Tag not found" },
              code: { type: "string", example: "TAG_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_tag" },
                  id: { type: "string", example: "tag_123" },
                },
              },
            },
          }),
        },
        "409": {
          description: "Duplicate tag name",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Tag name already exists" },
              code: { type: "string", example: "DUPLICATE_TAG_NAME" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  name: { type: "string", example: "VIP" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Customer Tags"],
      summary: "Delete customer tag",
      operationId: "deleteCustomerTag",
      description: "Deletes the tag and all its customer assignments. Customers themselves are not affected.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Tag deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Tag deleted" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Tag not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Tag not found" },
              code: { type: "string", example: "TAG_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_tag" },
                  id: { type: "string", example: "tag_123" },
                },
              },
            },
          }),
        },
        "422": {
          description: "Tag has assignments - cannot delete",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot delete tag with assignments" },
              code: { type: "string", example: "TAG_HAS_ASSIGNMENTS" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  tagId: { type: "string", example: "tag_123" },
                  tagName: { type: "string", example: "VIP" },
                  assignmentCount: { type: "integer", example: 5 },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-tags/{id}/assignments": {
    post: {
      tags: ["Customer Tags"],
      summary: "Assign tag to customer",
      operationId: "assignTag",
      description: "Assigns the tag to a customer. Idempotent — silently succeeds if already assigned. Increments `assignmentCount`.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["customerId"],
              properties: {
                customerId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Tag assigned",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Tag assigned" },
            },
          }),
        },
        "400": { description: "Validation error (missing customerId)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:manage scope", content: json(errorResponseSchema) },
        "404": { description: "Tag or customer not found", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-tags/{id}/assignments/{customerId}": {
    delete: {
      tags: ["Customer Tags"],
      summary: "Unassign tag from customer",
      operationId: "unassignTag",
      description: "Removes the tag from a customer. Idempotent — succeeds silently if not assigned. Decrements `assignmentCount`.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "customerId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Tag unassigned",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Tag unassigned" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_tags:manage scope", content: json(errorResponseSchema) },
        "404": { description: "Tag not found", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
