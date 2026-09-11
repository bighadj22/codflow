---
name: codflow-update
description: >-
  Update runbook for a self-hosted CodFlow install — an AI agent following it
  fetches the latest code from the CodFlow GitHub repo, merges it into an
  EXISTING checkout, syncs the gitignored wrangler.toml / .env / .dev.vars
  files with any template changes (keeping the user's resource IDs, worker
  names, and domains), creates ONLY the new Cloudflare resources an update
  introduces, applies new D1 migrations without touching data, and rebuilds +
  redeploys each updated worker (server, dashboard, or storefront theme) —
  never re-running the full setup, never regenerating secrets, never
  re-seeding a live store, and reporting every step to the user in plain
  language (they may be a non-developer). Use when the developer already set
  CodFlow up (via the codflow-setup skill) and wants to update or upgrade to
  the latest version from https://github.com/bighadj22/codflow (branch main),
  pull the latest changes/release, apply new migrations after pulling, or
  asks how to get updates for their existing install.
---

# CodFlow Update — Agent Runbook

CodFlow self-hosters cloned the repo and completed setup with the
`codflow-setup` skill: their `wrangler.toml` files, root `.env`, and
`.dev.vars` files are filled with THEIR resource IDs and secrets and are all
**gitignored**. This runbook brings such an install to the latest upstream
code **incrementally** — no re-running setup, no re-creating resources, no
data loss.

This skill ships inside the repo (`.agents/skills/codflow-update/`), so a
plain `git pull` delivers it. The very first time, the developer can pull once
by hand (`git pull origin main`) and then ask their agent to run this skill;
every update after that is fully agent-driven.

**Source of truth:** updates come from `https://github.com/bighadj22/codflow`,
branch **`main`**. Every fetch/merge in this runbook targets that repository
and branch — never a fork, never another branch.

## Report EVERY step to the user — devs and non-devs alike

The developer running this may be a **non-developer ("vibe coder")** who set
CodFlow up with an agent and never touched git or wrangler themselves. After
completing EACH step below, stop and tell the user what just happened, in
plain language, before starting the next step:

- Say what you did, what it changed, and why — one short paragraph per step.
- Lead with the plain-language outcome, then the technical detail. Good:
  > "✅ Step 2 of 8 done: I downloaded the latest CodFlow code (14 new
  > versions since yours, including a fix for order tracking). Your files —
  > database, images, settings, passwords — were not touched. Next: I'll
  > check if the new version needs new settings added to your config files."
- Never dump raw command output at a non-dev without a one-line explanation
  of what it means.
- If a step needs a decision or a value only the user has (a password, a
  domain, a yes/no), ask clearly and wait — do not guess.
- If a step fails, say plainly what broke and what you will do about it
  before doing anything.

Do not stay silent across multiple steps and summarize at the end — the user
must be able to follow the update as it happens.

## What an update changes vs. what it must never touch

| Category | Files | Update behavior |
| :--- | :--- | :--- |
| Tracked code | everything except the rows below | replaced by `git merge` |
| Migration files | `cod-server/src/db/migrations/` | new files arrive; applied incrementally |
| User config (gitignored) | root `.env`, `cod-client-astro/.env`, both `wrangler.toml`, all `.dev.vars` | **preserved**; only *merged* with new template keys (Step 3) |
| Cloudflare resources | D1, R2 bucket, KV namespaces, worker names | **preserved**; only *new* bindings get new resources (Step 4) |
| Worker secrets | `BETTER_AUTH_SECRET`, `MCP_LOGIN_TICKET_SECRET`, `STORE_API_KEY`, R2 keys | **preserved, never regenerated**; only *new* secrets are added (Step 4) |
| Database data | all rows in the user's D1 | **preserved**; migrations are additive; never re-seed a live store |

## Before Starting — State This Contract

State this to the developer before running anything:

> *"This update will fetch the latest CodFlow code and merge it into your
> checkout, merge any new template settings into your wrangler.toml and .env
> files while keeping your resource IDs, worker names, and domains, apply any
> new D1 migrations to your database (existing data is untouched), and
> redeploy the affected workers. Nothing is re-created from scratch, no
> secrets are regenerated, and no demo data is re-seeded."*

