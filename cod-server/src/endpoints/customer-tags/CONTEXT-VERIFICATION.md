# Customer Tags CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `customer-tags/handlers.ts`, `routes.ts` (all 7 routes), `queries.ts`, `README.md`
- `cod-shared/queries/customer-tags.ts` (complete)
- Schema: `customerTags` (schema.ts:93-100 — name UNIQUE, assignmentCount) + `customerTagAssignments` (unique pair index, cascade FKs)
- Cross-checked against Customers audit (recentOrders/membership reads) and Activity Logs ACTIONS catalog

---

## ✅ VERIFIED — Terms Match Code

### Tag Anatomy

| Term | Code evidence | Status |
|------|---------------|--------|
| Customer Tag | name `.unique()` DB-enforced (schema.ts:95); hex-6 color default #64748b (shared queries:79; validation regex routes.ts:86) | ✅ |
| Tag Color | required-format hex, optional at create | ✅ |
| Assignment Count | denormalized column default 0 (schema.ts:97); recounted from real rows after every assign/unassign (shared queries:114-123, :136-146) | ✅ |
| Assignment | uniqueIndex on (customerId, tagId) (schema); assignedAt timestamp on rows and membership reads (:62, :111) | ✅ |

### Assignment Rules

| Term | Code evidence | Status |
|------|---------------|--------|
| Idempotent Assignment | onConflictDoNothing then recount (:109-124) | ✅ |
| Silent Unassign | delete-nothing + recount + success; customer existence never checked (handler checks TAG only :127-130) | ✅ |
| Assignment Guard | assignmentCount > 0 → 422 TAG_HAS_ASSIGNMENTS with tagId/name/count context (handlers.ts:77-88) | ✅ |

### Boundaries & Edge Cases

✅ Duplicate names crash late — no app-level pre-check in create/update handlers; only the DB unique index stands guard → documented friendly "409 Duplicate tag name" in routes is unreachable
✅ Cascade desync — customer deletion cascades assignment rows without touching the stored count → phantom-count undeletable tags possible
✅ Counts self-heal on activity — recount-before-write pattern
✅ ?customers=true embeds full customer summaries with stats + assignedAt (shared queries:50-70)
✅ RBAC CUSTOMER_TAGS_READ / CUSTOMER_TAGS_MANAGE verified on all 7 routes
✅ Audit logging verified for all five action types against ACTIONS catalog

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — phantom `openapi.ts` removed (**7th instance** of this lie family); missing `ai-tools.ts` + tests added; queries.ts credited as shared re-export.
2. **README DELETE section** — claimed deletion "also removes all associations" unconditionally. Reality: a **422 guard blocks deletion while assignments exist**; cascade only fires for an empty tag. Rewritten to lead with the guard.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Unreachable 409**: route docs promise `409 Duplicate tag name` but no code path produces it — uniqueness surfaces as a raw constraint error instead. Fixing that = CODE change (pre-check or catch).
2. **Phantom-count lockout**: after a customer cascade-delete, a tag's stale count can permanently block its deletion until an assign/unassign cycle recounts it. No manual recount endpoint exists.
3. **Unassign trusts nothing about the customer**: unknown IDs succeed silently — harmless today, worth knowing before building UI assumptions.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Tag Anatomy | 4 | ✅ 4/4 | 0 |
| Assignment Rules | 3 | ✅ 3/3 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 4 | ✅ 4/4 | 0 |
| **TOTAL** | **15** | **✅ 15/15** | **0 in glossary / 2 README fixes applied** |

---

## 🎯 Confidence Level: HIGH (~98%)

Both the denormalized-counter lifecycle and the two-layer idempotency backing were traced
line-by-line; the counter-drift lockout was found by following the FK cascade rather than
trusting either README.

*Repo-wide typecheck note: still red from another agent's concurrent schemas refactor — unrelated
here (markdown-only changes).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Customer Tags row added.
Remaining from the requested batch: `customer-groups/`, `product-groups/`.
