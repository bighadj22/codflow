/**
 * Cloudflare Worker environment bindings.
 * Declared in wrangler.toml — keep this in sync.
 */
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
   * Durable Object namespace for MCP sessions. One DO instance per MCP
   * session (sse / streamable-http) — holds transport state + pending
   * elicitations. Declared by the `[[durable_objects.bindings]]` block in
   * wrangler.toml (added in MCP-9).
   */
  MCP_SESSIONS: DurableObjectNamespace;
  /**
   * Cloudflare Workflow binding for CodCapiWorkflow.
   * Fires CAPI Purchase events at order delivery — decoupled from status handler.
   */
  CAPI_WORKFLOW: Workflow;
}
