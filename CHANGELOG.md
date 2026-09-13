# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- checkout: optional per-store Cloudflare Turnstile bot protection on the
  order form (migration 0024 + `store_turnstile_config`), enabled from
  Dashboard → Settings → Verification with the merchant's own site/secret
  keys; token verified server-side against
  `challenges.cloudflare.com/turnstile/v0/siteverify` (fail-open on provider
  outage); see `docs/TURNSTILE.md`

- delivery: per-carrier delivery-zone name sync — `carrier_wilayas` /
  `carrier_communes` tables (migration 0021) + `POST
  /api/delivery-companies/:id/sync-geo` + dashboard "Sync Delivery Zones"
  button; Yalidine dispatches now carry the carrier's exact wilaya/commune
  spellings (accent, punctuation, and distance-1 spelling variants matched;
  ~25% of communes previously failed at the carrier)
- delivery: `GET /api/delivery-companies/:id/webhook/events` — the inbound
  webhook event log becomes readable (outcome filter, pagination, joined
  order numbers); dashboard events panel for every webhook-capable carrier
- delivery: Yalidine webhook setup UI (URL + copy, secret save, guided
  4-step setup, verified/unverified state) and ZR Express webhook
  register/unregister + custom status-mapping editor — both previously
  backend-only
- orders: dispatch delivery-type override (`deliveryType` body field) —
  merchant-side home ⇄ stop-desk switching resolves stop-desk dead ends;
  wilaya-scoped desk picking in the dispatch dialog (cross-wilaya fallback
  removed) with commune desk pre-selection

### Fixed

- delivery: Yalidine webhook signature verification implemented (HMAC-SHA256
  over raw body, hex digest, constant-time compare) — previously a TODO that
  accepted unsigned events
- delivery: Yalidine status mapper rewritten against the documented 36-status
  enum — phantom statuses removed; real return-family statuses
  (`Retourné au vendeur`, `Echèc livraison`, …) now map to `returned`
  instead of leaving orders stuck at `out_for_delivery`; transit statuses
  are deliberate no-ops (previously `Ramassé`/`En préparation` could
  regress a dispatched order)
- webhooks: replayed deliveries (documented carrier retries) no longer 500 —
  duplicate-event detection now walks the Drizzle error cause chain;
  previously every retry threw, eventually auto-disabling the webhook at
  the carrier
- webhooks: late `Tentative échouée` events no longer increment
  deliveryAttempts on terminal orders

### Known Limitations

- **Yalidine outbound calls from Cloudflare Workers are blocked by
  Yalidine's own Cloudflare zone** (HTTP 403, `error code: 1106`). Verified
  exhaustively 2026-09-08: the block is applied at their edge BEFORE
  authentication (no-token requests get the same 403), covers their entire
  zone (even the marketing homepage), applies to `fetch()` AND raw TCP
  sockets, and is token-independent — while the identical requests from
  non-Cloudflare clients succeed. **Impact:** parcel creation (dispatch),
  stop-desk sync, delivery-zone sync, and tracking-history pulls fail with
  502 when called from the production Worker. **Inbound webhooks are
  unaffected** (live-proven: real events arrive, are HMAC-verified,
  deduplicated, and mapped). **Workarounds:** (1) request an allowlist from
  Yalidine (developer@yalidine.com — evidence email drafted in
  report-md/YALIDINE_EGRESS_BLOCK_EMAIL.md, gitignored), or (2) deploy your
  own egress relay on a non-Cloudflare host and set `proxy_base_url` +
  `proxy_secret` in the Yalidine company's notes JSON — the adapter routes
  all carrier calls through it while the keys are present.

### Removed

- **legacy Next.js dashboard (`cod-client/`)** — superseded by cod-client-astro
  in v1.1.0. Its CI job, dependabot entry, gitignore rules, and doc references
  are gone; the sharp stub override (`vendor/sharp-stub`) was a cod-client
  workaround and is removed with it
- cod-client-astro/REFACTOR-CHECKPOINT.md (internal work log)

### Changed

- dev tooling: vitest 4.1.11 → 5.0.0 (with `@vitest/ui` and
  `@vitest/coverage-v8`) across cod-server, cod-client-astro, and theme01 in
  one coordinated bump — the single root Vite pin is unchanged (one
  vite@8.2.2); supersedes the per-package dependabot PRs and folds in the
  fast-uri 3.1.5 → 3.1.7 transitive bump
- no production URLs or account identifiers in committed files: theme01's
  `COD_SERVER_URL` defaults to localhost (production deploys pass the real URL
  via `wrangler deploy --var`), security scripts default to localhost, test
  fixtures use example.com placeholders

## [1.1.0] - 2026-09-02

The dashboard cutover release: the merchant dashboard moves from Next.js
(cod-client, now LEGACY) to Astro (cod-client-astro), plus WhatsApp OTP
verification, EcoTrack, and the MCP SDK v2 refactor.

### Added

- storefront: optional per-store WhatsApp phone verification at checkout
  (dzverify) — off by default; merchant-configurable from the dashboard
  (Settings → Verification); fail-open on provider quota exhaustion
- delivery: EcoTrack carrier integration (82 Algerian couriers behind one API)
  with credentials, catalog sync, and reconciliation in the dashboard
- cod-client-astro: Astro-based merchant dashboard — prerendered static app
  (zero Worker CPU for page serving), better-auth sign-in surface, React
  islands for orders, products, stock, offers, reviews, customers (+groups,
  tags), delivery (drivers, companies, shipping profiles), team RBAC,
  settings, abandoned orders, and MCP connections; Arabic/English/French with
  full RTL
- cod-client-astro: admin seeding (`npm run seed:admin`) — sign-up is disabled
  by design; the local-dev story shares one `.wrangler-shared` D1 across
  cod-server and the dashboard
