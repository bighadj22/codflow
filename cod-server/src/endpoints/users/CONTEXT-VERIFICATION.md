# Users CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `users/handlers.ts`, `routes.ts` (all 8 routes), `queries.ts`, `validation.ts`, `README.md`
- `cod-shared/queries/users.ts` (rotateApiKey re-export verified via import list)
- Schema: `users` table (schema.ts:6-23 — unique email/apiKey, role/status enums) + `user_scopes`
- Authentication gate: `middleware/auth.ts` (complete) — API-key comparison + status check + wildcard admin
- Scope registry: `scopes.ts:92-97` (SETTINGS_TEAM existence check)
- Credential insertion: raw accounts-table insert with provider_id 'credential' (queries.ts:58-63)

---

## ✅ VERIFIED — Terms Match Code

### Identity

| Term | Code evidence | Status |
|------|---------------|--------|
| Team Member | users table separate from customers; no customer cross-links | ✅ |
| Role | enum ["admin","staff"] only (schema.ts:12-14); dedicated role endpoint | ✅ |
| Temporary Password | randomBytes(10) hex = 20 chars; scrypt-hashed with better-auth-matching params (handlers.ts:52-62, :83-84); shown once (:120-126) | ✅ |
| 32-Hex Identity | bytesToHex(randomBytes(16)) = 32-char hex "same format as better-auth" (handlers.ts:89-90) | ✅ |

### Permissions

| Term | Code evidence | Status |
|------|---------------|--------|
| Wildcard Scope | auth middleware assigns ["*"] for admins (auth.ts:52-53); scopes insert skipped for admins (queries.ts:65) | ✅ |
| Scope Grant / Revoke | duplicate grant → friendly 409 DUPLICATE_ENTITY (handlers.ts:201-210); revoke of absent scope succeeds silently (no error path) ; both clear cache | ✅ |
| Scope Cache Invalidation | clearScopeCache on role change AND grant/revoke (queries.ts:101-103, :135, :151) | ✅ |

### Credentials

| Term | Code evidence | Status |
|------|---------------|--------|
| API Key | `cod_` prefix + uuid; stored RAW in users.api_key (queries.ts:53; schema apiKey column unique); middleware compares header verbatim `eq(users.apiKey, apiKey)` (auth.ts:31) | ✅ |
| API Key Rotation | new key replaces old → previous instantly invalid; returned once (routes.ts:312-345) | ✅ |

### Boundaries & Edge Cases

✅ Admin is a wall — requireAdmin() rejects staff regardless of scopes before handlers run (middleware.ts:20-30)
✅ Email collisions crash late on update — duplicate pre-check exists only at create (handlers.ts:92-102); users.email is DB-unique (schema.ts:9)
✅ Scopes vanish silently on promotion — admin ignores stored rows; demotion does not resurrect them
✅ **Inactive kills access instantly — CORRECTED during audit**: my initial draft assumed otherwise; middleware/auth.ts:42-48 proves status !== "active" returns 403 USER_INACTIVE *before* scope loading. Glossary states the verified truth.
✅ One-time secrets — neither tempPassword nor raw apiKey has any retrieval path
✅ Audit coverage: created / updated / role_changed / scope_granted / scope_revoked all logged (handlers.ts throughout)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README authorization claims (5 endpoints)** — claimed "Requires `settings:team` scope". FALSE: every route uses `requireAdmin()`; `settings:team` exists in the scope registry but is referenced by zero code paths in this module. All five rewritten to state admin-role-only.
2. **README security bullet** — claimed "API keys are never stored in plain text". FALSE: keys are stored verbatim and compared raw at the authentication gate. Rewritten to describe the actual one-time-display secrecy model.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Raw-key storage**: acceptable for machine auth but means DB reads expose live credentials — recorded so security reviewers see reality, not the old claim.
2. **Late email-collision failures**: PATCH to an existing email hits the constraint unguarded.
3. **Dead scope string**: `settings:team` sits in the registry unused here — its existence mislead the docs into inventing an authorization tier that never executed.
4. **Coordinator self-correction logged**: the "inactive does nothing" edge case was drafted from assumption, caught by reading auth.ts before publication, and replaced with the verified behavior (USER_INACTIVE gate).

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Identity | 4 | ✅ 4/4 | 0 |
| Permissions | 3 | ✅ 3/3 | 0 |
| Credentials | 2 | ✅ 2/2 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **18** | **✅ 18/18** | **0 in glossary / 2 README lies fixed (+1 self-caught assumption)** |

---

## 🎯 Confidence Level: HIGH (~98%)

The authorization model was verified against the actual middleware stack rather than README
claims — which is precisely where the two biggest lies lived. The one assumption that slipped
into draft was caught against auth.ts before finalizing.

*Repo-wide typecheck note: still red from another agent's concurrent schemas refactor — unrelated
here (markdown-only changes).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Users row added.
Remaining unmapped folder: `mcp/`.
