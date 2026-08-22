---
name: codflow-governance
description: CodFlow repository workflow — the process for making and shipping a change that meets this repo's standards. Use when making ANY change to CodFlow (cod-server, cod-client, cod-shared, cod-astro/theme01, README, docs, CI), before committing or opening a PR, writing README feature claims, touching migrations or the D1 schema, adding dependencies, or reviewing contributions. Loads and defers to AGENTS.md for the repo contract; this skill is the step-by-step workflow, not a duplicate of it.
---

# CodFlow Governance — change workflow

CodFlow is an Apache-2.0, self-hosted, cash-on-delivery (COD) e-commerce
platform for Algeria, open-sourced for the first time. This skill is the
**workflow** for landing a change. The repo contract (layout, commands,
verification, boundaries, traps, security rules) lives in the root
`AGENTS.md` — read it first; it is the source of truth. Package-specific
commands and boundaries live in each package's `AGENTS.md`
(`cod-astro/theme01/AGENTS.md`).

## When to use

- You are about to change code, docs, schema, or CI in this repo.
- You are writing README feature claims.
- You are reviewing a contribution.

## The change workflow

### 1. Locate the change

- Identify the package(s) affected (cod-server / cod-client / cod-shared /
  cod-astro/theme01). Read the root `AGENTS.md`, then the package's `AGENTS.md`.
- Respect the `cod-shared` boundary: schema, queries, RBAC scopes, and error
  codes are defined there and only there. Do not duplicate them in a package.
- Migrations: add a new migration; never rewrite an already-applied one.
- Ask before adding a production dependency or changing the D1 schema.
- Keep engine logic out of `cod-astro/theme01` (swappable theme layer).

### 2. Install dependencies

One install at the repo root covers every workspace (single root lockfile —
never create per-package lockfiles):

```sh
npm ci
```

### 3. Make the change

- One logical change per commit. Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`).
- No explanatory code comments unless asked.
- Never commit secrets (API keys, carrier tokens, credentials). Real secrets go
  in `wrangler secrets` / `.dev.vars` (gitignored).
- Add or update a **focused test** for behavior changes.

### 4. Verify — never skip

- After **any TypeScript change**: run `npm run typecheck` in the affected
  package (theme01: `npx astro check`).
- After **any behavior change**: run `npm test` in the affected package.
- README claims must be code-verified: never write a feature claim the code
  does not implement. If a feature is partially built, say exactly that.
- Do not mark work complete until typecheck + tests actually pass.

### 5. Commit, branch, PR

- Work on a branch named `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- PRs must be small enough to review in one sitting (< ~500 lines).
- The PR template checklist must pass: no secrets, tests cover the change,
  README claims match code, conventional commit message.
- CI (typecheck + tests for cod-server and cod-client) must be green.
- When reviewing: README claims only what code does? Secrets absent? Tests
  included? Migrations additive?

### 6. Changelog

- User-visible changes go under `[Unreleased]` in `CHANGELOG.md` (Keep a
  Changelog), grouped by Added / Changed / Deprecated / Removed / Fixed /
  Security.
- Releases follow SemVer, are git-tagged, and announced via GitHub Releases.

## Review checklist (use when reviewing a contribution)

- [ ] README claims only what the code actually does
- [ ] No secrets / credentials in the diff
- [ ] Tests cover the change (or an existing test covers it)
- [ ] Migrations are additive (new file, not a rewrite)
- [ ] `cod-shared` boundaries respected (no duplicated schema/scopes)
- [ ] Conventional commit message
- [ ] Typecheck + tests pass for affected packages

## Security reports

- Never accept vulnerability reports as public issues — point reporters to
  GitHub private vulnerability reporting (see `SECURITY.md`).
- Acknowledgment target: 3 business days; coordinated disclosure.
- Supported versions: only `main` and the latest tag.