## Prerequisites — Gates, In Order

1. **This must be an existing install.** Verify, from the repo root:
   ```bash
   test -f .env && test -f cod-server/wrangler.toml && test -f cod-client-astro/wrangler.toml && echo OK
   ```
   If any is missing, STOP — this is not a completed setup. Run the
   `codflow-setup` skill instead.

2. **Correct upstream remote.**
   ```bash
   git remote get-url origin    # expect .../bighadj22/codflow.git
   ```
   If `origin` points elsewhere (a fork, another copy), ask the developer
   where they track CodFlow updates. If upstream is not configured:
   ```bash
   git remote add upstream https://github.com/bighadj22/codflow.git
   ```
   and use `upstream` in place of `origin` throughout this runbook.

3. **Cloudflare auth still valid.**
   ```bash
   env -u CLOUDFLARE_ACCOUNT_ID npx wrangler whoami
   ```
   Same trap as setup: if the shell exports a stale `CLOUDFLARE_ACCOUNT_ID`
   the OAuth token cannot access, EVERY wrangler command fails with
   `Authentication error [code: 10000]`. Prefix every wrangler invocation with
   `env -u CLOUDFLARE_ACCOUNT_ID` (done throughout below).

4. **Clean working tree.**
   ```bash
   git status --porcelain
   ```
   - Gitignored files showing as untracked/modified (`wrangler.toml`, `.env`,
     `.dev.vars`) are **expected and fine** — confirm with
     `git check-ignore .env cod-server/wrangler.toml` that they are ignored.
   - **Modified TRACKED files block the merge.** Do not `reset --hard` on your
     own. Present the `git status` list to the developer and offer:
     - `git stash push -m "local edits before codflow update" -- <files>` (pop
       after the update, expect conflicts if the same lines changed upstream),
     - committing them to a local branch, or
     - discarding them — only with explicit confirmation.

5. **Record the rollback point (mandatory).**
   ```bash
   git rev-parse --short HEAD | tee /tmp/codflow-update-old-head
   git describe --tags HEAD 2>/dev/null || echo "(untagged)"
   ```
   Keep this for Step 8. Cloudflare also keeps each worker's previous
   deployment, so workers can be rolled back independently of the database.

## Step 1 — Fetch and Assess (changes nothing yet)

```bash
git fetch origin main --tags
git rev-list --count HEAD..origin/main        # commits behind
git log --oneline HEAD..origin/main           # what's incoming
```

If the count is `0`, the code is already current — but the install may still
be stale (pulled but never migrated/deployed). Do NOT exit yet: run the
assessment table below plus `migrations list` in Step 5; if everything is
clean, report "fully up to date" and stop.

**Capture the assessment BEFORE merging** — after the merge these diff ranges
are empty. Fill this in and show the resulting plan to the developer:

| Check | Command | If anything listed → |
| :--- | :--- | :--- |
| Migrations | `git diff --name-only HEAD..origin/main -- cod-server/src/db/migrations` | Step 5 is mandatory |
| Dependencies | `git diff --name-only HEAD..origin/main -- package.json package-lock.json` | `npm ci` in Step 2 |
| Server config template | `git diff --name-only HEAD..origin/main -- cod-server/wrangler.toml.example` | Step 3 merge |
| Dashboard config templates | `git diff --name-only HEAD..origin/main -- cod-client-astro/wrangler.toml.example cod-client-astro/.env.example` | Step 3 merge |
| Root env template | `git diff --name-only HEAD..origin/main -- .env.example` | Step 3 merge |
| New secrets/env surface | `git diff HEAD..origin/main -- cod-server/src/types/env.ts` (also skim `CHANGELOG.md`, `README.md`, and skill diffs for `secret put` mentions) | Step 4 |
| Server code | `git diff --name-only HEAD..origin/main -- cod-server cod-shared` | deploy cod-server (Step 6) |
| Dashboard code | `git diff --name-only HEAD..origin/main -- cod-client-astro` | rebuild + deploy dashboard (Step 6) |
| Storefront code | `git diff --name-only HEAD..origin/main -- cod-astro/theme01` | deploy theme01 (Step 6) |

