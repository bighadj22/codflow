# Stock CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `stock/handlers.ts`, `routes.ts` (both routers, 7 routes), `queries.ts`, `validation.ts`, `README.md`
- `cod-shared/queries/stock.ts` (complete — movement types, history, overview, alerts, thresholds)
- Schema cross-references: `products.inventory` / `productVariants.inventory` / `lowStockThreshold` / `trackInventory` (schema.ts:579-589, :618-620) and `stockMovements` usage across orders/store flows
- Cross-context deduction paths re-checked in `cod-shared/queries/orders.ts` and `store.ts`

---

## ✅ VERIFIED — Terms Match Code

### Inventory Model

| Term | Code evidence | Status |
|------|---------------|--------|
| Tracked SKU | overview counts simple products (hasVariants=false) + active variants of variant products separately (shared queries:116-155); totalSkus increments per row (:164, :183) | ✅ |
| Track Inventory Toggle | both overview queries filter trackInventory=true (:129, :150) | ✅ |
| Inventory never negative | adjustStock rejects qtyAfter < 0 with INSUFFICIENT_STOCK + available/required context (endpoint queries.ts:56-74) | ✅ |

### Movements

| Term | Code evidence | Status |
|------|---------------|--------|
| Stock Movement | append-only rows with delta/qtyBefore/qtyAfter/reason/reference/attribution (endpoint queries.ts:90-104); no update/delete path exists | ✅ |
| Movement Type | 7-value const list (shared queries:14-22); README list matches exactly | ✅ |
| Required Reason | REASON_REQUIRED_TYPES = ADJUSTMENT_ADD / ADJUSTMENT_REMOVE / OFFLINE_SALE (validation.ts:12-16); Arabic messages :25-35 | ✅ |
| Negative Guard | 422 with {stockId, productName, available, required} context (:64-73; route desc routes.ts:157-159) | ✅ |

### Health & Alerting

| Term | Code evidence | Status |
|------|---------------|--------|
| Stock Overview | computed per call; totalSkus, out/low counts, value = Σ inventory × price, currency "DZD" (shared queries:116-219) | ✅ |
| Low Stock Threshold | 0–9999 int; threshold 0 → only out-of-stock surfaces (else-if chain :178-179/:200-201); update endpoints product+variant (:241-278) | ✅ |
| Alert Ordering | out-of-stock first then inventory ascending (:204-207, :229-232) | ✅ |

### Boundaries & Edge Cases

✅ Order-driven movements written by Orders context (ORDER_DEDUCTED at creation; ORDER_CANCELLED/RETURNED on cancel/return/delete) — verified in cod-shared/orders.ts + store.ts deductStockWithLog
✅ Store reward stock check consults inventory before inserting free lines (store.ts:734-751)
✅ Overview recomputed every call — no caching layer exists
✅ Inactive variants excluded from overview/alerts (:152 active=true filter)
✅ Deleted products: threshold update requires non-deleted (:249-251); historical movements remain queryable
✅ RBAC products:read (overview/alerts/history) vs products:manage (adjust/thresholds) verified on all routes
✅ Attribution from authenticated user, fallback name "Unknown" (handlers.ts:28-29, :54-55)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — phantom `openapi.ts` removed (**6th instance** of this lie family); missing `ai-tools.ts` + tests added; routers/split described accurately.
2. **README endpoints section** — was missing three real endpoints: variant-level adjust (`POST …/variants/{variantId}/stock/adjust`) and BOTH threshold PATCH endpoints. Added with correct semantics.

Everything else in the README checked out verbatim: the 7 movement types, qtyBefore/qtyAfter/actor logging, negative-inventory guard, hierarchical overview, DZD valuation.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Adjustments are sequential, not transactional**: inventory update and movement insert run as separate statements — a crash between them would desync ledger from reality. README's "atomic adjustments" wording was softened to match ("performed sequentially").
2. **Alert pagination slices a rebuilt array**: alerts derive from a full overview rebuild then slice — fine at this scale, but it is recomputation-per-request by design.
3. **Untracked products are invisible**: intentional infinity — recorded so nobody "fixes" them into overview totals.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Inventory Model | 3 | ✅ 3/3 | 0 |
| Movements | 4 | ✅ 4/4 | 0 |
| Health & Alerting | 3 | ✅ 3/3 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **19** | **✅ 19/19** | **0 in glossary / 2 README fixes applied** |

---

## 🎯 Confidence Level: HIGH (~98%)

Both write paths (manual adjust, order-driven automation) traced end-to-end including the
movement ledger; overview/alerts arithmetic read line-by-line.

*Note: repo-wide `npm run typecheck` currently fails due to a concurrent agent's in-flight
`src/openapi/schemas/*` refactor — unrelated to this folder (markdown-only changes here).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Stock row added.
Remaining unmapped folders: `variants/`, `analytics/`, `abandoned-orders/`, `images/`, `activity-logs/`, `users/`, `mcp/`.
