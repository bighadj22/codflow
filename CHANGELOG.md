# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- notifier: a standalone `cod-order-notifier/` Cloudflare Worker that polls the
  orders API read-only (`orders:read`) every minute and forwards new orders to
  Telegram. It seeds current orders silently on first run, records notified
  order ids in a KV namespace so restarts/redeploys never re-alert, and keeps
  its secrets in `wrangler secret` / `.dev.vars` (never logged)
- delivery: the ZR Express connection test (`POST
  /delivery-companies/:id/test-connection`) now works — it probes
  `GET /users/profile` and names the failure: a dead API key (`invalid_token`),
  a key bound to another tenant (`tenant_mismatch`, listing the tenants the key
  may reach) or a valid key (`valid`, with the logged-in user)
- checkout-form: the storefront order form is configurable per store (migration
  0031 + `stores.checkout_form_json`) — require or hide the address, notes and
  email, turn a delivery option off, and add up to 5 questions of the
  merchant's own. Dashboard → Checkout form, its own page with a live preview of
  what shoppers will see and `checkout_form:read` / `checkout_form:manage`
  scopes. A store that never opens it keeps a NULL column, which reads as the
  original form, so nothing changes until a merchant asks for it; rollback for
  the whole feature is `UPDATE stores SET checkout_form_json = NULL`
- checkout-form: every rule is defined once in `cod-shared/checkout-form/` and
  enforced by cod-server on `POST /store/orders`, not by the theme — the same
  discipline as the OTP and Turnstile gates. The read path is lenient and never
  throws (a configuration written by a newer deploy must not stop a store
  selling); the write path is strict and refuses unknown keys, so a dashboard
  typo cannot vanish silently. Hidden fields that still arrive from an
  edge-cached page are stripped; a delivery option the merchant turned off is
  **refused** rather than rewritten, because rewriting it would charge a
  delivery fee the shopper was never shown
- checkout-form: the address cannot be hidden, only made required or optional —
  every carrier adapter sends it for a home delivery, so hiding it would be a
  setting whose only outcome is parcels the carrier rejects. Required applies to
  home delivery only, and the storefront drops the requirement while the field
  is hidden for a stop-desk order (a required field inside a hidden container
  makes the browser refuse to submit, with no message the shopper can read)
- checkout-form: custom questions are informational — answers are stored on the
  order (`orders.custom_fields_json`) with the label they had at the time, so
  renaming or deleting a question never rewrites an old order, and they are
  never sent to carriers or read by pricing. Ids are minted server-side because
  answers are keyed by them; an id the store does not already have is refused.
  Answers travel as one JSON field, since the theme's order action validates
  form input against a fixed whitelist and a flat field per question would mean
  a theme deploy every time a merchant adds one
- checkout-form: `orders.customer_email` — the shopper's email as captured at
  order time, shown on the order in the dashboard. The column
  `DIGITAL_PRODUCTS_PLAN.md` reserved, added once here rather than twice
- tracking: the Meta CAPI event now carries the shopper's email as the hashed
  `em` identifier when an order has one. Email is the strongest signal Meta
  matches on after the phone, so this is most of the value in storing it;
  hashed with the shared SHA-256 helper (which lowercases and strips
  whitespace, exactly Meta's rule for `em`) and never sent in the clear. An
  order without one sends the event unchanged
- storefront: required dropdowns are finally enforced in the browser. Select's
  value lives in a `type="hidden"` input, which the HTML spec bars from
  constraint validation, so `required` on one was inert — an unanswered wilaya
  submitted silently and the shopper found out from the server. Now blocked
  client-side with the message shown, `aria-invalid` set and focus moved to the
  trigger; bound in the capture phase so a blocked submit cannot leave the
  confirm button disabled, and never blocking over a dropdown that is not
  rendered. Fixes wilaya and commune too, not just a merchant's new question
- orders: the dashboard's New order form can capture a customer email, stored
  in the same canonical form the storefront writes so one customer is one
  string in the column however the order was taken. Optional on that path
  whatever the storefront asks for — staff on a call either have the address or
  they do not

- legal-pages: store-owned content pages — Terms, Privacy, Refund/Return and
  Shipping, pre-seeded per store with Algeria-COD-grounded templates (migration
  0030 + `store_pages` / `store_page_translations` / `store_legal_profile`)
  because Meta Ads rejects a storefront that has none. Templates are authored
  as typed data (`cod-shared/legal/`), not HTML strings, so a merchant fact
  with no value (no RC number, no return window) drops its clause instead of
  rendering a placeholder. Content is sanitised through the same
  `cod-shared/lib/rich-text.ts` allow-list product descriptions use, at one
  write chokepoint every path — merchant edit, seed, or template reset — goes
  through
- legal-pages: `/api/store-pages` — merchant CRUD, per-locale save, "reset to
  the current template," custom pages (kind=custom, not seeded, deletable —
  legal kinds can only be unpublished), and the store's legal profile (RC/NIF,
  contact, return and delivery windows) that templates render from; Dashboard
  → Pages: TipTap editor (the same one product descriptions use), locale tabs
  led by the store's own language, SEO fields, a completeness banner, and a
  one-click "Add Terms, Privacy, Refund & Shipping" for a store that predates
  this feature
