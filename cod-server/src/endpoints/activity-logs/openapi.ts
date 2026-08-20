/**
 * Activity Logs OpenAPI Paths
 */

const logSchema = { $ref: "#/components/schemas/ActivityLog" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const json = (schema: object) => ({ "application/json": { schema } });

export const activityLogPaths = {
  "/api/activity-logs": {
    get: {
      tags: ["Activity Logs"],
      summary: "List activity logs",
      description: "Get audit trail of all system actions (admin only)",
      operationId: "listActivityLogs",
      parameters: [
        { name: "actorId", in: "query", description: "Filter by actor (user) ID", schema: { type: "string" } },
        { name: "entityType", in: "query", description: "Filter by entity type. Valid values: `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `stock`, `user`, `review`", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of activity logs",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: logSchema },
              count: { type: "integer" },
            },
          }),
        },
        "400": {
          description: "Validation error - invalid query parameters",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid limit parameter" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  field: { type: "string", example: "limit" },
                  value: { type: "string", example: "abc" },
                  message: { type: "string", example: "Limit must be a positive integer" },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": {
          description: "Admin access required",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Admin access required" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
              context: {
                type: "object",
                properties: {
                  requiredScope: { type: "string", example: "admin" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/activity-logs/users/{userId}": {
    get: {
      tags: ["Activity Logs"],
      summary: "Get user activity logs",
      description: "Get activity logs for a specific user (admin only)",
      operationId: "getUserActivityLogs",
      parameters: [
        { name: "userId", in: "path", required: true, schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 30, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "User activity logs",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: logSchema },
              count: { type: "integer" },
            },
          }),
        },
        "400": {
          description: "Validation error - invalid query parameters",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid offset parameter" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  field: { type: "string", example: "offset" },
                  value: { type: "string", example: "-5" },
                  message: { type: "string", example: "Offset must be a non-negative integer" },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": {
          description: "Admin access required",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Admin access required" },
              code: { type: "string", example: "PERMISSION_DENIED" },
              category: { type: "string", example: "AUTHENTICATION" },
              context: {
                type: "object",
                properties: {
                  requiredScope: { type: "string", example: "admin" },
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
