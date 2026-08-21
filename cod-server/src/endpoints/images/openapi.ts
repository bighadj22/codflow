/**
 * Images OpenAPI Paths (legacy stub)
 *
 * Only `/images/{key}` lives here now: that route uses Hono's regex param
 * (`:key{.+}`) so R2 keys containing slashes match, which cannot be
 * expressed as a @hono/zod-openapi createRoute path. The serve router is
 * therefore kept on plain Hono and documented via this retained legacy
 * entry. Upload and presign are fully migrated to generated specs.
 */

const errorSchema = { $ref: "#/components/schemas/Error" };
const json = (schema: object) => ({ "application/json": { schema } });

export const imagePaths = {
  "/images/{key}": {
    get: {
      tags: ["Images"],
      summary: "Serve image",
      description:
        "Publicly accessible image serving from R2 (no auth required). Cached with immutable headers.",
      operationId: "serveImage",
      security: [],
      parameters: [
        {
          name: "key",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "R2 object key (e.g. `products/abc123.webp`)",
        },
      ],
      responses: {
        "200": { description: "Image file (binary response with appropriate Content-Type)" },
        "400": {
          description: "Invalid or missing key",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid key" },
              code: {
                type: "string",
                enum: ["REQUIRED_FIELD_MISSING", "VALIDATION_FAILED"],
                example: "VALIDATION_FAILED",
              },
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
