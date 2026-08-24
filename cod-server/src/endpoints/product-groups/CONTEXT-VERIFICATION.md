# Product Groups CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `product-groups/handlers.ts`, `routes.ts` (all 5 routes), `queries.ts`, `validation.ts`, `README.md`
- `cod-shared/queries/product-groups.ts` (complete)
- Schema: `productCategories` (schema.ts:550-563 — slug unique, app-level parentId self-reference)
- Cross-checks: products.categoryId FK usage, Products audit (soft-delete semantics), storefront category consumption (store.ts getStoreCategories)

---

## ✅ VERIFIED — Terms Match Code

### Tree Shape

| Term | Code evidence | Status |
|------|---------------|--------|
| Product Group | manages `product_categories`; routes header "category/collection hierarchy" (routes.ts:4) | ✅ |
| Parent Link | parentId nullable text column, "self-reference at app level" — no DB constraint (schema.ts:555) | ✅ |
| Child List | getGroupById returns one-level children rows only (:66-77); list parentId filter = direct sub-categories | ✅ |
| Position | integer ≥ 0, default 0; orderBy position ascending (:47) | ✅ |

### Identity

| Term | Code evidence | Status |
|------|---------------|--------|
| Slug | `.unique()` DB index (schema.ts:553); auto-generated name+id8 when omitted (shared queries:34-36, :83); regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` (routes.ts:33) | ✅ |
| Group SEO Fields | metaTitle ≤60 / metaDescription ≤160 / metaKeywords nullable (routes.ts:50-52; validation) | ✅ |
| Group Image | imageUrl URL-validated, clearable via null | ✅ |

### Counting & Deletion

| Term | Code evidence | Status |
|------|---------------|--------|
| Product Count | counts products where categoryId matches AND deletedAt IS NULL — **no status filter** (shared queries:50-59) → drafts/archived included | ✅ |
| Membership Guard | productsCount > 0 → 422 PRODUCT_GROUP_HAS_PRODUCTS with groupId/groupName/productsCount (handlers.ts:63-74) | ✅ |
| Hard delete when empty | db.delete on productCategories (:119-121) | ✅ |

### Boundaries & Edge Cases

✅ Drafts block deletion — direct consequence of the status-less count
✅ Cycles possible — no parent validation anywhere in create/update
✅ Orphaned parents possible — parentId has no FK and no existence check
✅ Slug collisions crash late — unique index without friendly pre-check
✅ Renaming keeps slug — slug changes only when explicitly sent
✅ No activity logging in this module's handlers (asymmetry vs every other audited module)
✅ RBAC PRODUCT_GROUPS_READ / PRODUCT_GROUPS_MANAGE verified on all routes

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README "active" claim (3 spots)** — `productsCount` described as counting "**active** (non-deleted)" products in the list endpoint, detail endpoint, and Features section. The query filters ONLY `deletedAt` (no status check), so DRAFT and ARCHIVED products are counted. All three rewritten to state "non-deleted, any lifecycle status". The matching route description in routes.ts:62 carries the same wording and remains as-is inside code (flagged below).
2. Same lie family also appears in the DELETE constraint explanation ("active products") — corrected to "counted products".

---

## ❌ REMAINING SHARP EDGES (behavior + stale in-code docs)

1. **Stale route description**: routes.ts:62 still says "active, non-deleted products" — the README now tells the truth; the OpenAPI description string itself would need a CODE edit to fix (left for the code owner since it changes generated spec output).
2. **Cycle risk**: self-referencing parentId with no validation means A→B→A loops are creatable today.
3. **Orphaned parentIds**: pointing at nonexistent IDs succeeds silently.
4. **No audit logging**: group create/update/delete produce zero Activity Log rows — unlike every other management module.
5. **Drafts block deletion**: consequence of the status-less count — intentional per guard design but surprising to merchants.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Tree Shape | 4 | ✅ 4/4 | 0 |
| Identity | 3 | ✅ 3/3 | 0 |
| Counting & Deletion | 2 | ✅ 2/2 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **18** | **✅ 18/18** | **0 in glossary / README "active-count" lie fixed ×3** |

---

## 🎯 Confidence Level: HIGH (~97%)

The count-vs-status mismatch was caught by reading the actual WHERE clause against four
separate doc claims. Hierarchy risks (cycles/orphans) verified by absence of any validation
code rather than by assumption.

*Repo-wide typecheck note: still red from another agent's concurrent schemas refactor — unrelated
here (this task touched markdown only).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Product Groups row added. This
completes the requested batch (stores, customer-tags, customer-groups, product-groups).
