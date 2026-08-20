/**
 * Customer Groups OpenAPI Paths
 */

const groupSchema = { $ref: "#/components/schemas/CustomerGroup" };
const errorResponseSchema = { $ref: "#/components/schemas/ErrorResponse" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

export const customerGroupPaths = {
  "/api/customer-groups": {
    get: {
      tags: ["Customer Groups"],
      summary: "List customer groups",
      operationId: "listCustomerGroups",
      parameters: [
        { name: "search", in: "query", description: "Search by name", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of customer groups",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: groupSchema },
              count: { type: "integer" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:read scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Customer Groups"],
      summary: "Create customer group",
      operationId: "createCustomerGroup",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100, example: "Wholesale Customers" },
                description: { type: "string", maxLength: 500, nullable: true },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", default: "#6366f1", example: "#3B82F6" },
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
              data: groupSchema,
              message: { type: "string", example: "Group created" },
            },
          }),
        },
        "400": { description: "Validation error (missing name, invalid hex color)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:manage scope", content: json(errorResponseSchema) },
        "409": {
          description: "Duplicate group name",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Group name already exists" },
              code: { type: "string", example: "DUPLICATE_GROUP_NAME" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  name: { type: "string", example: "VIP Customers" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-groups/{id}": {
    get: {
      tags: ["Customer Groups"],
      summary: "Get customer group",
      operationId: "getCustomerGroup",
      description: "Returns the group. Pass `?members=true` to include the full member list (each with `assignedAt` timestamp).",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        {
          name: "members",
          in: "query",
          description: "Set to `true` to include the `members` array in the response",
          schema: { type: "string", enum: ["true", "false"] },
        },
      ],
      responses: {
        "200": {
          description: "Group detail. When `?members=true`, includes a `members` array of customer summaries.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: groupSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:read scope", content: json(errorResponseSchema) },
        "404": {
          description: "Group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Group not found" },
              code: { type: "string", example: "GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_group" },
                  id: { type: "string", example: "grp_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Customer Groups"],
      summary: "Update customer group",
      operationId: "updateCustomerGroup",
      description: "Partial update — only include fields you want to change. Set `description` to `null` to clear it.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
                description: { type: "string", maxLength: 500, nullable: true },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
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
              data: groupSchema,
            },
          }),
        },
        "400": { description: "Validation error (invalid hex color)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Group not found" },
              code: { type: "string", example: "GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_group" },
                  id: { type: "string", example: "grp_123" },
                },
              },
            },
          }),
        },
        "409": {
          description: "Duplicate group name",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Group name already exists" },
              code: { type: "string", example: "DUPLICATE_GROUP_NAME" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  name: { type: "string", example: "VIP Customers" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Customer Groups"],
      summary: "Delete customer group",
      operationId: "deleteCustomerGroup",
      description: "Deletes the group and all its member associations. Customers themselves are not affected.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Group deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Group deleted" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "Group not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Group not found" },
              code: { type: "string", example: "GROUP_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "customer_group" },
                  id: { type: "string", example: "grp_123" },
                },
              },
            },
          }),
        },
        "422": {
          description: "Group has members - cannot delete",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot delete group with members" },
              code: { type: "string", example: "GROUP_HAS_MEMBERS" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  groupId: { type: "string", example: "grp_123" },
                  groupName: { type: "string", example: "VIP Customers" },
                  memberCount: { type: "integer", example: 5 },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-groups/{id}/members": {
    post: {
      tags: ["Customer Groups"],
      summary: "Add member to group",
      operationId: "addMember",
      description: "Adds a customer to the group. Idempotent — silently succeeds if already a member. Increments `memberCount`.",
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
          description: "Member added",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Member added" },
            },
          }),
        },
        "400": { description: "Validation error (missing customerId)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:manage scope", content: json(errorResponseSchema) },
        "404": { description: "Group or customer not found", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/customer-groups/{id}/members/{customerId}": {
    delete: {
      tags: ["Customer Groups"],
      summary: "Remove member from group",
      operationId: "removeMember",
      description: "Removes a customer from the group. Idempotent — succeeds silently if not a member. Decrements `memberCount`.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "customerId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Member removed",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Member removed" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing customer_groups:manage scope", content: json(errorResponseSchema) },
        "404": { description: "Group not found", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
