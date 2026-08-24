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

There is **one root `package.json` with npm workspaces** and ONE root
`package-lock.json`. Never add per-package lockfiles —
`@opennextjs/cloudflare` detects monorepos by walking up for the nearest
lockfile, so a nested one makes every cod-client deploy fail
(`ENOENT pages-manifest.json`). The root also carries the repo-wide npm
`overrides`: the single-Vite pin (theme01) and a sharp stub (native binaries
cannot run on Workers; cod-client uses `images.unoptimized`).

## Commands

One install at the repo root covers every package:

```sh
npm ci                          # at repo root — installs all workspaces

cd cod-server && npm run typecheck
cd cod-server && npm test
cd cod-server && npm run dev   # wrangler dev :8787
```

Same for `cod-client` (`npm run typecheck`, `npm test`, `npm run dev`).

`cod-astro/theme01` has extra validators — see
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

- Never create per-package `package-lock.json` files (see Layout). If a
  workspace's deps look stale, run `npm ci` at the repo root.
- `cod-client/next.config.mjs` deliberately does NOT pin `turbopack.root` or
  `outputFileTracingRoot`: with a single root lockfile, Turbopack and Next
  infer the monorepo root themselves, which is what lets
  `../../cod-shared/*` imports resolve AND what keeps OpenNext's standalone
  output layout consistent. Re-adding either pin re-breaks one of the two.
- The Vite pin lives in the **root** `package.json`
  (`"overrides": { "vite": "^8.2.2" }`) — npm ignores `overrides` inside
  workspace members. It keeps a single Vite major across astro/vitest;
  removing it reintroduces the dual-Vite boot crash
  (`Missing field 'moduleType'`). Keep it in sync when astro bumps Vite.
- Same for the sharp stub override: native binaries cannot run on Workers.
  Do not install real `sharp` into cod-client.
- Better Auth 1.7 schema requirements live in migrations 0010/0011:
  `accounts.issuer` ('local:credential', account_id = user id) and
  `jwkss.alg/crv`. cod-client ships its own KV `secondaryStorage` in
  `lib/auth.ts` because better-auth-cloudflare@0.3.1 lacks the `increment`
  method its rate limiter requires — do not swap back to `kv:` shortcut.
- OAuth provider tables predate better-auth 1.7: `oauthClients`,
  `oauthAccessTokens`, `oauthRefreshTokens`, `oauthConsents` are missing some
  1.7 columns, and `oauthResource(s)`, `oauthClientResource(s)`,
  `oauthClientAssertion(s)` do not exist yet. Core auth + dashboard work;
  MCP client token flows may need that alignment before heavy use.
- Inbound webhooks exist only for **Yalidine** and **ZR Express**. NOEST and
  EcoTrack tracking is pulled on demand via `GET /orders/:id/tracking` — there
  is no inbound receiver for them.
- The abandoned-order dashboard page
  (`cod-client/app/(dashboard)/orders/abandoned`) is a "Coming Soon"
  placeholder; the backend collection + cron exist, the merchant UI does not.
- cod-server tests run on miniflare + better-sqlite3 locally with no network
  or credentials required.
## Skills

This project has custom skills for AI agents. When working on specific tasks, activate the relevant skill:

### Route Builder (API Endpoints)

For creating or migrating API endpoints, use the **route-builder** skill:

```bash
# Activate the skill (if using Kiro with skills)
disclose_context: route-builder
```

This skill provides:
- **SKILL.md** - Quick reference for the defineRoute() pattern
- **MIGRATION.md** - Step-by-step guide for migrating existing endpoints
- **NEW-ENDPOINTS.md** - Guide for creating new endpoints
- **EXAMPLES.md** - Real-world examples from the codebase

### Key Patterns

**Always use defineRoute() for new endpoints:**
```typescript
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const myRoute = defineRoute({
  method: "get",
  path: "/my-resource",
  auth: { scope: SCOPES.RESOURCE_READ },  // Always use SCOPES constants
  handler: handlers.list,
});

router.openapi(myRoute.route, myRoute.handler);
```

**Migration workflow:**
1. Create `routes.prototype.ts` 
2. Convert routes using defineRoute()
3. Run tests: `npm test -- <endpoint>`
4. Verify no behavior changes

### Available Skills

| Skill | When to Use |
|-------|-------------|
| `route-builder` | Creating or migrating API endpoints |
| `code-review` | Reviewing code changes |
| `codebase-design` | Understanding architecture |
| `prototype` | Building throwaway prototypes |
| `improve-codebase-architecture` | Refactoring or architecture changes |
| `tdd` | Test-driven development |
| `wayfinder` | Navigating the codebase |
| `codflow-setup` | Setting up the project |
| **`diagnosing-bugs`** | **Debug production issues (orders, delivery, payments)** |
| **`domain-modeling`** | **Design data models for complex domain** |
| **`implement`** | **Turn specs into working code** |
| **`to-spec`** | **Convert ideas into formal specifications** |
| **`to-tickets`** | **Break features into GitHub issues** |

For more details on any skill, see the `.agents/skills/` directory.