---
name: codflow-governance
description: CodFlow repository governance — build, test, and ship code that meets this repo's standards. Use when making ANY change to CodFlow (cod-server, cod-client, cod-shared, cod-astro/theme01, README, docs, CI), before committing or opening a PR, writing README feature claims, touching migrations or the D1 schema, adding dependencies, or reviewing contributions. Enforces: code-verified README claims, no secrets, typecheck+tests verification, conventional commits, changelog updates, Apache-2.0/NOTICE, and SECURITY.md reporting rules.
---

# CodFlow Governance

CodFlow is an Apache-2.0, self-hosted, cash-on-delivery (COD) e-commerce
platform for Algeria, open-sourced for the first time. Every change must keep
the repo **honest, tested, and secure**. This skill is the contract for how
code lands here.

## Repo layout (know where things live)

- `cod-server/` — Cloudflare Workers API (Hono). Merchant `/api/*`, public
  `/store/*`, `/webhooks`, `/images`, `/mcp`. D1 via Drizzle.
- `cod-client/` — Next.js merchant dashboard (App Router, `"use client"`
  heavy). `app/(dashboard)/*` is the merchant UI.
- `cod-shared/` — single source of truth for the D1 schema, shared queries,
  RBAC scopes, and error codes. Imported via relative path
  (`../../cod-shared/...`). **Not published.**
- `cod-astro/theme01/` — swappable storefront theme (Astro). No package.json.
  Keep engine logic out of it.

There is **no root package.json and no npm workspaces**. Each package installs
its own dependencies.

## Commands (exact, run inside the package dir)

```sh
cd cod-shared && npm ci        # always first — others resolve cod-shared deps
cd cod-server && npm ci        # then
cd cod-server && npm run typecheck
cd cod-server && npm test
cd cod-server && npm run dev   # wrangler dev :8787
```

Same for `cod-client` (`npm ci`, `npm run typecheck`, `npm test`, `npm run dev`).
`cod-astro/theme01` needs no install (`npm run dev` starts Astro).
CI runs exactly these commands in `.github/workflows/ci.yml`.

## Verification — NEVER skip

- After **any TypeScript change**: run `npm run typecheck` in the affected
  package. Failing typecheck is a blocker.
- After **any behavior change**: run `npm test` in the affected package.
  (cod-server currently: 689 tests; cod-client: 141.)
- Add or update a **focused test** for the behavior you changed. Do not rely on
  "it compiles" — behavior changes need coverage.
- Do not mark work complete until typecheck + tests actually pass.

## README claims MUST be code-verified

This is the repo's non-negotiable rule:

> Never write a feature claim in the README that is not actually implemented.

- Before editing a README feature list, confirm the code exists (read the
  handler/route/component).
- If a feature is only partially built (e.g. backend done, UI is a "Coming
  Soon" placeholder), say exactly that — do not claim it as complete.
- Use the ✅/❌/🧭 markers the README already uses; keep them accurate.
- If you discover a README claim that the code does not support, fix the README
  or flag it — never leave an overclaim.

## Secrets — NEVER

- No live API keys, carrier tokens, or credentials in source, tests, or
  fixtures. Ever.
- Real secrets go in `wrangler secrets` or `.dev.vars` (gitignored).
- Before committing, scan your diff for tokens (`API_TOKEN=`, `SECRET_KEY=`,
  `Bearer`, long base64/high-entropy strings).
- If you find a committed secret: rotate it, remove it from history, and report
  via `SECURITY.md` process — do not silently leave it.

## Commits & branches

- One logical change per commit. Conventional Commits:
  `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`.
- Branch naming: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Work on a branch; merge via a PR (CI runs on it). Never force-push shared
  branches.

## Pull requests

- PRs must be small enough to review in one sitting (< ~500 lines).
- PR template checklist must pass: no secrets, tests cover the change, README
  claims match code, conventional commit message.
- CI (typecheck + tests for cod-server and cod-client) must be green before
  merge.
- When reviewing a contribution, check: does the README claim only what the
  code does? Are secrets absent? Are tests included?

## Changelog & releases

- `CHANGELOG.md` uses Keep a Changelog. New user-visible changes go under
  `[Unreleased]` grouped by Added / Changed / Deprecated / Removed / Fixed /
  Security.
- Releases follow SemVer (`v0.1.x` patch, `v0.x.0` minor, `v1.0.0` major), are
  git-tagged, and announced via GitHub Releases.
- Update the CHANGELOG when you add, change, or fix user-visible behavior.

## Boundaries (don't cross without asking)

- `cod-shared` is the single source of truth for schema, queries, RBAC scopes,
  and error codes. Do NOT duplicate them in cod-server or cod-client.
- Migrations: add a NEW migration; never rewrite an already-applied one.
- Ask before adding a production dependency or changing the D1 schema.
- Keep engine logic out of `cod-astro/theme01` (it must stay swappable).

## Known traps (verify before blaming CI)

- cod-server/cod-client tests or typecheck fail if `cod-shared` deps are not
  installed first — run `cd cod-shared && npm ci` first.
- Inbound webhooks exist only for **Yalidine** and **ZR Express**. NOEST and
  EcoTrack tracking is pulled on demand via `GET /orders/:id/tracking`; there is
  no inbound receiver for them.
- The abandoned-order dashboard page
  (`cod-client/app/(dashboard)/orders/abandoned`) is a "Coming Soon"
  placeholder — backend collection + cron exist, the merchant UI does not.
- cod-server tests run on miniflare + better-sqlite3 locally; no network or
  credentials required.

## Security reports

- Never accept vulnerability reports as public issues — point reporters to
  GitHub private vulnerability reporting (see `SECURITY.md`).
- Acknowledgment target: 3 business days; coordinated disclosure.
- Supported versions: only `main` and the latest tag.

## License

- The project is Apache-2.0 (`LICENSE`) with copyright attribution in
  `NOTICE`. Preserve both; do not change the license without the owner's
  explicit decision.