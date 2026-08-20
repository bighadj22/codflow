# CodFlow — repository instructions for coding agents

CodFlow is a cash-on-delivery (COD) e-commerce platform for Algeria. Monorepo,
TypeScript, deployed on Cloudflare (Workers, D1, R2, KV).

## Layout

- `cod-server/` — Cloudflare Workers API (Hono). Merchant `/api/*`, public
  `/store/*`, `/webhooks`, `/images`, `/mcp`. D1 via Drizzle.
- `cod-client/` — Next.js merchant dashboard (App Router, `"use client"`
  heavy). `app/(dashboard)/*` is the merchant UI.
- `cod-shared/` — shared Drizzle schema, queries, RBAC scopes, error codes.
  Imported by both apps via relative path (`../../cod-shared/...`). **Not
  published.**
- `cod-astro/theme01/` — storefront theme (Astro). No package.json; it is a
  swappable theme layer, not a Node package.

There is **no root package.json and no npm workspaces**. Each package installs
its own dependencies.

## Commands

Each package has its own lockfile. Install and run inside the package dir:

```sh
cd cod-shared && npm ci        # always first — others resolve cod-shared deps
cd cod-server && npm ci        # then
cd cod-server && npm run typecheck
cd cod-server && npm test
cd cod-server && npm run dev   # wrangler dev :8787
```

Same for `cod-client` (`npm ci`, `npm run typecheck`, `npm test`, `npm run dev`).

`cod-astro/theme01` needs no install (`npm run dev` inside it starts Astro).

## Verification

- After changing TypeScript: run `npm run typecheck` in the affected package.
- After changing behavior: run `npm test` in the affected package.
- Full CI runs typecheck + tests for cod-server and cod-client
  (`.github/workflows/ci.yml`).

## Conventions

- **README claims must be code-verified.** Never write a feature claim in the
  README that is not actually implemented. Before editing README feature lists,
  confirm the code exists.
- **Never commit secrets.** No live API keys, carrier tokens, or credentials in
  source, tests, or fixtures. Real secrets go in `wrangler secrets` /
  `.dev.vars` (gitignored).
- No explanatory code comments unless asked.

## Boundaries

- `cod-shared` is the single source of truth for the D1 schema, queries, RBAC
  scopes, and error codes. Do not duplicate schema or scope definitions in
  cod-server or cod-client.
- Migrations: add a new migration; never rewrite an already-applied one.
- Ask before adding a production dependency or changing the D1 schema.
- Keep engine logic out of `cod-astro/theme01`; the theme layer is meant to be
  swappable.

## Known traps

- Running cod-server/cod-client tests or typecheck fails if `cod-shared`
  dependencies are not installed first.
- Inbound webhooks exist only for **Yalidine** and **ZR Express**. NOEST and
  EcoTrack tracking is pulled on demand via `GET /orders/:id/tracking` — there
  is no inbound receiver for them.
- The abandoned-order dashboard page
  (`cod-client/app/(dashboard)/orders/abandoned`) is a "Coming Soon"
  placeholder; the backend collection + cron exist, the merchant UI does not.
- cod-server tests run on miniflare + better-sqlite3 locally with no network
  or credentials required.