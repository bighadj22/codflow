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
npm run dev            # astro dev on :4321 (bindings via the Cloudflare adapter)
npm run build          # prerender → dist/ (+ SSR worker entry for /api/auth/*)
npm run typecheck      # astro check
npm test               # vitest (unit: gate logic)
npm run verify-shells  # fail if shells leak data or reference legacy domains
npm run seed:admin     # create/rotate the first admin (local D1)
npm run seed:admin:remote  # …on the remote D1 (print-only password/API key)
npm run smoke          # live auth/API gate suite (needs DASH_URL/API_URL/SMOKE_*)
npm run deploy         # wrangler deploy
```

Install/build always happens from the **repo root** (`npm ci` / `npm install`) —
single root lockfile.

## Get running locally

Prerequisites: repo root `npm ci` done, and cod-server set up first —
its migrations create the schema this dashboard authenticates against:

```sh
# 1. cod-server: migrate + seed demo data into the repo-shared local D1
cd ../cod-server
npm run db:setup:local

# 2. This package: copy config templates
cd ../cod-client-astro
cp wrangler.toml.example wrangler.toml   # fill in YOUR D1 + KV ids
cp .env.example .env                     # PUBLIC_API_URL (defaults to local cod-server)
cp .dev.vars.example .dev.vars           # set BETTER_AUTH_SECRET

# 3. Create your admin (sign-up is disabled by design — admins are provisioned)
npm run seed:admin
#    → prints email + generated password + API key; save them

# 4. Run the servers (two terminals)
npm run dev              # dashboard → http://localhost:4321
cd ../cod-server && npm run dev   # API → http://localhost:8787
```

Local D1/KV state lives in `<repo-root>/.wrangler-shared` — cod-server's
scripts write there and astro dev reads the same files (via the adapter's
`persistState`), so migrations, seeding, and sign-in all see one database.
Sign in at `http://localhost:4321/sign-in` with the seeded credentials.

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
