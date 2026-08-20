/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  // ─── D1 database ──────────────────────────────────────────────────────────────
  DB: D1Database;

  // ─── Worker backend URL ───────────────────────────────────────────────────────
  WORKER_URL: string;
  NEXT_PUBLIC_WORKER_URL: string;

  // ─── Dashboard app URL ────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: string;

  // ─── better-auth ──────────────────────────────────────────────────────────────
  // Set via: wrangler secret put BETTER_AUTH_SECRET
  BETTER_AUTH_SECRET: string;

  // ─── Email Service ────────────────────────────────────────────────────────────
  SEND_EMAIL: SendEmail;

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  RATE_LIMIT_KV: KVNamespace;
}
