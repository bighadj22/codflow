/**
 * COD Flow Server - Cloudflare Worker
 * 
 * Main entry point for the backend API.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext, Env } from "@/types";
import { corsMiddleware } from "@/middleware/cors";
import { authMiddleware } from "@/middleware/auth";
import { storeAuthMiddleware } from "@/middleware/storeAuth";
import { errorHandler } from "@/middleware/error";

// Import routes
import storeRoutes from "@/endpoints/store/routes";
import webhooksRouter from "@/endpoints/webhooks/routes";
import ordersRoutes from "@/endpoints/orders/routes";
import usersRoutes from "@/endpoints/users/routes";
import customersRoutes from "@/endpoints/customers/routes";
import customerGroupsRoutes from "@/endpoints/customer-groups/routes";
import customerTagsRoutes from "@/endpoints/customer-tags/routes";
import driversRoutes from "@/endpoints/drivers/routes";
import wilayasRoutes from "@/endpoints/wilayas/routes";
import deliveryCompaniesRoutes from "@/endpoints/delivery-companies/routes";
import productsRoutes from "@/endpoints/products/routes";
import productGroupsRoutes from "@/endpoints/product-groups/routes";
import shippingProfilesRoutes from "@/endpoints/shipping-profiles/routes";
import driverPaymentsRoutes from "@/endpoints/driver-payments/routes";
import { uploadRouter, serveRouter } from "@/endpoints/images/routes";
import activityLogsRoutes from "@/endpoints/activity-logs/routes";
import storesRoutes from "@/endpoints/stores/routes";
import reviewsRoutes from "@/endpoints/reviews/routes";
import offersRoutes from "@/endpoints/offers/routes";
import { stockRouter, productStockRouter } from "@/endpoints/stock/routes";
import { registerSpecEndpoint } from "@/openapi/serve";
import { openApiValidationHook } from "@/openapi/validation-hook";
import mcpManagementRoutes from "@/endpoints/mcp/routes";
import analyticsRoutes from "@/endpoints/analytics/routes";
import abandonedOrdersRoutes from "@/endpoints/abandoned-orders/routes";
import storeAbandonedRoutes from "@/endpoints/abandoned-orders/store-routes";
import storeOtpRoutes from "@/endpoints/store-otp/store-routes";

import { sweepAbandonedOrders } from "@/cron/sweep-abandoned-orders";

// MCP remote server (remote Model Context Protocol endpoint for Claude / AI agents).
// The OAuthProvider owns OAuth (discovery, client registration, tokens, revocation)
// and the `/mcp` protected route; the Hono app below is its defaultHandler.
import { OAuthProvider, type OAuthProviderOptions, type TokenExchangeCallbackOptions } from "@cloudflare/workers-oauth-provider";
import { createCodMcpHandler } from "@/mcp/server-factory";
import { authorizeGet, authorizePost } from "@/mcp/authorize";
import { recordMcpLastUsed } from "@/mcp/last-used";
import { ALL_SCOPES } from "../../cod-shared/rbac/scopes";

// CodCapiWorkflow — MUST be re-exported so Cloudflare can bind it via wrangler.toml [[workflows]].
export { CodCapiWorkflow } from "@/workflows/capi";

// OpenAPIHono extends Hono: existing routes/middleware keep working, and
// routes registered via app.openapi() validate requests and feed the
// generated spec. The default hook keeps framework validation errors in
// the platform error envelope.
const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });

// Global middleware
app.use("*", corsMiddleware);
app.onError(errorHandler);

// Image serving — no auth required (public, cacheable)
app.route("/images", serveRouter);

// OpenAPI documentation — no auth required (public)
// Must be mounted BEFORE app.use("/api/*", authMiddleware)
registerSpecEndpoint(app);

// Webhook receivers — public, no auth, signature-verified internally
// MUST be mounted BEFORE app.use("/api/*", authMiddleware)
app.route("/webhooks", webhooksRouter);

// Store API — separate auth (must be before /api/* authMiddleware)
app.use("/store/*", storeAuthMiddleware);
app.route("/store", storeRoutes);
app.route("/store", storeAbandonedRoutes);
app.route("/store", storeOtpRoutes);

// OAuth authorization endpoint — routed here by the OAuthProvider's
// defaultHandler. Implements the Better Auth login-ticket bridge + consent.
app.get("/authorize", authorizeGet);
app.post("/authorize", authorizePost);

// Health check (no auth required)
app.get("/", (c) => {
  return c.json({
    service: "COD Flow API",
    version: "1.0.0",
    status: "healthy",
    environment: c.env.ENVIRONMENT
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Protected routes (require authentication)
app.use("/api/*", authMiddleware);

// Mount endpoint routes
app.route("/api/images", uploadRouter);
app.route("/api/activity-logs", activityLogsRoutes);
app.route("/api/orders", ordersRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/customers", customersRoutes);
app.route("/api/customer-groups", customerGroupsRoutes);
app.route("/api/customer-tags", customerTagsRoutes);
app.route("/api/drivers", driversRoutes);
app.route("/api/wilayas", wilayasRoutes);
app.route("/api/delivery-companies", deliveryCompaniesRoutes);
app.route("/api/products", productsRoutes);
app.route("/api/product-groups", productGroupsRoutes);
app.route("/api/shipping-profiles", shippingProfilesRoutes);
app.route("/api/driver-payments", driverPaymentsRoutes);
app.route("/api/stores", storesRoutes);
app.route("/api/reviews", reviewsRoutes);
app.route("/api/offers", offersRoutes);
app.route("/api/stock", stockRouter);
app.route("/api/products", productStockRouter);
app.route("/api/mcp", mcpManagementRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/abandoned-orders", abandonedOrdersRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// ─── MCP OAuth provider ──────────────────────────────────────────────────────
// The `@cloudflare/workers-oauth-provider` owns the MCP OAuth surface:
//   • serves RFC 9728 protected-resource + RFC 8414 authorization-server
//     discovery, the token/revocation endpoints, and dynamic client
//     registration (DCR) / Client ID Metadata Documents (CIMD);
//   • guards `/mcp` (apiRoute): validates the opaque access token against
//     OAUTH_KV, binds the audience to the configured resource, decrypts the
//     application props into `ctx.props`, and hands the request to the MCP
//     handler; invalid/missing tokens get the spec `WWW-Authenticate` challenge;
//   • routes everything else — including `/authorize` — to `defaultHandler`
//     (this Hono app).
//
// Built lazily on first request because `resourceMetadata.resource` derives
// from `WORKER_SELF_URL`; `env` is constant per deployment, so the singleton
// never needs to be rebuilt.
let oauthProviderInstance: OAuthProvider<Env> | undefined;

function oauthProviderOptions(env: Env): OAuthProviderOptions<Env> {
  const resourceOrigin = new URL(env.WORKER_SELF_URL);
  return {
    apiRoute: "/mcp",
    apiHandler: {
      fetch: (request, requestEnv, ctx) => createCodMcpHandler(requestEnv)(request, requestEnv, ctx),
    },
    defaultHandler: {
      fetch: (request, requestEnv, ctx) => app.fetch(request, requestEnv, ctx),
    },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: ALL_SCOPES,
    resourceMetadata: {
      resource: new URL("/mcp", resourceOrigin).toString(),
      authorization_servers: [resourceOrigin.origin],
      scopes_supported: ALL_SCOPES,
      resource_name: "CodFlow MCP",
    },
    accessTokenTTL: 60 * 60,
    refreshTokenTTL: 60 * 60 * 24 * 30,
    tokenExchangeCallback: (options: TokenExchangeCallbackOptions) =>
      recordMcpLastUsed(env.OAUTH_KV, options.userId, options.grantId),
  };
}

function getOAuthProvider(env: Env): OAuthProvider<Env> {
  if (!oauthProviderInstance) {
    oauthProviderInstance = new OAuthProvider<Env>(oauthProviderOptions(env));
  }
  return oauthProviderInstance;
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    getOAuthProvider(env).fetch(request, env, ctx),
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(sweepAbandonedOrders(env));
    ctx.waitUntil(getOAuthProvider(env).purgeExpiredData(env, { batchSize: 50 }));
  },
};
