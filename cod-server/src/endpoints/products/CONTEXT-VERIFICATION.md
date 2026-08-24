# Products CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `products/handlers.ts`, `routes.ts` (all 15 routes), `validation.ts`, `queries.ts`, `README.md`
- `cod-shared/queries/products.ts` (complete), `cod-shared/queries/variants.ts` (complete)
- `variants/handlers.ts` + `ai-tools.ts` (deletion semantics)
- `cod-shared/db/schema.ts:548-677` — products, variants, images, order_products tables
- Storefront exposure cross-checked in `store/routes.ts:75-80`
- Repo-wide grep for visibility / showInStore / storeFeatured consumers

---

## ✅ VERIFIED — Terms Match Code

### Catalog Shape

| Term | Code evidence | Status |
|------|---------------|--------|
| Product / Simple / Variant Product | schema.ts:565-607; superRefine requires SKU when hasVariants=false (validation.ts:33-41) | ✅ |
| Variant Options | JSON blueprint `{name, values:[{value, hexColor?}]}` (validation.ts:3-9; schema.ts:576) | ✅ |
| Variant | own price/required SKU/inventory/barcode/weightKg/imageId (schema.ts:609-628) | ✅ |
| Handle | auto-generated `slug(name)-id8` when omitted (shared queries/products.ts:65-67, :159) | ✅ |

### Lifecycle & Exposure

| Term | Code evidence | Status |
|------|---------------|--------|
| Product Status | DRAFT/ACTIVE/ARCHIVED enum; dedicated status endpoint (routes.ts:168-195) | ✅ |
| Published At — RE-STAMPED on every ACTIVE transition, not first-only | shared queries/products.ts:212-215 | ✅ |
| Visibility vs Show In Store vs Store Featured | storefront gate needs status=ACTIVE AND showInStore AND visibility AND not deleted (store/routes.ts:75); featured is a filter flag (:80) | ✅ |
| Soft Delete | deletedAt set (queries.ts:224-227); every read filters isNull(deletedAt) (:70, :108) | ✅ |
| Deletion blocked by any order line | handler checks orderProducts with no status filter → PRODUCT_HAS_ORDERS 422 (handlers.ts:107-117) | ✅ |

### Inventory & Money

| Term | Code evidence | Status |
|------|---------------|--------|
| Track Inventory Master Toggle | schema doc verbatim incl. "ALL of its variants are excluded" (schema.ts:579-587) | ✅ |
| Low Stock Threshold | alert line, 0 = disabled (schema.ts:588-589, :619-620) | ✅ |
| Total Inventory | variant-sum for parents, own field for simple (shared queries/products.ts:90-92, :143) | ✅ |
| Compare-At / Cost Price | distinct columns; currency column fixed "DZD" default (:570) | ✅ |

### Boundaries & Edge Cases

✅ Order lines snapshot name/SKU/price at purchase (orderProducts denormalized columns, schema.ts:650-677)
✅ Review aggregates from APPROVED reviews only (shared queries/products.ts:135-136)
✅ SKU two-layer uniqueness — create checks live products only (handlers.ts:41-54); unique index spans soft-deleted rows (schema.ts:577 `.unique()`) → DB-level collision path exists
✅ Variant deletion nulls order lines then hard-deletes — NOT blocked (cod-shared/queries/variants.ts:101-105)
✅ Parent inventory ignored once hasVariants=true (:90-92)
✅ Four-light storefront gate verified
✅ RBAC products:read / products:manage via SCOPES.PRODUCTS_READ/MANAGE (routes.ts throughout)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — phantom `openapi.ts` removed (third folder with this same lie); missing `ai-tools.ts` and test files added; routes.ts description now credits the OpenAPI spec ownership.
2. **README Variants section** — claimed DELETE is "blocked if linked to orders". FALSE: deletion always succeeds and preserves history by nulling references (cod-shared/queries/variants.ts:102). Rewritten; missing GET-single-variant endpoint added.
3. **README Images section** — missing the PATCH reorder endpoint added.
4. **README DELETE product** — claimed unconditional soft-delete "preserving history"; reality is a 422 block whenever any order line exists. Rewritten.
5. **cod-shared/db/schema.ts companyStopDesks header** — claimed the active flag "is NEVER reset by syncs". Reality: surviving desks keep it, vanished desks are hard-deleted with their flag, reappearing desks come back active. Comment rewritten to match sync behavior.

---

## ❌ REMAINING DOC NOTES (not lies)

1. **Update-path SKU collisions surface as raw DB errors**: updateProduct never pre-checks duplicate SKU (create does); the unique index catches it unhandled. Sharp edge recorded in glossary's two-layer note.
2. **publishedAt restamping**: if "first publish" semantics are ever wanted, that's a code change — docs now state current behavior.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Catalog Shape | 6 | ✅ 6/6 | 0 |
| Lifecycle & Exposure | 7 | ✅ 7/7 | 0 |
| Inventory & Money | 4 | ✅ 4/4 | 0 |
| Boundaries | 5 pointers | ✅ 5/5 | 0 |
| Edge Cases | 6 | ✅ 6/6 | 0 |
| **TOTAL** | **28** | **✅ 28/28** | **0 in glossary / 5 doc lies fixed** |

---

## 🎯 Confidence Level: HIGH (~98%)

Largest module so far; every claim traced to handlers, shared queries, or schema — including
cross-checking storefront consumption before defining the three exposure switches.

---

## 🛠️ Next Steps (per convention: one CONTEXT.md per endpoint folder)

- [x] `orders/`, `delivery-companies/`, `driver-payments/`, `drivers/`, `shipping-profiles/`, `wilayas/`
- [x] `products/CONTEXT.md` ← this file (+ README fixes + one schema-comment lie corrected)
- [ ] `customers/CONTEXT.md`, `store/CONTEXT.md`

Map updated: `cod-server/CONTEXT-MAP.md` — Products link now resolves.
