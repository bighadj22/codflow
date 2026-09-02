# cod-client-astro

The CodFlow merchant dashboard, rebuilt with Astro 7 as a prerendered static
app. Page serving consumes **zero Worker CPU** on Cloudflare's free plan; the
only server surface is `/api/auth/*` (better-auth).

Read before contributing:

- `CONTEXT.md` — domain vocabulary (Shell / Island / Identity / API seam / Auth
  surface) and boundaries.
- `DESIGN.md` — the design system (tokens, shell layout, migration rules).

## Scripts

```sh
npm run dev            # astro dev on :4321 (bindings via platformProxy)
npm run build          # prerender → dist/ (+ SSR worker entry for /api/auth/*)
npm run typecheck      # astro check
npm test               # vitest (unit: gate logic)
npm run verify-shells  # fail if shells leak data or reference legacy domains
npm run smoke          # live auth/API gate suite (needs DASH_URL/API_URL/SMOKE_*)
npm run deploy         # wrangler deploy
```

Install/build always happens from the **repo root** (`npm ci` / `npm install`) —
single root lockfile.

## Environment contract

| Where | Variable | Purpose |
|---|---|---|
| `.env` (build time, client) | `PUBLIC_API_URL` | backend origin used by `src/lib/api.ts` |
| `wrangler.toml [vars]` (runtime) | `PUBLIC_APP_URL` | better-auth base URL (JWT issuer) |
| `wrangler.toml [vars]` | `PUBLIC_TRUSTED_ORIGINS` | extra origins allowed to POST to `/api/auth/*` |
| `wrangler secret put` | `BETTER_AUTH_SECRET` | must be identical across every worker sharing the auth D1 |
| `wrangler secret put` | `MCP_LOGIN_TICKET_SECRET` | MCP OAuth login relay — must match cod-server's |

The dashboard binds the **same D1 database as cod-server** (auth users/scopes
live in cod-server's schema) plus one KV namespace. See
`wrangler.toml.example` for the full binding template.

Client bundles must never contain secrets or the legacy dashboard domain —
`verify-shells.mjs` enforces both at build time.

## Architecture in one paragraph

Every page is a prerendered Shell that ships zero data. Its root island mounts
`RequireAuth`, which checks the session (silent spinner at most) and either
redirects to `/sign-in?next=…` or reveals the page inside
`DashboardChrome`. Data flows through the API seam (`src/lib/api.ts`) using a
short-lived JWT (`set-auth-jwt`) that `cod-server` verifies offline against the
better-auth JWKS — authorization therefore lives entirely in cod-server, where
it is tested (`cod-server/scripts/security/rbac.sh`).
