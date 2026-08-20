/**
 * Wilayas OpenAPI Paths
 */

const errorResponseSchema = { $ref: "#/components/schemas/ErrorResponse" };
const json = (schema: object) => ({ "application/json": { schema } });

export const wilayaPaths = {
  "/api/wilayas": {
    get: {
      tags: ["Wilayas"],
      summary: "List wilayas",
      description: "Get all Algerian wilayas (provinces)",
      operationId: "listWilayas",
      parameters: [
        { name: "search", in: "query", description: "Search by name (Arabic or Latin)", schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "List of wilayas",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: { $ref: "#/components/schemas/Wilaya" } },
              count: { type: "integer" },
            },
          }),
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json(errorResponseSchema) 
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/wilayas/{id}/communes": {
    get: {
      tags: ["Wilayas"],
      summary: "List communes",
      description: "Get all communes for a specific wilaya",
      operationId: "listCommunes",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
      ],
      responses: {
        "200": {
          description: "List of communes",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: { $ref: "#/components/schemas/Commune" } },
              count: { type: "integer" },
            },
          }),
        },
        "400": { 
          description: "Invalid wilaya ID", 
          content: json({
            allOf: [
              errorResponseSchema,
              {
                type: "object",
                example: {
                  error: "Invalid wilaya ID — must be an integer between 1 and 58",
                  code: "INVALID_FORMAT",
                  category: "VALIDATION",
                  context: { wilayaId: "abc" }
                }
              }
            ]
          })
        },
        "401": { 
          description: "Missing or invalid API key", 
          content: json(errorResponseSchema) 
        },
        "404": { 
          description: "Wilaya not found", 
          content: json({
            allOf: [
              errorResponseSchema,
              {
                type: "object",
                example: {
                  error: "Wilaya with ID 99 not found",
                  code: "WILAYA_NOT_FOUND",
                  category: "BUSINESS_LOGIC",
                  context: { entity: "Wilaya", id: "99" }
                }
              }
            ]
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
