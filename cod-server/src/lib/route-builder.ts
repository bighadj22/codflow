/**
 * Route Definition Builder
 *
 * Simplifies OpenAPI route creation by hiding ceremony behind a small interface.
 * This is the standard pattern for all new and migrated endpoints in cod-server.
 *
 * BEFORE (createRoute ceremony, ~70 lines per endpoint):
 *   - Define jsonContent helper
 *   - Define errorResponse helper
 *   - Pass middleware arrays, security, responses manually
 *
 * AFTER (defineRoute, ~10 lines per endpoint):
 *   defineRoute({
 *     method: "get",
 *     path: "/wilayas",
 *     auth: "api-key",
 *     query: WilayaFiltersSchema,
 *     handler: handlers.listWilayas,
 *   })
 */

import { createRoute, z } from "@hono/zod-openapi";
import type { ZodType } from "zod";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { requireAdmin, requireScope, requireAnyScope, requireAllScopes } from "@/rbac/middleware";
import { ErrorResponseSchema } from "@/openapi/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authentication strategy for the route.
 * 
 * - "public": No auth middleware, no security requirement (signature-verified
 *   receivers, health checks, etc.)
 * - "api-key": Requires X-API-Key header (any authenticated user)
 * - "admin": Requires X-API-Key + admin role
 * - "store": Requires X-Store-API-Key header
 * - { scope: "orders:read" }: Requires specific permission scope
 * - { anyOf: ["orders:read", "orders:write"] }: Requires at least one scope
 * - { allOf: ["orders:read", "products:read"] }: Requires all scopes
 */
export type AuthStrategy =
  | "public"
  | "api-key"
  | "admin"
  | "store"
  | { scope: string }
  | { anyOf: string[] }
  | { allOf: string[] };

/**
 * Route definition with all the essentials, none of the ceremony.
 */
export interface RouteDefinition {
  method: "get" | "post" | "patch" | "delete" | "put";
  path: string;
  auth: AuthStrategy;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  query?: ZodType;                            // Query parameters (GET /users?role=admin)
  params?: ZodType;                           // Path parameters (GET /users/:id)
  body?: ZodType;                             // Request body (POST /users)
  headers?: ZodType;                          // Request headers (POST /webhooks with svix-*)
  handler: (c: Context<AppContext>) => any;   // Your handler function
  
  /**
   * Optional custom responses. If not provided, standard responses are generated.
   * Use when you need custom response schemas (e.g., orders create endpoint).
   */
  responses?: Record<number, any>;
  
  /**
   * Optional custom validation hook that runs after Zod validation.
   * Same signature as OpenAPIHono's defaultHook.
   * Use when you need to throw custom errors (e.g., wilayas invalidWilayaIdHook).
   */
  validationHook?: (result: { success: boolean; error?: any }, c: Context<AppContext>) => any;
}

/**
 * Result returned by defineRoute() — ready to register with app.openapi().
 */
