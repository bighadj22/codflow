/**
 * OpenAPI spec server.
 *
 * During the @hono/zod-openapi migration, `/api/openapi.json` serves the
 * union of two sources:
 *   1. The legacy hand-written spec (generator.ts + endpoint openapi.ts
 *      files via paths.ts) for endpoints not yet migrated.
 *   2. The spec auto-generated from routes registered via `app.openapi()`
 *      for migrated endpoints — these win on path collisions.
 *
 * When all endpoints are migrated, generator.ts / paths.ts are deleted and
 * this endpoint reduces to the generated document alone.
 */

import type { Context } from "hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { generateOpenAPISpec } from "./generator";
import {
  imagePaths,
  storePaths,
  webhookPaths,
} from "./paths";

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

    const legacy = generateOpenAPISpec(baseUrl);
    legacy.paths = {
      ...storePaths,
      ...imagePaths,
      ...webhookPaths,
    };

    const generated = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "CodFlow API",
        version: "1.0.0",
        description: legacy.info.description,
      },
      servers: [{ url: baseUrl, description: "API Server" }],
    });

    return c.json({
      ...legacy,
      paths: { ...legacy.paths, ...generated.paths },
      components: {
        ...legacy.components,
        schemas: {
          ...legacy.components.schemas,
          ...generated.components?.schemas,
        },
        securitySchemes: {
          ...legacy.components.securitySchemes,
          ...generated.components?.securitySchemes,
        },
      },
    });
  });

  app.get("/api/docs", (c: Context<AppContext>) => {
    return c.html(SWAGGER_UI_HTML);
  });
}
