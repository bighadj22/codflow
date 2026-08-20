/**
 * Reviews OpenAPI Paths
 *
 * CRM endpoints for moderation of product reviews submitted via the storefront.
 * All routes require an API key with the appropriate reviews scope.
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

const reviewSchema = {
  type: "object",
  properties: {
    id:           { type: "string" },
    storeId:      { type: "string" },
    productId:    { type: "string" },
    orderId:      { type: "string" },
    orderNumber:  { type: "string", example: "ORD-20240101-0042" },
    customerName: { type: "string", example: "أحمد بن علي" },
    rating:       { type: "integer", minimum: 1, maximum: 5, example: 5 },
    title:        { type: "string", nullable: true },
    body:         { type: "string" },
    status:       { type: "string", enum: ["pending", "approved", "rejected"] },
    helpfulCount: { type: "integer" },
    productName:  { type: "string", nullable: true },
    createdAt:    { type: "string", format: "date-time" },
    updatedAt:    { type: "string", format: "date-time" },
  },
};

const reviewNotFoundError = {
  error: "Review with ID 123e4567-e89b-12d3-a456-426614174000 not found",
  code: "REVIEW_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Review", id: "123e4567-e89b-12d3-a456-426614174000" },
};

export const reviewPaths = {
  "/api/reviews": {
    get: {
      tags: ["Reviews"],
      summary: "List reviews",
      description: "Get all product reviews with optional status and product filters. Requires `reviews:read` scope.",
      operationId: "listReviews",
      parameters: [
        {
          name: "status",
          in: "query",
          description: "Filter by moderation status",
          schema: { type: "string", enum: ["pending", "approved", "rejected"] },
        },
        {
          name: "productId",
          in: "query",
          description: "Filter by product ID",
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0, minimum: 0 },
        },
      ],
      responses: {
        "200": {
          description: "List of reviews",
          content: json({
            type: "object",
            properties: {
              success:      { type: "boolean", example: true },
              data:         { type: "array", items: reviewSchema },
              count:        { type: "integer", description: "Number of items in `data`" },
              total:        { type: "integer", description: "Total matching records (for pagination)" },
              pendingCount: { type: "integer", description: "Total pending reviews regardless of filters — used for dashboard badge" },
            },
          }),
        },
        "400": { description: "Invalid filter value (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires reviews:read", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/reviews/{id}": {
    patch: {
      tags: ["Reviews"],
      summary: "Update review status",
      description: "Approve or reject a review. Requires `reviews:manage` scope.",
      operationId: "updateReview",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pending", "approved", "rejected"] },
          },
        }),
      },
      responses: {
        "200": {
          description: "Updated review",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data:    reviewSchema,
            },
          }),
        },
        "400": { description: "Validation error — invalid or missing status (VALIDATION_FAILED)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires reviews:manage", content: json(errorSchema) },
        "404": {
          description: "Review not found (REVIEW_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error:    { type: "string" },
              code:     { type: "string", enum: ["REVIEW_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context:  { type: "object" },
            },
            example: reviewNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    delete: {
      tags: ["Reviews"],
      summary: "Delete review",
      description: "Permanently delete a review. Requires `reviews:manage` scope.",
      operationId: "deleteReview",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Review deleted",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true } },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Insufficient scope — requires reviews:manage", content: json(errorSchema) },
        "404": {
          description: "Review not found (REVIEW_NOT_FOUND)",
          content: json({
            type: "object",
            properties: {
              error:    { type: "string" },
              code:     { type: "string", enum: ["REVIEW_NOT_FOUND"] },
              category: { type: "string", enum: ["BUSINESS_LOGIC"] },
              context:  { type: "object" },
            },
            example: reviewNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
