/**
 * Images OpenAPI Paths
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const json = (schema: object) => ({ "application/json": { schema } });

export const imagePaths = {
  "/api/images/upload": {
    post: {
      tags: ["Images"],
      summary: "Upload image",
      description: "Upload an image file (jpg, png, webp, gif) to R2 storage. Max 10 MB.",
      operationId: "uploadImage",
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["file"],
              properties: {
                file: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Image uploaded successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  key: { type: "string", description: "R2 object key — pass to POST /api/products/{id}/images as `key`" },
                  url: { type: "string", format: "uri", description: "Public URL for the uploaded image" },
                },
              },
            },
          }),
        },
        "400": {
          description: "Validation error - missing file, invalid type, or file too large",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "File too large. Max 10 MB" },
              code: { 
                type: "string", 
                enum: ["VALIDATION_FAILED", "REQUIRED_FIELD_MISSING", "INVALID_FILE_TYPE", "FILE_TOO_LARGE"],
                example: "FILE_TOO_LARGE"
              },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fileSize: { type: "number", example: 15728640 },
                  maxSize: { type: "number", example: 10485760 },
                  fileName: { type: "string", example: "large-image.jpg" },
                  fileType: { type: "string", example: "image/jpeg" },
                  allowedTypes: { type: "array", items: { type: "string" }, example: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "500": {
          description: "System error - R2 storage failure",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Failed to upload image to storage" },
              code: { type: "string", example: "INTERNAL_SERVER_ERROR" },
              category: { type: "string", example: "SYSTEM" },
              context: {
                type: "object",
                properties: {
                  key: { type: "string", example: "products/abc123.jpg" },
                  fileName: { type: "string", example: "product.jpg" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/images/presign": {
    post: {
      tags: ["Images"],
      summary: "Get presigned upload URL",
      description: "Get a presigned URL for direct client-side upload to R2. The client PUTs the file to `presignedUrl`, then calls POST /api/products/{id}/images with the returned `key`.",
      operationId: "presignUpload",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["contentType"],
              properties: {
                contentType: { type: "string", example: "image/jpeg", description: "MIME type — must be one of: image/jpeg, image/png, image/webp, image/gif" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Presigned URL generated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  presignedUrl: { type: "string", format: "uri", description: "PUT this URL directly from the browser to upload the file" },
                  key: { type: "string", description: "R2 object key — pass to POST /api/products/{id}/images as `key`" },
                  publicUrl: { type: "string", format: "uri", description: "Permanent public URL served via custom domain" },
                },
              },
            },
          }),
        },
        "400": {
          description: "Invalid or unsupported content type",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid content type. Allowed: jpg, png, webp, gif" },
              code: { type: "string", example: "INVALID_FILE_TYPE" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  contentType: { type: "string", example: "application/pdf" },
                  allowedTypes: { type: "array", items: { type: "string" }, example: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing products:manage scope", content: json(errorSchema) },
        "500": {
          description: "R2 credentials not configured on server or presigned URL generation failed",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "R2 credentials not configured. Set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY secrets." },
              code: { type: "string", example: "INTERNAL_SERVER_ERROR" },
              category: { type: "string", example: "SYSTEM" },
              context: {
                type: "object",
                properties: {
                  missingCredentials: { type: "array", items: { type: "string" }, example: ["CF_ACCOUNT_ID"] },
                  key: { type: "string", example: "products/abc123.jpg" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/images/{key}": {
    get: {
      tags: ["Images"],
      summary: "Serve image",
      description: "Publicly accessible image serving from R2 (no auth required). Cached with immutable headers.",
      operationId: "serveImage",
      security: [],
      parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" }, description: "R2 object key (e.g. `products/abc123.webp`)" }],
      responses: {
        "200": { description: "Image file (binary response with appropriate Content-Type)" },
        "400": {
          description: "Invalid or missing key",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid key" },
              code: { type: "string", enum: ["REQUIRED_FIELD_MISSING", "VALIDATION_FAILED"], example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  key: { type: "string", example: "../../../etc/passwd" },
                },
              },
            },
          }),
        },
        "404": {
          description: "Image not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Image with ID products/abc123.jpg not found" },
              code: { type: "string", example: "IMAGE_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Image" },
                  id: { type: "string", example: "products/abc123.jpg" },
                },
              },
            },
          }),
        },
      },
    },
  },
};
