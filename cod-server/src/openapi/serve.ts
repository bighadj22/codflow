/**
 * OpenAPI spec server.
 *
 * All API domains are migrated to @hono/zod-openapi: the served document is
 * the spec auto-generated from route definitions registered via app.openapi().
 *
 * Single documented exception: `/images/{key}` (public R2 serving) stays on a
 * plain-Hono router because it needs Hono's regex param (`:key{.+}`) so keys
 * containing slashes match — not expressible as a createRoute path. Its path
 * entry comes from endpoints/images/openapi.ts and is merged in below.
 */

import type { Context } from "hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { imagePaths } from "@/endpoints/images/openapi";

function resolveBaseUrl(c: Context<AppContext>): string {
  return (
    c.env.WORKER_URL ||
    c.req.header("X-Worker-URL") ||
    `https://${c.req.header("host")}`
  );
}

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodFlow API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.addEventListener("load", () => {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
      });
    });
  </script>
</body>
</html>`;

const API_DESCRIPTION = `
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
`.trim();

export function registerSpecEndpoint(app: OpenAPIHono<AppContext>): void {
  app.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-API-Key",
    description:
      "API key for authentication. Get your API key from the Developers section.",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "StoreAuth", {
    type: "apiKey",
    in: "header",
    name: "X-Store-API-Key",
    description:
      "Store API key for public storefront endpoints. Different from the dashboard API key.",
  });

  app.get("/api/openapi.json", (c: Context<AppContext>) => {
    const baseUrl = resolveBaseUrl(c);

    const generated = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "CodFlow API",
        version: "1.0.0",
        description: API_DESCRIPTION,
      },
      servers: [{ url: baseUrl, description: "API Server" }],
    });

    return c.json({
      ...generated,
      // /images/{key} is the single plain-Hono route (regex param) — its
      // documentation merges in alongside the generated paths.
      paths: { ...imagePaths, ...generated.paths },
    });
  });

  app.get("/api/docs", (c: Context<AppContext>) => {
    return c.html(SWAGGER_UI_HTML);
  });
}