- cod-client-astro: localized Arabic, English, and French toast feedback for
  authentication, CRUD, delivery, stock, settings, team, MCP, uploads, copies,
  and downloads, including success messages that survive page navigation
- CI now covers all four packages (cod-server, cod-client-astro, theme01, and
  the legacy cod-client until its removal)

### Changed

- **cod-client-astro is the primary merchant dashboard**; cod-client (Next.js)
  is LEGACY — reference only, slated for removal
- cod-server: MCP remote server rebuilt on
  `@cloudflare/workers-oauth-provider` (RFC 9728/8414 discovery, DCR, token
  revocation) with stateless HMAC-sealed elicitation and a dashboard
  login-ticket relay; the MCP_SESSIONS Durable Object binding is replaced by
  the OAUTH_KV KV namespace; new secrets `MCP_REQUEST_STATE_KEY`,
  `MCP_LOGIN_TICKET_SECRET` (MCP_LOGIN_TICKET_SECRET
  must match on the dashboard worker)
- cod-server: COD amount sent to carriers now includes the delivery fee
  (product price + fee); new `POST /orders/:id/ask-return` endpoint
- docs, AGENTS.md, and the codflow-setup skill rewritten for the Astro
  dashboard's environment contract (build-time `.env` PUBLIC_API_URL,
  PUBLIC_APP_URL/PUBLIC_TRUSTED_ORIGINS runtime vars, secret parity)

### Fixed

- theme01: WhatsApp OTP step now bundles correctly (raw script tag 404) and
  auto-submits the order form after verification

### Migration notes (existing deployments)

1. Create an `OAUTH_KV` KV namespace and bind it in cod-server's wrangler.toml
2. Set new secrets on cod-server: `MCP_REQUEST_STATE_KEY` and
   `MCP_LOGIN_TICKET_SECRET`
3. Set the same `BETTER_AUTH_SECRET` and `MCP_LOGIN_TICKET_SECRET` on the
   cod-client-astro worker
4. Apply migration 0012 (`npm run db:migrate:remote` in cod-server)
5. Deploy cod-server → cod-client-astro → theme01

## [1.0.0] - 2026-08-22

First stable release of CodFlow.

### Added

- cod-server: full API migration to `@hono/zod-openapi` — orders, webhooks,
  abandoned-orders, analytics, store API, products/variants/stock/offers,
  customers, drivers, driver-payments, shipping-profiles, images, activity
  logs and delivery-companies now serve auto-generated OpenAPI specs; the
  legacy spec generator is retired
- cod-server: `db:seed:remote` / `db:setup:remote` scripts to migrate and seed
  the Cloudflare D1 database directly during provisioning
- codflow-setup agent skill: guided runbook that creates dedicated D1/R2/KV
  resources, binds their real IDs into both `wrangler.toml` files, uploads
  secrets interactively, migrates and seeds the remote database, and verifies
  deployments with smoke tests

### Fixed

- Fresh clones boot on the first try: the repository is an npm workspace
  monorepo with a single root lockfile, so Turbopack resolves cross-package
  `cod-shared/*` imports natively and OpenNext detects the monorepo correctly
  on every cod-client deploy
- Authentication aligned with better-auth ≥ 1.7 semantics: `accounts.issuer`
  and `jwkss.alg/crv` columns (migrations 0010/0011), credential seeder writes
  the current account shape, and the dashboard ships a complete KV
  `secondaryStorage` (session caching + rate limiting)
- Storefront dev server stability: single Vite major enforced via npm
  overrides (fixes the dual-Vite `Missing field 'moduleType'` boot crash) and
  late SSR dependency discovery disabled (fixes the workerd reload race)
- MCP server peer packages installed explicitly

### Changed

- Repository layout: one root `package.json` + one lockfile for all packages;
  per-package lockfiles removed; repo-wide npm overrides live at the root
  (single Vite major, sharp stub for Workers compatibility)
- cod-client deploys through the official `opennextjs-cloudflare`
  build/deploy/preview commands; theme01 deploys build before deploying
- CI installs once at the repo root and targets workspaces by name
- README, CONTRIBUTING and AGENTS documentation overhauled; setup points at
  the `codflow-setup` runbook instead of one-off helper scripts

## [0.1.0] - 2026-08-20

Initial public release of CodFlow — the open-source, COD-first e-commerce +
delivery platform for Algeria.

### Added

- **cod-server** — Cloudflare Workers API: merchant `/api/*` endpoints (Better
  Auth sessions + RBAC), public `/store/*` endpoints (per-store key auth),
  webhook receivers for Yalidine and ZR Express, image delivery from R2,
  OpenAPI spec, Meta CAPI purchase events, and an MCP remote server
- **cod-client** — Next.js merchant dashboard: analytics, orders, customers,
  products, delivery, returns, team (RBAC), settings, and reviews
- **cod-astro/theme01** — swappable storefront theme: COD order form with
  wilaya-based shipping calculator, variants, order-verified reviews, and
  abandoned-order tracking
- **cod-shared** — single D1 schema, shared queries, RBAC scope registry, and
  error codes consumed by both apps

### Security

- Inbound webhooks (Yalidine, ZR Express) verified with Svix HMAC signatures
- MCP remote server protected with OAuth + offline JWKS verification (RFC 9728)
- API keys hashed at rest (SHA-256); production secrets only via
  `wrangler secret put` — none committed to the repository
- Dependabot security & grouped version updates enabled; branch protection on
  `main`

### Changed

- Storefront upgraded to Astro 7 (Rust compiler, Vite 8); server & dashboard
  upgraded to TypeScript 7 and Vitest 4; Drizzle ORM → 0.45; Next.js → 16;
  Wrangler → 4
