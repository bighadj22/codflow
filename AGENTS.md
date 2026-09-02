# CodFlow — repository instructions for coding agents

CodFlow is a cash-on-delivery (COD) e-commerce platform for Algeria. Monorepo,
TypeScript, deployed on Cloudflare (Workers, D1, R2, KV).

## Layout

- `cod-server/` — Cloudflare Workers API (Hono). Merchant `/api/*`, public
  `/store/*`, `/webhooks`, `/images`, `/mcp`. D1 via Drizzle.
- `cod-client-astro/` — the merchant dashboard (Astro 7). Prerendered static
  pages + a Worker surface for `/api/auth/*` and `/mcp/oauth/login`; React
  islands fetch data from cod-server through `src/lib/api.ts` (the only module
  allowed to call the API). UI strings come from `locales/{ar,en,fr}` via
  `useT(namespace)` — the i18n guard test enforces three-locale parity.
- `cod-shared/` — shared Drizzle schema, queries, RBAC scopes, error codes.
  Imported by the apps via relative path (`../../cod-shared/...`). **Not
  published.**
- `cod-astro/theme01/` — storefront theme (Astro). It is a swappable theme
  layer, not a platform package; keep engine logic out. Its commands and
  boundaries differ — read `cod-astro/theme01/AGENTS.md` before editing it.

There is **one root `package.json` with npm workspaces** and ONE root
`package-lock.json`. Never add per-package lockfiles. The root also carries the
repo-wide npm `overrides`: the single-Vite pin (keeps one Vite major across
astro/vitest; npm ignores `overrides` inside workspace members).

## Commands

One install at the repo root covers every package:

```sh
npm ci                          # at repo root — installs all workspaces

cd cod-server && npm run typecheck
cd cod-server && npm test
cd cod-server && npm run dev   # wrangler dev :8787
```

Same for `cod-client-astro` (`npm run typecheck`, `npm test`, `npm run dev`
— astro dev on :4321). Admin bootstrap: `cd cod-client-astro &&
npm run seed:admin` (sign-up is disabled by design).

`cod-astro/theme01` has extra validators — see
`cod-astro/theme01/AGENTS.md` for its commands.

## Verification

- After changing TypeScript: run `npm run typecheck` in the affected package.
- After changing behavior: run `npm test` in the affected package.
- Full CI runs typecheck + tests for cod-server and cod-client-astro, plus
  `astro check` + tests for theme01 (`.github/workflows/ci.yml`).

## Conventions

- **README claims must be code-verified.** Never write a feature claim in the
  README that is not actually implemented. Before editing README feature lists,
  confirm the code exists.
- **Never commit secrets.** No live API keys, carrier tokens, or credentials in
  source, tests, or fixtures. Real secrets go in `wrangler secrets` /
  `.dev.vars` (gitignored). Wrangler configs with real resource IDs are
  gitignored too (`wrangler.toml` in cod-server/cod-client-astro) — commit
  `.example` templates only.
- No explanatory code comments unless asked.

## Boundaries

- `cod-shared` is the single source of truth for the D1 schema, queries, RBAC
  scopes, and error codes. Do not duplicate schema or scope definitions in
  cod-server or cod-client-astro.
- Migrations: add a new migration; never rewrite an already-applied one.
- Ask before adding a production dependency or changing the D1 schema.
- Keep engine logic out of `cod-astro/theme01`; the theme layer is meant to be
  swappable (see `cod-astro/theme01/AGENTS.md`).
- Dashboard data access goes through the API seam (`cod-client-astro/src/lib/api.ts`).
  Components never call `fetch` directly, and the dashboard does not query D1
  for business data — authorization lives in cod-server.

## Known traps

- Never create per-package `package-lock.json` files (see Layout). If a
  workspace's deps look stale, run `npm ci` at the repo root.
- The Vite pin lives in the **root** `package.json`
  (`"overrides": { "vite": "^8.2.2" }`) — npm ignores `overrides` inside
  workspace members. It keeps a single Vite major across astro/vitest;
  removing it reintroduces the dual-Vite boot crash
  (`Missing field 'moduleType'`). Keep it in sync when astro bumps Vite.
- Local D1 state is **shared** through `<repo-root>/.wrangler-shared`:
  cod-server's dev/migrate scripts write there via `--persist-to`, and
  cod-client-astro's astro dev reads the same files via the Cloudflare
  adapter's `persistState`. Sign-in against an unmigrated local D1 is the
  #1 "dashboard broken locally" cause — run `cod-server npm run db:setup:local`
  first, then `cod-client-astro npm run seed:admin`.
- `cod-client-astro/.env` (`PUBLIC_API_URL`) is a **build-time** client var —
  changing it requires a rebuild. Runtime vars (`PUBLIC_APP_URL`,
  `PUBLIC_TRUSTED_ORIGINS`) live in wrangler.toml `[vars]`.
- `BETTER_AUTH_SECRET` and `MCP_LOGIN_TICKET_SECRET` must be **identical** on
  cod-server and cod-client-astro (shared auth D1 + MCP login-ticket relay).
- Better Auth 1.7 schema requirements live in migrations 0010/0011:
  `accounts.issuer` ('local:credential', account_id = user id) and
  `jwkss.alg/crv`. cod-client-astro ships its own KV `secondaryStorage` in
  `src/lib/auth/server.ts` because better-auth-cloudflare@0.3.1 lacks the
  `increment` method its rate limiter requires — do not swap back to `kv:`
  shortcut.
- OAuth provider tables predate better-auth 1.7: `oauthClients`,
  `oauthAccessTokens`, `oauthRefreshTokens`, `oauthConsents` are missing some
  1.7 columns, and `oauthResource(s)`, `oauthClientResource(s)`,
  `oauthClientAssertion(s)` do not exist yet. Core auth + dashboard work;
  MCP client token flows may need that alignment before heavy use.
- The dashboard Worker and the storefront both default to port **4321** — run
  one on `--port 4322` when developing both at once.
- Inbound webhooks exist only for **Yalidine** and **ZR Express**. NOEST and
  EcoTrack tracking is pulled on demand via `GET /orders/:id/tracking` — there
  is no inbound receiver for them.
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
| `whatsapp-otp` | WhatsApp OTP verification feature (dzverify) |
| `Ecotrack` | EcoTrack carrier integration |
| **`diagnosing-bugs`** | **Debug production issues (orders, delivery, payments)** |
| **`domain-modeling`** | **Design data models for complex domain** |
| **`implement`** | **Turn specs into working code** |
| **`to-spec`** | **Convert ideas into formal specifications** |
| **`to-tickets`** | **Break features into GitHub issues** |

For more details on any skill, see the `.agents/skills/` directory.