If `CHANGELOG.md` changed, read its new sections and summarize the
user-visible changes for the developer before proceeding.

**Present the plan** ("I will merge N commits, apply migrations X–Y, add var
Z to both wrangler.toml files, and redeploy cod-server + dashboard") and get
a go-ahead. Migrations and redeploys touch their live store — never surprise
them.

## Step 2 — Merge the Code

```bash
git merge --ff-only origin/main
```

- `--ff-only` succeeds when the checkout has no local commits — the normal
  self-host case. If it refuses, the developer has local commits:
  `git log --oneline origin/main..HEAD` shows them. Offer to
  `git rebase origin/main` or stop and let the developer decide. Do not force
  the merge.
- If dependencies changed (Step 1 table), reinstall at the **repo root**:
  ```bash
  npm ci
  ```
  One root lockfile covers all workspaces — never create per-package
  lockfiles. If a dev server later dies with `Missing field 'moduleType'`,
  a second Vite major crept in: `rm -rf node_modules && npm ci`, then
  `npm ls vite` must show a single major (the root `overrides` pin enforces
  it).

## Step 3 — Sync the Gitignored Config with the New Templates

**This is the step self-hosters miss.** `git pull` updates
`wrangler.toml.example` and `.env.example`, but NEVER the user's live
gitignored files. When upstream adds a binding, a `[vars]` key, or a new
`.env` key, the live files must be merged by hand (agent) or the next deploy
breaks or the feature silently fails.

Work over these pairs:

| Template (tracked, just updated) | Live file (gitignored, user's) |
| :--- | :--- |
| `cod-server/wrangler.toml.example` | `cod-server/wrangler.toml` |
| `cod-client-astro/wrangler.toml.example` | `cod-client-astro/wrangler.toml` |
| `.env.example` | `.env` (repo root) |
| `cod-client-astro/.env.example` | `cod-client-astro/.env` |
| `<pkg>/.dev.vars.example` (each package) | `<pkg>/.dev.vars` |

### 1. Back up every live config file first

Into a directory OUTSIDE the repo (survives resets, never hits git):

```bash
BK="$HOME/.codflow-backups/$(date +%Y%m%d-%H%M%S)" && mkdir -p "$BK" && \
cp .env cod-client-astro/.env cod-server/wrangler.toml cod-client-astro/wrangler.toml "$BK/" && \
cp cod-server/.dev.vars cod-client-astro/.dev.vars cod-astro/theme01/.dev.vars "$BK/" 2>/dev/null; ls -la "$BK"
```

Report this path to the developer — it is the config-level rollback.

### 2. Diff live file against the CURRENT template

```bash
diff cod-server/wrangler.toml.example cod-server/wrangler.toml
diff cod-client-astro/wrangler.toml.example cod-client-astro/wrangler.toml
diff .env.example .env
```

This catches **cumulative** drift (not just this update) and works even when
the developer already pulled the code themselves. Expect the live file to
differ in resource IDs, worker `name`s, and real domains — those differences
are CORRECT. You are hunting only for things present in the template but
MISSING from the live file.

### 3. Merge rules

- **Add** to the live file: new `[vars]` keys, new binding blocks
  (`[[kv_namespaces]]`, `[[r2_buckets]]`, `[[d1_databases]]`, …), new
  top-level settings.
- **Keep the user's value** for: `database_id`, KV `id`s, `bucket_name`,
  `MEDIA_DOMAIN`, all URL vars (`WORKER_URL`, `BETTER_AUTH_URL`,
  `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `PUBLIC_TRUSTED_ORIGINS`,
  `COD_SERVER_URL`), and every `name =` worker name. Never reset a worker
  name to the template default — that deploys onto (or creates) a DIFFERENT
  worker.
- **Adopt upstream's** `compatibility_date` and `compatibility_flags`
  changes — they are tied to what the new code expects. Note the change in
  the summary.
- **A binding block copied from the template carries placeholder IDs.** A
  genuinely NEW binding means a new resource — create it in Step 4, then bind
  the real ID. Never leave a placeholder. After merging, re-run the setup
  placeholder check and expect zero hits:
  ```bash
  grep -rn "00000000-0000\|00000000000000000000000000000000" \
    cod-server/wrangler.toml cod-client-astro/wrangler.toml
  ```
- **Keys removed from a template**: leave them in the live file, note it in
  the summary, and only remove after the developer confirms (removals are
  rare and may be staged rollouts).
- New keys in `.env.example` → add to `.env`. Fill values derivable from the
  install (e.g. a new `COD_*` key whose value equals an existing binding);
  otherwise ask the developer. `COD_SERVER_URL` must stay the real deployed
  origin — a loopback value blocks the theme01 deploy by design.

### 4. Confirm the live files are still ignored

```bash
git status --short .env cod-server/wrangler.toml cod-client-astro/wrangler.toml
# expected: nothing listed
```

If anything shows up, STOP — the `.gitignore` arrangement broke; fix before
continuing.

## Step 4 — New Resources and Secrets ONLY (conditional)

Skip entirely when Step 1 found no new bindings or secrets.

- **New resource bindings** (a `[[kv_namespaces]]`/`[[r2_buckets]]`/etc. block
  the live file lacked): create exactly that resource, nothing else, with the
  install's `<project>` prefix —
  `env -u CLOUDFLARE_ACCOUNT_ID npx wrangler kv namespace create <name>` —
  following the setup skill's rules: fresh unique names, never reuse a
  foreign existing resource, capture the real ID, bind it, re-run the
  placeholder grep.
- **New secrets** (new fields in `cod-server/src/types/env.ts`, or
  `secret put` mentions in the updated docs/skills): ask the developer for
  the value, then set with the setup skill's safe pattern — value via a
  chmod-600 temp file or stdin redirect, never `echo`/heredoc:
  ```bash
  printf '<value>' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put <NAME> --name <server-worker-name>
  ```
  Also add it to the matching `.dev.vars` for local dev.
- **NEVER regenerate existing secrets.** `BETTER_AUTH_SECRET` and
  `MCP_LOGIN_TICKET_SECRET` must remain the SAME values on both workers —
  regenerating either invalidates every dashboard session and breaks
  cross-worker auth. An update only ever ADDS secrets.
- Optional features (Sendili email, WhatsApp OTP, Turnstile, …) stay
  opt-in. An update never configures them silently — mention them in the
  summary if the changelog announces them.

## Step 5 — Apply New D1 Migrations (BEFORE Deploying Code)

Wrangler tracks applied migrations in the `d1_migrations` table inside the
user's D1, so re-running apply is incremental — it only runs files never
applied before. Existing rows are never touched; CodFlow migrations are
additive by policy.

```bash
cd cod-server
# Preview what is pending (works even if the developer already pulled earlier):
env -u CLOUDFLARE_ACCOUNT_ID node scripts/d1.mjs migrations list --remote

# Apply to the deployed database — MANDATORY before deploying new code:
env -u CLOUDFLARE_ACCOUNT_ID npm run db:migrate:remote
```

- **Order matters.** Deploying code that expects a new column before its
  migration runs produces live 500s (the classic: `field "alg" does not exist
  in "jwkss"` from migration 0011). Migrate first, deploy second.
- If the developer also runs the stack locally, migrate the shared local
  state too: `env -u CLOUDFLARE_ACCOUNT_ID npm run db:migrate:local`
  (persisted to `<repo-root>/.wrangler-shared`).
- **If a migration fails: STOP.** Do not deploy, do not retry blindly, do not
  hand-edit the database or the `d1_migrations` table. Capture the full
  error, identify the failing file in `cod-server/src/db/migrations/`, and
  report to the developer (a fix usually means a corrected upstream migration
  in a follow-up release).
- **NEVER re-run seeders on a live store.** `db:seed:remote` re-inserts the
  demo store, categories, and products (fixed IDs, `INSERT OR REPLACE`) and
  `seed:admin:remote` resets the admin password — both wreck a production
  install. Only run either when the developer explicitly asks for demo data
  or a password reset.
- Verify: `migrations list --remote` again — expect no unapplied migrations.

## Step 6 — Redeploy Affected Workers (Rebuild FIRST, Then Deploy)

Redeploy every worker whose code OR config changed (Step 1 table + Step 3
merges). When in doubt, deploy all three — deploys are idempotent.

**RULE — rebuild before deploy, no exceptions.** Never deploy stale build
output. Whatever was updated (server, dashboard, or storefront theme) must be
rebuilt from the freshly merged code before it is deployed:

| Package | Rebuild before deploy | Why |
| :--- | :--- | :--- |
| cod-client-astro (dashboard) | `npm run build` — **mandatory separate step** | Its `deploy` script (`wrangler deploy`) does NOT build; it ships whatever is in `dist/`. Deploying without building ships the OLD dashboard. `PUBLIC_API_URL` is baked into the client bundle at build time. |
| cod-astro/theme01 (storefront) | `npm run build` | Its deploy script does build first, but run the build explicitly anyway so a build failure surfaces BEFORE any deploy attempt. |
| cod-server (API) | bundled by `wrangler deploy` itself | `wrangler deploy` compiles `src/index.ts` from source on every deploy — there is no stale `dist/` to worry about. Still verify the deploy output references the NEW commit's code. |

```bash
cd cod-server           && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
cd ../cod-client-astro  && env -u CLOUDFLARE_ACCOUNT_ID npm run build && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
cd ../cod-astro/theme01 && env -u CLOUDFLARE_ACCOUNT_ID npm run build && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
```

A build that fails means the deploy must NOT proceed — report the error to
the user, fix or stop. After each deploy, report to the user which worker was
updated and to what version (per the reporting rule at the top).

- **The dashboard deploy does NOT build first** — `npm run build` is a
  separate step and `PUBLIC_API_URL` is baked into the client bundle at build
  time. Skipping the build ships the OLD dashboard code with the new worker.
- theme01's deploy reads `COD_SERVER_URL` from the root `.env`; it refuses a
  loopback value unless `--force-local` is passed (a deployed Worker can
  never reach `http://localhost:8787`).

## Step 7 — Verify (Do Not Skip Past a Failing Check)

Use the worker names from the live configs:
`grep -E '^name' cod-server/wrangler.toml cod-client-astro/wrangler.toml` and
`grep '"name"' cod-astro/theme01/wrangler.jsonc`.

| Worker | Check | Expectation |
| :--- | :--- | :--- |
| cod-server | `curl -s -o /dev/null -w "%{http_code}" https://<api-domain>/api/docs` | `200` |
| dashboard sign-in API | `curl -s -X POST https://<dashboard-url>/api/auth/sign-in/email -H "Content-Type: application/json" -H "Origin: https://<dashboard-url>" -d '{"email":"<admin>","password":"<pass>"}'` | `200` + user JSON (500 = missing migration or config; **403 `INVALID_ORIGIN` = `PUBLIC_TRUSTED_ORIGINS` drift**; 401 = credentials) |
| dashboard UI | open the dashboard URL | new version loads, login works |
| cod-astro/theme01 | open the storefront URL | homepage renders with products |
| database | `env -u CLOUDFLARE_ACCOUNT_ID node scripts/d1.mjs migrations list --remote` (from `cod-server/`) | no unapplied migrations |

The `Origin` header in the sign-in check is mandatory — without it the check
passes while every real browser request fails. If anything fails, diagnose
with `env -u CLOUDFLARE_ACCOUNT_ID npx wrangler tail <worker-name> --format
pretty` while retrying the failing request. If the changelog highlighted a
specific fix or feature, exercise it once before declaring success.

## Step 8 — Closing Summary (Mandatory)

Print:

1. **Version move:** `<old-HEAD-or-tag>` → `<new-HEAD-or-tag>` (`git describe
   --tags HEAD`), commit count merged, one-line summary of user-visible
   changes from `CHANGELOG.md`.
2. **Database:** migrations applied (file names), migrations pending (should
   be none).
3. **Config:** keys/bindings added to each live file; worker names confirmed
   unchanged; `compatibility_date` changes if any.
4. **Cloudflare:** new resources created (name + ID + where bound), new
   secrets set (names only, never values).
5. **Deploys:** workers redeployed + all smoke checks green.
6. **Backups:** the `~/.codflow-backups/<timestamp>` path from Step 3.

### Rollback (only if something is broken)

- **Workers only:** `env -u CLOUDFLARE_ACCOUNT_ID npx wrangler rollback
  <worker-name>` — instantly reverts that worker to its previous deployment.
- **Code:** `git checkout <old-HEAD-from-prerequisites>` then redeploy the
  affected workers.
- **Config:** restore files from the Step 3 backup directory.
- **Database:** D1 has no down-migrations. CodFlow migrations are additive,
  so rolled-back code runs fine on the newer schema — never un-apply by
  deleting rows from `d1_migrations` or dropping objects by hand.

## Troubleshooting

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| `git merge --ff-only` refuses | Local commits exist in the checkout | Show `git log --oneline origin/main..HEAD`; offer `git rebase origin/main` or let the developer decide. Never force. |
| Merge conflicts on tracked files | Tracked files were locally modified | Resolve from the stash taken in Prerequisites, or with the developer. Never `reset --hard` without explicit confirmation. |
| Sign-in returns 500 `field "alg" does not exist in "jwkss"` (or similar missing-column errors) | New code deployed before its migration ran | Run `npm run db:migrate:remote` in cod-server (Step 5); the error names the missing column → find its migration file. |
| New feature 500s or "… is not set" | A new secret or var from the update was never set | Re-check the `cod-server/src/types/env.ts` diff and Step 4; set the missing secret/var, redeploy. |
| Dashboard still shows the old UI | `npm run deploy` ran without `npm run build` | `cd cod-client-astro && npm run build && npm run deploy` — `PUBLIC_API_URL` is baked at build time. |
| Dev server dies with `Missing field 'moduleType'` | Two Vite majors after a dependency update | `rm -rf node_modules && npm ci` at the root; `npm ls vite` must show one major. |
| theme01 deploy refuses: loopback `COD_SERVER_URL` | Root `.env` still has the localhost default | Set the real deployed cod-server origin in `.env`, retry. `--force-local` only for intentional local deploys. |
| Storefront renders but products empty | Worker→Worker fetch between two `*.workers.dev` hosts is blocked (CF error 1042), or `COD_SERVER_URL` points at the wrong origin | Put cod-server on a custom domain/route, set `COD_SERVER_URL`, redeploy theme01. |
| Sign-in 403 `INVALID_ORIGIN` in browser but curl passes without `Origin` | Dashboard origin missing from `PUBLIC_TRUSTED_ORIGINS` (e.g. domain changed during config merge) | Add the dashboard URL to `PUBLIC_TRUSTED_ORIGINS` in `cod-client-astro/wrangler.toml`, redeploy, retest WITH the `Origin` header. |
| Every API call 401 after update although sign-in works | `BETTER_AUTH_SECRET` differs between the two workers (someone regenerated it) | Restore the identical original secret on both workers — check the Step 3 backups or the credentials file from setup. |
| `migrations apply` fails mid-file | Upstream migration bug or schema conflict | STOP (Step 5 rule): no deploy, no hand-editing; capture the error and the file name, report to the developer / upstream issue. |
| All wrangler commands fail `Authentication error [code: 10000]` | Stale `CLOUDFLARE_ACCOUNT_ID` exported in the shell | Prefix commands with `env -u CLOUDFLARE_ACCOUNT_ID` (see Prerequisites). |
| Local dev broken after update (missing tables) | Local shared D1 not migrated | `cd cod-server && env -u CLOUDFLARE_ACCOUNT_ID npm run db:migrate:local` — local state lives in `<repo-root>/.wrangler-shared`. |
