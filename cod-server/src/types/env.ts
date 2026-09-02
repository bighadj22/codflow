/**
 * Cloudflare Worker environment bindings.
 * Declared in wrangler.toml — keep this in sync.
 */
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  /** D1 database binding */
  DB: D1Database;
  /** R2 bucket for product images */
  IMAGES: R2Bucket;
  /** Deployment environment: "development" | "production" */
  ENVIRONMENT: string;
  /** Worker URL for API documentation (e.g., "http://localhost:8787" or "https://api.yourdomain.com") */
  WORKER_URL?: string;
  /** Custom domain for serving R2 images publicly (e.g. "media.example.com") */
  MEDIA_DOMAIN: string;
  /** R2 bucket name — needed by the S3-compat presign API */
  R2_BUCKET_NAME: string;
  /** Cloudflare account ID — used to build R2 S3 endpoint URL */
  CF_ACCOUNT_ID: string;
  /** R2 API token key ID (secret — set via wrangler secret put) */
  R2_ACCESS_KEY_ID: string;
  /** R2 API token secret (secret — set via wrangler secret put) */
  R2_SECRET_ACCESS_KEY: string;
  /** Comma-separated list of allowed CORS origins (e.g., "http://localhost:3000,https://app.example.com") */
  ALLOWED_ORIGINS?: string;

  // ─── MCP remote server (added MCP-8) ───────────────────────────────────────
  /**
   * Origin of the Better Auth OAuth Authorization Server (cod-client URL).
   * Used as the `iss` claim when verifying MCP bearer tokens AND to derive
   * the JWKS URL (`${BETTER_AUTH_URL}/api/auth/jwks`).
   * Partner-server sets this per-tenant during provisioning.
   */
  BETTER_AUTH_URL: string;
  /**
   * This Worker's own public origin. Used as the required `aud` claim when
   * verifying MCP bearer tokens — stops a token minted for tenant A from
   * being accepted against tenant B.
   */
  WORKER_SELF_URL: string;
  /**
   * HMAC key (>= 32 bytes) sealing the MCP `requestState` used by tool
   * confirmation. Optional: when missing or too short, dangerous MCP tools fail
   * closed. Set via `wrangler secret put` in production, `.dev.vars` locally.
   */
  MCP_REQUEST_STATE_KEY?: string;
  /**
   * HMAC secret (>= 32 bytes) shared with the Astro dashboard for the MCP OAuth
   * login tickets minted after dashboard sign-in. Optional: when missing or too
   * short, the MCP authorize flow fails closed.
   */
  MCP_LOGIN_TICKET_SECRET?: string;
  /** KV namespace for the MCP OAuth provider (clients, grants, tokens, props). */
  OAUTH_KV: KVNamespace;
  /**
   * KV namespace for rate limiting. Optional: the OTP send guards treat an
   * absent binding as "no local guard" (the provider's own limits remain the
   * hard bound) — a KV failure must never block a send.
   */
  RATE_LIMIT?: KVNamespace;
  /** OAuth helpers injected into `env` by the OAuthProvider before handlers run. */
  OAUTH_PROVIDER?: OAuthHelpers;
  /**
   * Cloudflare Workflow binding for CodCapiWorkflow.
   * Fires CAPI Purchase events at order delivery — decoupled from status handler.
   */
  CAPI_WORKFLOW: Workflow;
}
