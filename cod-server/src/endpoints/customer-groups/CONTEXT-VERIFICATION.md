# Customer Groups CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `customer-groups/handlers.ts`, `routes.ts` (all 7 routes), `queries.ts`, `validation.ts`, `README.md`
- `cod-shared/queries/customer-groups.ts` (complete)
- Schema: `customerGroups` (schema.ts:59-69 — name NOT unique, memberCount denormalized) + `customerGroupMembers` (unique pair index, cascade FKs)
- Sibling comparison against the Customer Tags audit for shared patterns and genuine differences

---

## ✅ VERIFIED — Terms Match Code

### Group Anatomy

| Term | Code evidence | Status |
|------|---------------|--------|
| Customer Group | schema.ts:59-69; name has NO unique constraint (vs tags) — duplicate names legal | ✅ |
| Group Description | optional, max 500 chars (validation.ts:5, :11); clearable via null on update | ✅ |
| Group Color | hex-6 regex, default #6366f1 indigo (shared queries:82) | ✅ |
| Member Count | denormalized column default 0 (schema.ts:66); recounted from rows after every add/remove (shared queries:118-127, :140-150) | ✅ |

### Membership

| Term | Code evidence | Status |
|------|---------------|--------|
| Member | customerGroupMembers with assignedAt; uniqueIndex on (customerId, groupId) (schema.ts:75-86) | ✅ |
| Idempotent Addition | onConflictDoNothing then recount (:110-128) | ✅ |
| Silent Removal | delete-nothing + recount + success; customer existence unchecked (handler validates group only :122-131) | ✅ |
| Membership Guard | memberCount > 0 → 422 GROUP_HAS_MEMBERS with groupId/name/count context (handlers.ts:77-88) | ✅ |

### Boundaries & Edge Cases

✅ Duplicate names legal — verified absence of unique constraint/index on name
✅ Cascade desync — both FKs onDelete cascade; counts untouched by cascade removals
✅ Removal skips customer validation — same asymmetry as tags (add validates, remove doesn't)
✅ ?members=true embeds full member summaries with stats + assignedAt (shared queries:52-72)
✅ RBAC CUSTOMER_GROUPS_READ / CUSTOMER_GROUPS_MANAGE on all 7 routes
✅ Audit logging for all five action types against ACTIONS catalog
✅ README's description ≤500 claim verified accurate

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — phantom `openapi.ts` removed (**8th instance** of this lie family); missing `ai-tools.ts` + tests added; queries.ts credited as shared re-export.
2. **README DELETE section** — claimed unconditional "removes all member associations". Reality: a **422 GROUP_HAS_MEMBERS guard blocks deletion while members exist**. Rewritten to lead with the guard.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Phantom-member lockout**: customer deletion cascades memberships without recounting — groups can become undeletable on stale counts until new membership traffic self-heals them.
2. **Name collisions are silent by design**: no uniqueness anywhere; UIs must disambiguate by color/description/ID.
3. **Removal trusts nothing about the customer**: unknown IDs succeed silently.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Group Anatomy | 4 | ✅ 4/4 | 0 |
| Membership | 4 | ✅ 4/4 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 4 | ✅ 4/4 | 0 |
| **TOTAL** | **16** | **✅ 16/16** | **0 in glossary / 2 README fixes applied** |

---

## 🎯 Confidence Level: HIGH (~98%)

The tags/groups sibling comparison was done from both sides' code, so the one genuine
difference (name uniqueness) was caught rather than assumed to be symmetric.

*Repo-wide typecheck note: still red from another agent's concurrent schemas refactor — unrelated
here (markdown-only changes).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Customer Groups row added.
Remaining from the requested batch: `product-groups/`.