- legal-pages: `GET /store/pages/{slug}` + `/store/config`'s new `pages[]` and
  `legalContact` — theme01's `/pages/<slug>` renders the resolved page (real
  404 for draft/unknown, never a soft 200); the footer's Shipping/Returns
  column, previously two dead `<span>`s with no `href`, now links to whatever
  is actually configured; the checkout form gains a Terms/Refund consent line
  resolved by page **kind**, never a hardcoded slug
- legal-pages: `stores.lang` widened to include `fr` (type-only — the column
  had no CHECK constraint) so a French-language store can actually be
  configured, matching the `fr` content pack theme01 already shipped
- cart: opt-in shopping cart, per store (migration 0027 + `stores.cart_enabled`,
  Dashboard → Settings → Shopping cart). **Off by default**: a store that never
  turns it on ships no cart markup and keeps its one-click order form exactly as
  it is. When on, product pages gain a secondary "Add to cart" beside the order
  form, the header gains a cart trigger, and a side drawer shows the basket with
  live quantity controls priced by the server
- cart: `/checkout` — a dedicated page for basket orders: editable order
  summary, free-delivery progress, live delivery fee as the wilaya and delivery
  type are chosen, running total, plus the existing customer fields, WhatsApp
  OTP gate and Turnstile. The single-product express form is untouched and is
  never used for a basket. Closed (302 to `/`) when the merchant has the cart
  off, and `noindex`
- cart: `POST /store/cart/validate` — re-prices a basket from the catalog and
  reports per-line stock and availability, so the drawer and the checkout page
  cannot show a total the order engine would not charge
- cart: multi-line storefront orders end to end — one order carries several
  products, each with its own variant and quantity, through pricing, offers,
  stock deduction, dispatch and the dashboard. Capped at 20 distinct lines and
  100 units per line
- cart: delivery-pricing settings (migration 0026) — free-shipping threshold and
  how a basket mixing shipping profiles is charged (highest rate in the basket,
  or always the default profile), both merchant choices with our recommendation
  as the default
- cart: abandoned checkouts capture the whole basket (migration 0028 +
  `abandoned_orders.items_json` / `item_count`), and the dashboard's abandoned
  list shows every line with its quantity and line total. Single-product records
  are stored and rendered exactly as before
- cart: Meta Pixel `AddToCart` on each add, and `InitiateCheckout` on the
  checkout page carrying the basket and the server-validated subtotal. Stores
  with no pixel configured are unaffected
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

- mcp: the remote MCP endpoint (`/mcp`) serves 2025-era clients again. The
  handler was built with `legacy: "reject"`, which does not mean "stateless"
  as the code assumed — it drops the Agents SDK's 2025-era lane and makes the
  endpoint modern-only (2026-07-28), so every client in wide use died at the
  `initialize` handshake with `-32022 Unsupported protocol version`. `legacy`
  now keeps its `"stateless"` default, which serves both eras, and
  `src/mcp/protocol-negotiation.test.ts` pins the handshake
- delivery: carrier failures now carry an actionable message instead of an
  empty one — a body of `{"message": ""}` (EcoTrack, NOEST) falls through a
  `??` fallback because an empty string is not nullish, and ZR Express's
  plain-text `Invalid API Key` answer died in `res.json()`, so the dashboard
  only ever showed a generic dispatch failure. Adapters now fall back to
  `HTTP <status>` plus a bounded snippet of the raw body, `flattenErrorBag`
  no longer returns an empty string, and dispatch failure logs record
  `company_api_logs.http_status` from the carrier's status code
- dashboard: the dispatch failure toast now carries the carrier's own message
  (`Échec de l'expédition: ZR Express HTTP 401 (body: Invalid API Key)`)
  instead of the bare label — the detail was already written to the inline
  error banner, only the toast dropped it
- delivery: **product-level shipping profiles were silently ignored at
  checkout** — a product assigned its own profile was charged the store
  default, so every order of that product under-collected (or over-collected)
  delivery. Resolution now considers each product's own profile
- delivery: **commune-level shipping overrides were silently ignored at
  checkout** — a per-commune rate the merchant had set never reached the
  order. Overrides now apply, and are compared before the highest-rate rule
  picks a winner for a mixed basket
- checkout: delivery-fee resolution no longer confuses "inherit" with
  "free" — a NULL rate means inherit, `0` means the merchant set it to zero,
  and a free-shipping threshold can no longer override a profile that refuses
  delivery to a commune
- performance: catalog reads per checkout reduced from one round trip per
  product to a single batched read, so a multi-line order costs roughly the
  same number of database round trips as a single-product one
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
