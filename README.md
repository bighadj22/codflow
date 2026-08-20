# CodFlow

> **v0.1.0** — CodFlow is released and production-ready for self-hosting. See
> [`CHANGELOG.md`](./CHANGELOG.md) for the release history.

**The open-source, COD-first e-commerce + delivery platform for Algeria — built agentic-ready.**

CodFlow is a self-hosted commerce suite — storefront, merchant dashboard, and
backend engine — purpose-built for **Cash on Delivery** (COD) and designed from
day one for **AI agents**. It runs entirely on your own Cloudflare account and
feeds **real** conversions back to Meta advertising so your campaigns optimize
on revenue, not refusals. Beyond selling, it's a full **delivery platform**:
in-house driver fleet management, per-wilaya driver pay, and direct
integrations with Algeria's major couriers (Yalidine, ZR Express, NOEST,
EcoTrack) — labels, tracking, and real-time status sync included.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  AGENTIC-READY  •  COD-FIRST  •  SELF-HOSTED  •  CLOUDFLARE NATIVE  •  OPEN │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Contents

- [Why CodFlow](#why-codflow)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deploying to production](#deploying-to-production)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why CodFlow

Most "e-commerce platforms" are a CRUD dashboard with a payment gateway bolted
on. CodFlow is different on three axes:

### 1. Agentic-ready by design

CodFlow ships a complete **MCP remote server** (Model Context Protocol) out of
the box, so AI agents can operate the store the same way your staff can —
create and update products and variants, move orders through the delivery
lifecycle, manage customers, stock, offers, and reviews. It's not a plugin you
wire up later: the agent layer speaks to the same engine your dashboard uses.
See [Features → Agentic & AI](#agentic--ai) for the details.

### 2. COD-first for the Algerian market

Algerian e-commerce runs on **payment at the door**. Most platforms are built
for card payments and force you to shoehorn COD on top. CodFlow was designed
around COD from day one:

- **No payment gateways.** Customers order on the storefront and pay cash at
  delivery. Payment happens at the door.
- **Every order ends in one of three states** — `delivered` (a real sale),
  `returned`, or `cancelled`. Only `delivered` is revenue.
- **Meta ads that learn from sales, not clicks.** CodFlow fires `Purchase`
  events through the Conversions API (CAPI) **only when an order is actually
  delivered** — not at order placement. This is the difference between
  optimizing on revenue and paying for the 30–50% of customers who refuse at
  the door.

### 3. Yours, end to end

- **Self-hosted on Cloudflare** — deploy three Workers to your own account
  (D1 + R2 + KV), no lock-in, no per-order fees, no third-party dependency.
- **One shared schema** — storefront, dashboard, and backend read the same D1
  database through a single source of truth (`cod-shared`).
- **Open source** — Apache-2.0; read every line, deploy it, extend it. See
  [License](#license).

---

## Features

### Storefront (`cod-astro`) — customer-facing
- ✅ Product catalog: home, category, listing, and product detail pages
- ✅ COD order form with wilaya-based **shipping calculator** and variant support
- ✅ **Order-verified product reviews** — one per order, tied to the customer's
  order number
- ✅ Trilingual UI — **Arabic, French, English** with full RTL support
- ✅ Swappable **theme layer**: change layout, colors, fonts, and copy without
  touching the engine (`cod-astro/theme01/src/theme/`)
- ✅ Abandoned-order tracking on the product page

### Dashboard (`cod-client`) — merchant control room
- ✅ **Analytics** — orders, revenue, conversion, return rate, active deliveries
- ✅ **Orders** — full status lifecycle and shipping labels
- ✅ **Customers** — profiles, groups, and tags
- ✅ **Products** — categories, variants (color/pattern/size), stock & alerts, offers, reviews
- ✅ **Delivery** — shipping profiles & wilaya rules, in-house drivers
  (compensations + payments), carrier companies & stop desks
- ✅ **Returns** — partial or full returns with quantity tracking
- ✅ **Team** — staff roles with granular **RBAC scopes** (per-route, per-action)
- ✅ **Settings** — store branding/theme and **Meta Pixel configuration**
- ✅ **Rate limiting** — sign-in & password-reset throttling via Cloudflare KV
- ✅ **MCP** — issue scoped OAuth tokens so AI agents can operate on your data

### Backend engine (`cod-server`) — the API
- ✅ `/api/*` — merchant API, secured by Better Auth sessions + RBAC
- ✅ `/store/*` — public storefront API, per-store key authentication
- ✅ `/webhooks` — delivery-event receivers for **Yalidine** and **ZR Express**
  (Svix HMAC-verified) — carrier status changes update orders in real time
- ✅ `/images` — cached, public image delivery from R2
- ✅ OpenAPI spec served at `/api/openapi.json`
- ✅ **Meta CAPI engine** — `CodCapiWorkflow` fires `Purchase` events at delivery,
  respecting Meta's 7-day attribution window and per-zone delivery times
- ✅ **MCP remote server** — RFC 9728-protected `/mcp` endpoint for AI agents
- ✅ **Abandoned-order cron** — hourly sweep flags pending orders
- 🧭 Zone-aware delivery classification (Fast / Standard / Slow / Long-haul) —
  designed, roadmap

### Delivery & Fulfillment — built for COD logistics

- ✅ **In-house driver fleet** — driver profiles (availability, vehicle type),
  order assignment, and **per-wilaya compensation** (`driver_compensations`),
  plus cash remittance & fee settlement via driver payments
- ✅ **Carrier integrations** — Yalidine, ZR Express, NOEST, and EcoTrack behind
  one unified adapter interface: create & validate shipments, fetch **shipping
  labels**, and pull live tracking
- ✅ **Real-time status sync** — Yalidine + ZR Express webhooks update order
  statuses automatically (Svix HMAC-verified); NOEST & EcoTrack tracking pulled
  on demand
- ✅ **Stop desks** — sync carrier pickup points, filter by wilaya, and toggle
  availability for stop-desk delivery
- ✅ **Shipping profiles** — "rate cards" with per-wilaya **home (door-to-door)**
  and **stop-desk (pickup)** prices, a default profile for the storefront
  calculator, and per-product overrides
- ✅ **Full order lifecycle** — dispatch to a carrier, labels, tracking, driver
  assignment, and partial/full returns
- ✅ **Abandoned-order collection** — storefront tracking + hourly sweep flag
  pending orders (dashboard recovery UI in development)

### Shared (`cod-shared`)
- ✅ Single D1 schema — one source of truth for both apps
- ✅ Shared read queries, RBAC scope registry, and error codes

### Agentic & AI — first-class, not bolted on

The agent layer is a core subsystem, not an afterthought:

- ✅ **Remote MCP server** at `/mcp` — speak MCP over HTTP to Claude, ChatGPT,
  Cursor, or any MCP client and let it run the store.
- ✅ **Stateful sessions** — each conversation lives in its own Durable Object
  (`CodMcpAgent`), so agents keep context across turns.
- ✅ **OAuth + JWKS verification** (RFC 9728) — tokens are verified offline
  against the dashboard's published keys; the well-known endpoint is public so
  any client can discover the flow.
- ✅ **RBAC-scoped tools** — 14 tool factories (orders, products, customers,
  drivers, driver payments, stock, offers, reviews, shipping profiles, wilayas,
  groups & tags). A tool is never even shown to the model unless the user's
  scopes allow it.
- ✅ **Durable Workflows** — `CodCapiWorkflow` runs long-lived, retried jobs
  (Meta CAPI events with exponential backoff) that never block request handling.
- ✅ **Auditable** — every agent action is gated by the same permission checks
  as the dashboard UI.

---

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │              cod-shared                  │
                         │   D1 schema • RBAC scopes • queries      │
                         └───────────────┬──────────────────────────┘
                                         │ relative imports
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
      ┌───────▼───────┐         ┌────────▼────────┐        ┌────────▼────────┐
      │  Storefront   │         │     Backend     │        │   Dashboard     │
      │  cod-astro    │──/store─▶  cod-server     │◀──/api─│  cod-client     │
      │  (customer)   │  API    │    (engine)     │  API   │  (merchant)     │
      └───────┬───────┘         └───┬─────┬───────┘        └─────────────────┘
              │                     │     │
              │               /webhooks   │ CodCapiWorkflow
              │              carrier calls│
              │                     │     └─────────▶ Meta Conversions API (CAPI)
              │                     │                 (Purchase @ delivered)
              │                     │
              │              ┌──────▼──────┐
              │              │ Carriers    │   Yalidine • ZR Express  (webhooks)
              │              │  APIs       │   NOEST • EcoTrack       (tracking pull)
              │              └─────────────┘
              │
              │        /images (R2)      /mcp (AI agents, OAuth-scoped)
              └───────────────────────────────────────────────▶
```

All storage lives in **Cloudflare D1** (SQLite) and **R2** (images). The three
Workers share one local D1 state during development.

---

## Tech Stack

| Package | Stack | Runtime |
|---------|-------|---------|
| `cod-astro/theme01` | Astro 7, Tailwind CSS v4, TypeScript | Cloudflare Workers + Assets |
| `cod-server` | Hono 4, Drizzle ORM, Zod, Better Auth, Cloudflare Agents SDK | Cloudflare Workers, D1, R2 |
| `cod-client` | Next.js 16, React 19, Tailwind v4, OpenNext | Cloudflare Workers |
| `cod-shared` | Drizzle ORM, TypeScript | source-shared |

---

## Getting Started

A step-by-step guide to run the full stack locally — storefront, dashboard,
and backend sharing one database.

### 0. Prerequisites

- **Node.js 22.12+** and npm
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
  (`npm i -g wrangler`)
- A Cloudflare account with **Workers**, **D1**, and **R2** (free tier is fine)

### 1. Clone & install

```bash
git clone <your-fork-or-repo-url> codflow
cd codflow

cd cod-server        && npm install
cd ../cod-client     && npm install
cd ../cod-astro/theme01 && npm install
```

> There is no root workspace — each package installs and runs its own scripts.

### 2. Create your Cloudflare resources

```bash
wrangler login
wrangler d1 create codflow-db
wrangler r2 bucket create codflow-images
wrangler kv namespace create RATE_LIMIT_KV   # used by cod-client
```

### 3. Configure each package

Every package ships a Wrangler config with placeholder values
(`cod-server`/`cod-client`: `wrangler.toml`; `cod-astro/theme01`: `wrangler.jsonc`)
and a `.dev.vars.example`. Copy the examples and paste your own resource IDs:

```bash
# Backend
cd cod-server
cp .dev.vars.example .dev.vars
# → paste your database_id / bucket_name into wrangler.toml

# Dashboard
cd ../cod-client
cp .dev.vars.example .dev.vars
# → paste database_id + kv id into wrangler.toml
# → generate a secret:  openssl rand -base64 32   →   BETTER_AUTH_SECRET

# Storefront
cd ../cod-astro/theme01
cp .dev.vars.example .dev.vars
```

> The storefront's `STORE_API_KEY` must match the key the backend seeds. The
> defaults (`codflow-dev-store-key`) already line up.

### 4. Create the database & seed

```bash
cd cod-server
npm run db:setup:local     # apply migrations + seed a demo store
```

### 5. Create an admin account

```bash
cd cod-client
ADMIN_EMAIL=you@example.com ADMIN_NAME=You node scripts/seed-admin.mjs
```

The script prints a generated **password** and **API key**. You need this to
sign into the dashboard.

### 6. Run the stack

Open three terminals (D1 state is shared through `<repo-root>/.wrangler-shared`,
so all three read the same local database):

| # | Command | What runs |
|---|---------|-----------|
| 1 | `cd cod-server && npm run dev` | API on `http://localhost:8787` (+ OpenAPI spec at `/api/openapi.json`) |
| 2 | `cd cod-client && npm run dev` | Dashboard on `http://localhost:3000` |
| 3 | `cd cod-astro/theme01 && npm run dev` | Storefront on `http://localhost:4321` |

### 7. Verify it works

1. Open **http://localhost:4321** — browse products, place a test COD order.
2. Open **http://localhost:3000** — sign in with the admin account from step 5.
3. Your order appears in the dashboard. Move it through the status lifecycle.
4. Confirm the OpenAPI spec loads at **http://localhost:8787/api/openapi.json**.

---

## Deploying to production

Each package deploys to its own Worker on your Cloudflare account. Do steps
2–3 of [Getting Started](#getting-started) first (resources + config), then:

### 1. Deploy the backend

```bash
cd cod-server
npm run deploy                # wrangler deploy
wrangler secret put BETTER_AUTH_SECRET    # same value as the dashboard's
```

### 2. Deploy the dashboard

```bash
cd cod-client
npm run deploy                # OpenNext build + wrangler deploy
wrangler secret put BETTER_AUTH_SECRET
```

### 3. Deploy the storefront

```bash
cd cod-astro/theme01
npm run build && wrangler deploy
wrangler secret put STORE_API_KEY           # the key your backend issues
wrangler secret put COD_SERVER_URL          # your deployed backend URL, e.g. https://api.example.com
```

### 4. Point the dashboard at production

Set `NEXT_PUBLIC_WORKER_URL` to your deployed backend URL and redeploy
`cod-client`. Then **change your store's Pixel config** in Settings → Meta to
start firing CAPI events on real deliveries.

> Production secrets go in `wrangler secret put` — **never** in `wrangler.toml`.

---

## Testing

Each package ships its own Vitest suite:

```bash
cd cod-server        && npm test      # ~700 tests (handlers, validation, MCP, workflows)
cd cod-client        && npm test      # ~140 tests (actions, RBAC, i18n)
cd cod-astro/theme01 && npm test      # property + behavior tests (fast-check)
```

Build each package before deploying:

```bash
cd cod-server && npm run build:ci     # wrangler dry-run
cd cod-client && npm run build
cd cod-astro/theme01 && npm run build
```

---

## Documentation

- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — contributor guide: setup,
  conventions, testing, commit & PR rules.
- **[`SECURITY.md`](./SECURITY.md)** — supported versions and how to report a
  vulnerability privately.
- **[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)** — community standards for
  participants.
- **[`SUPPORT.md`](./SUPPORT.md)** — where to get help.
- **[`CHANGELOG.md`](./CHANGELOG.md)** — release history (Keep a Changelog).
- **[`AGENTS.md`](./AGENTS.md)** — instructions for AI coding agents working in
  this repository.
- **[`cod-astro/theme01/THEME_GUIDE.md`](./cod-astro/theme01/THEME_GUIDE.md)** —
  storefront customization walkthrough.
- **[`cod-astro/theme01/README.md`](./cod-astro/theme01/README.md)** — storefront
  package: setup, env vars, scripts, deployment.
- **Per-package docs** — `cod-server/README.md`, `cod-client/README.md`, and
  per-endpoint READMEs under `cod-server/src/endpoints/*/README.md`.

---

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the
full guide. The essentials:

1. **No secrets in `wrangler.toml`** — `.dev.vars` locally, `wrangler secret put` in prod.
2. **No hardcoded URLs or domains** — everything must be swappable so a fresh
   clone runs against its own Cloudflare account.
3. Run `npm test` + the package build before opening a PR.

---

## License

CodFlow is open source under the **Apache License 2.0**.

See [`LICENSE`](./LICENSE) for the full terms, and [`NOTICE`](./NOTICE) for
copyright attribution.
