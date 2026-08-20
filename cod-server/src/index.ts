/**
 * COD Flow Server - Cloudflare Worker
 * 
 * Main entry point for the backend API.
 */

import { Hono } from "hono";
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
import openapiRoutes from "@/openapi/routes";
import mcpManagementRoutes from "@/endpoints/mcp/routes";
import analyticsRoutes from "@/endpoints/analytics/routes";
import abandonedOrdersRoutes from "@/endpoints/abandoned-orders/routes";
import storeAbandonedRoutes from "@/endpoints/abandoned-orders/store-routes";

import { sweepAbandonedOrders } from "@/cron/sweep-abandoned-orders";

// MCP remote server (remote Model Context Protocol endpoint for Claude / AI agents).
// The CodMcpAgent Durable Object class MUST be re-exported from this module
// — Cloudflare resolves DO bindings to the entry Worker's default export.
import { CodMcpAgent } from "@/mcp/server";
import { bearerToProps, extractBearer, UnauthenticatedError } from "@/mcp/auth";
import { protectedResourceMetadata } from "@/mcp/wellknown";
import type { McpProps } from "@/mcp/props";
export { CodMcpAgent };

// CodCapiWorkflow — MUST be re-exported so Cloudflare can bind it via wrangler.toml [[workflows]].
export { CodCapiWorkflow } from "@/workflows/capi";

// Create Hono app
const app = new Hono<AppContext>();

// Global middleware
app.use("*", corsMiddleware);
app.onError(errorHandler);

// Image serving — no auth required (public, cacheable)
app.route("/images", serveRouter);

// OpenAPI documentation — no auth required (public)
app.route("/api", openapiRoutes);

// Webhook receivers — public, no auth, signature-verified internally
// MUST be mounted BEFORE app.use("/api/*", authMiddleware)
app.route("/webhooks", webhooksRouter);

// Store API — separate auth (must be before /api/* authMiddleware)
app.use("/store/*", storeAuthMiddleware);
app.route("/store", storeRoutes);
app.route("/store", storeAbandonedRoutes);

// ─── MCP remote server (public discovery + bearer-gated endpoint) ──────────
// Order matters: both routes are mounted BEFORE `app.use("/api/*", authMiddleware)`
// so the global dashboard auth middleware doesn't interfere. The /mcp route
// does its own OAuth verification via bearerToProps; /.well-known is public
// per RFC 9728.
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);

app.all("/mcp", async (c) => {
  console.log("[MCP] Received request to /mcp endpoint");
  console.log("[MCP] Request method:", c.req.method);
  console.log("[MCP] Authorization header:", c.req.header("authorization") ? "present" : "missing");
  
  const bearer = extractBearer(c.req.header("authorization"));
  console.log("[MCP] Bearer token extracted:", bearer ? "present" : "missing");

  let props;
  try {
    console.log("[MCP] Verifying bearer token...");
    props = await bearerToProps(bearer, c.env);
    console.log("[MCP] Bearer token verified successfully. Props:", {
      userId: props.userId,
      role: props.role,
      scopes: props.scopes,
      name: props.name,
      email: props.email
    });
  } catch (err) {
    console.error("[MCP] Bearer token verification failed:", err);
    // Per MCP spec, unauthenticated responses carry a WWW-Authenticate header
    // pointing at the protected-resource metadata so clients can discover the
    // authorization server and start an OAuth flow.
    const metadataUrl = new URL("/.well-known/oauth-protected-resource", c.req.url).toString();
    const code = err instanceof UnauthenticatedError ? err.code : "invalid_token";
    return new Response(
      JSON.stringify({ error: code, error_description: err instanceof Error ? err.message : "Unauthorized" }),
      {
        status: 401,
        headers: {
          "Content-Type":     "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}", error="${code}"`,
        },
      },
    );
  }

  // Hand off to the Durable Object agent. `executionCtx.props` is read by
  // `agents/mcp`'s internal router when it instantiates the DO for this
  // session — everything we attach here lands on `this.props` inside the
  // agent's `init()`.
  console.log("[MCP] Attaching props to execution context");
  (c.executionCtx as unknown as { props: McpProps }).props = props;

  console.log("[MCP] Delegating to CodMcpAgent Durable Object...");
  const handler = CodMcpAgent.serve("/mcp", { binding: "MCP_SESSIONS" });
  return handler.fetch(c.req.raw, c.env, c.executionCtx);
});

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

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(sweepAbandonedOrders(env));
  },
};
