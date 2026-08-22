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
- `cod-astro/theme01/` — storefront theme (Astro). It is a swappable theme
  layer, not a platform package; keep engine logic out. Its commands and
  boundaries differ — read `cod-astro/theme01/AGENTS.md` before editing it.

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

`cod-astro/theme01` is a separate package with its own lockfile — see
`cod-astro/theme01/AGENTS.md` for its commands.

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
  swappable (see `cod-astro/theme01/AGENTS.md`).

## Known traps

- Running cod-server/cod-client tests or typecheck fails if `cod-shared`
  dependencies are not installed first.
- In `cod-client/next.config.mjs`, `turbopack.root` AND
  `outputFileTracingRoot` must stay pointed at the monorepo root
  (`path.resolve(import.meta.dirname, "..")`, same value for both keys).
  Reverting either to `process.cwd()` breaks `../../cod-shared/*` imports
  under Turbopack (`Can't resolve` on every page).
- Keep the `"overrides": { "vite": "^8.2.2" }` pin in
  `cod-astro/theme01/package.json` (single Vite major across astro/vitest).
  It is load-bearing: removing it reintroduces the dual-Vite boot crash
  (`Missing field 'moduleType'`). Keep it in sync when astro bumps Vite.
- Inbound webhooks exist only for **Yalidine** and **ZR Express**. NOEST and
  EcoTrack tracking is pulled on demand via `GET /orders/:id/tracking` — there
  is no inbound receiver for them.
- The abandoned-order dashboard page
  (`cod-client/app/(dashboard)/orders/abandoned`) is a "Coming Soon"
  placeholder; the backend collection + cron exist, the merchant UI does not.
- cod-server tests run on miniflare + better-sqlite3 locally with no network
  or credentials required.