export interface BuiltRoute {
  route: ReturnType<typeof createRoute>;
  handler: (c: Context<AppContext>) => any;
  validationHook?: (result: { success: boolean; error?: any }, c: Context<AppContext>) => any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers (hidden from callers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a Zod schema in application/json content type.
 * Hidden from callers — they just provide the schema.
 */
function jsonContent(schema: ZodType) {
  return {
    "application/json": { schema },
  };
}

/**
 * Standard error response (description + ErrorResponseSchema).
 * Hidden from callers — generated automatically.
 */
function errorResponse(description: string) {
  return {
    description,
    content: jsonContent(ErrorResponseSchema),
  };
}

/**
 * Standard error responses that EVERY endpoint gets automatically.
 */
const standardErrors: Record<number, any> = {
  400: errorResponse("Validation error"),
  401: errorResponse("Authentication required"),
  500: errorResponse("Internal server error"),
};

/**
 * Convert auth strategy to Hono middleware array.
 */
function resolveAuthMiddleware(auth: AuthStrategy) {
  if (auth === "public" || auth === "api-key") {
    // No additional middleware — public routes are unprotected (handlers
    // verify signatures themselves when needed); api-key routes rely on the
    // app-level authMiddleware.
    return [];
  }
  if (auth === "admin") {
    return [requireAdmin()];
  }
  if (auth === "store") {
    // Store auth uses a different middleware (requireStoreAuth)
    // For now, return empty — will be added when we migrate store endpoints
    return [];
  }
  if (typeof auth === "object") {
    if ("scope" in auth) return [requireScope(auth.scope)];
    if ("anyOf" in auth) return [requireAnyScope(auth.anyOf)];
    if ("allOf" in auth) return [requireAllScopes(auth.allOf)];
  }
  throw new Error(`Unknown auth strategy: ${JSON.stringify(auth)}`);
}

/**
 * Convert auth strategy to OpenAPI security requirement.
 */
function resolveSecurity(auth: AuthStrategy) {
  if (auth === "public") {
    // Omit the security requirement entirely — matches routes that declare
    // no security (public receivers). `security: []` would also render, so
    // undefined is what keeps the generated spec identical to raw
    // createRoute() calls without a security block.
    return undefined;
  }
  if (auth === "store") {
    return [{ StoreAuth: [] }];
  }
  // All other auth strategies use ApiKeyAuth
  return [{ ApiKeyAuth: [] }];
}

/**
 * Infer default tag from path (e.g., "/wilayas" → "Wilayas").
 */
function inferTag(path: string): string {
  const segment = path.split("/").filter(Boolean)[0] || "API";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * Generate success response based on method.
 * GET/PATCH/DELETE → 200, POST → 201
 */
function generateSuccessResponse(method: string): Record<number, any> {
  if (method === "post") {
    return { 201: { description: "Created" } };
  }
  return { 200: { description: "Success" } };
}

/**
 * Generate method-specific error responses.
 * GET endpoints don't need 403 (no permission checks beyond auth).
 * POST/PATCH/DELETE need 403 for permission checks.
 */
function generateErrorResponses(method: string, auth: AuthStrategy) {
  const errors: Record<number, any> = { ...standardErrors };

  if (auth === "public") {
    // Public routes have no auth to fail — drop 401, never add 403
    delete errors[401];
  } else if (method !== "get" || auth === "admin" || (typeof auth === "object" && "scope" in auth)) {
    // Add 403 for endpoints that might have permission checks
    errors[403] = errorResponse("Permission denied");
  }

  // Add 404 for routes with params (/:id endpoints)
  // Note: This is a heuristic — callers can override by passing custom responses
  errors[404] = errorResponse("Resource not found");

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define an OpenAPI route with minimal ceremony.
 * 
 * Hides the complexity of:
 * - jsonContent() and errorResponse() helpers
 * - Middleware resolution from auth strategy
 * - Security requirement mapping
 * - Standard error responses (400, 401, 403, 404, 500)
 * - Success response based on method
 * - Default tag inference from path
 * 
 * @example
 * ```ts
 * const { route, handler } = defineRoute({
 *   method: "get",
 *   path: "/wilayas",
 *   auth: "api-key",
 *   query: WilayaFiltersSchema,
 *   handler: handlers.listWilayas
 * });
 * 
 * app.openapi(route, handler);
 * ```
 */
export function defineRoute(def: RouteDefinition): BuiltRoute {
  const tags = def.tags || [inferTag(def.path)];
  const operationId = def.operationId || def.handler.name || undefined;
  
  // Build request object dynamically
  const request: any = {};
  if (def.query) request.query = def.query;
  if (def.params) request.params = def.params;
  if (def.headers) request.headers = def.headers;
  if (def.body) request.body = { content: jsonContent(def.body) };
  
  // Use custom responses if provided, otherwise generate standard ones
  const responses = def.responses
    ? def.responses
    : {
        ...generateSuccessResponse(def.method),
        ...generateErrorResponses(def.method, def.auth),
      };
  
  const route = createRoute({
    method: def.method,
    path: def.path,
    middleware: resolveAuthMiddleware(def.auth),
    tags,
    summary: def.summary,
    description: def.description,
    operationId,
    request,
    responses,
    security: resolveSecurity(def.auth),
  });

  return {
    route,
    handler: def.handler,
    ...(def.validationHook ? { validationHook: def.validationHook } : {}),
  };
}
