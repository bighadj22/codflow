# Variants CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `variants/handlers.ts`, `validation.ts`, `queries.ts`, `README.md`, `ai-tools.ts`
- `cod-shared/queries/variants.ts` (complete — CRUD + deletion semantics)
- Schema: `cod-shared/db/schema.ts:609-628` productVariants incl. unique SKU index
- Routing home verified: `products/routes.ts:371-511` registers all 5 variant routes; no local router exists
- Storefront isDefault consumption verified in `cod-astro/theme01` ProductDetailContent.astro:31
- Repo-wide grep confirming nothing validates `variations` against `variantOptions`

---

## ✅ VERIFIED — Terms Match Code

### Shape

| Term | Code evidence | Status |
|------|---------------|--------|
| Variant | schema.ts:609-628 full column set (price, sku unique, barcode, inventory, threshold, weightKg, imageId, isDefault, active, position) | ✅ |
| Variations | JSON record, parsed on read (shared queries:35-37); NO blueprint validation at create | ✅ |
| Default Variant | storefront picks `find(v => v.isDefault) ?? variants[0]` (theme01 ProductDetailContent.astro:31); flag not exclusive anywhere | ✅ |
| Active Variant | active filter used in storefront stock totals and reward selection (store.ts:152, :703) | ✅ |

### Identity & Money

| Term | Code evidence | Status |
|------|---------------|--------|
| Variant SKU | `.unique()` DB index only (schema.ts:616); no app-level duplicate check in create/update paths | ✅ |
| Variant Price | independent int price per variant; parent price unused in variant math | ✅ |
| Barcode | free text, no format/uniqueness rules | ✅ |

### Lifecycle

| Term | Code evidence | Status |
|------|---------------|--------|
| Hard Deletion with History Preservation | nulls orderProducts.variantId then db.delete (cod-shared/queries/variants.ts:101-105) | ✅ |
| Position | orderBy position on all listings (:44; products detail :77) | ✅ |

### Boundaries & Edge Cases

✅ No blueprint police — createVariant inserts any record (shared queries:54-79); zero references to variantOptions in the creation path
✅ SKU collisions crash late — no pre-check; raw constraint error path
✅ Parent existence assumed — no getProductById guard before insert
✅ Multiple defaults legal — updateVariant sets flag without clearing siblings
✅ Deletion keeps receipt, loses link — line retains denormalized label/SKU text (orderProducts columns), pointer nulled
✅ Vestigial guard discovered: handlers.deleteVariant catches "Cannot delete…" → VARIANT_HAS_ORDERS, but current query never throws it — dead branch, documented as such
✅ RBAC inherited from products router (products:read / products:manage)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — added missing `ai-tools.ts`; corrected queries.ts description (it's a re-export barrel, not "order checks"); noted routing lives in products/routes.ts.
2. **README variations claim** — "must correspond to the variantOptions" → rewritten to state creation performs **no blueprint validation**.
3. **README DELETE section + Reference Guard bullet** — claimed deletion is "Blocked (409 Conflict)" via an explicit order-link check. FALSE twice over: deletion always proceeds, nulling order-line references first. Both rewritten; the unreachable legacy guard is now explicitly called out so nobody mistakes it for live behavior.
4. **Missing GET single variant endpoint** added to README endpoint list.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Blueprint drift is possible by design**: options and real variants can diverge silently; fixing that = CODE change (validate against variantOptions at create/update).
2. **Late SKU failures**: duplicate-SKU creates/updates produce unfriendly 500-style errors from the constraint instead of 409s.
3. **Multi-default ambiguity**: storefront resolves ties by position/array order — merchants get no warning.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Shape | 4 | ✅ 4/4 | 0 |
| Identity & Money | 3 | ✅ 3/3 | 0 |
| Lifecycle | 2 | ✅ 2/2 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **18** | **✅ 18/18** | **0 in glossary / 4 README lies fixed** |

---

## 🎯 Confidence Level: HIGH (~98%)

Deepest cross-module trace so far: handlers → shared queries → schema constraints → products
router mounting → theme storefront consumption, each verified before a single term was written.

*Repo-wide typecheck note: currently red from another agent's concurrent `src/openapi/schemas/*`
work — unrelated here (this task touched markdown only).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Variants row added.
Remaining unmapped folders: `analytics/`, `abandoned-orders/`, `images/`, `activity-logs/`, `users/`, `mcp/`.
