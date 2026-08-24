# Offers CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `offers/handlers.ts`, `routes.ts` (all 5 routes), `validation.ts`, `queries.ts`
- `cod-shared/queries/offers.ts` (complete — CRUD + resolved detail)
- The application engine in `cod-shared/queries/store.ts`: `selectApplicableOffer` (:374-424), reward resolution + stock gating + deduction (:682-800), free-shipping override (:596-597)
- Storefront exposure of active offers on product detail (:194-203, :258)
- Schema: `cod-shared/db/schema.ts:998-1075` incl. header doc comment

---

## ✅ VERIFIED — Terms Match Code

### Offer Anatomy

| Term | Code evidence | Status |
|------|---------------|--------|
| Offer | schema.ts:1000-1014 "Buy X Get Y… no coupon code required" | ✅ |
| Trigger | triggerProductId (cascade FK) + optional triggerVariantId (set-null) + triggerQuantity default 2, max 1000 (schema:1021-1033; validation.ts:7-9) | ✅ |
| Reward | rewardProductId required for "free" type via superRefine (validation.ts:21-29); rewardQuantity min 0 | ✅ |
| Free Shipping Offer | discountType enum ["free","free_shipping"]; zero fee at :596-597; no product inserted (:683-684) | ✅ |
| Schedule | startsAt/endsAt nullable ISO datetimes; null = immediate / never expires (schema:1060-1064; engine :387-388) | ✅ |
| Offer Status | active/inactive; only active qualifies (:385) | ✅ |

### Application

| Term | Code evidence | Status |
|------|---------------|--------|
| Auto-Application | runs inside createStoreOrder; no coupon input anywhere (store.ts:588-594; routes.ts header :4-6) | ✅ |
| Highest-Tier Wins | candidates orderBy desc(triggerQuantity) (:405, :413) — contradicts old schema comment (fixed, see below) | ✅ |
| Explicit Selection Fallback | offerId tried first (:393-399); non-qualifying explicit → full auto-detect fallback (:400-407) | ✅ |
| Silent Stock Skip | rewardInStock gate (:734-751); skip without error when false (no else branch inserts nothing) | ✅ |
| Reward Deduction | deductStockWithLog for tracked rewards (:786-796) | ✅ |

### Variant Resolution & Reward Line

✅ Same-product reward → customer's own variant (:689-691); cross-product → first active variant by position (:692-713); explicit wins always (:686, :714-725)
✅ Reward line: pricePerUnit 0 / lineTotal 0 / label suffixed "🎁 مجاني" (:770-784)

### Boundaries & Edge Cases

✅ One offer per order — single activeOffer variable applied once
✅ Product deletion cascades offers (trigger/reward FKs onDelete cascade, schema:1023-1025, :1040-1041); variant links set null
✅ Inactive invisible everywhere — status filter present in both storefront listing (:198) and selection (:385)
✅ Storefront display list ordered createdAt ASC (:203) — display order ≠ selection priority (documented separately after fix)
✅ RBAC verified: OFFERS_READ / OFFERS_MANAGE on all 5 routes (routes.ts:42-150)
✅ No README exists in this folder — routes/comments were the docs; nothing to fix there

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **cod-shared/db/schema.ts offers header** — claimed "Multiple active offers on same product: first created (createdAt ASC) wins." Actual selection orders by `triggerQuantity DESC` (store.ts:405,413); createdAt ASC governs only the storefront display list (:203). Comment rewritten to state both facts.

---

## ❌ REMAINING DOC NOTES (not lies)

1. **Explicit offerId downgrade is silent**: a pinned-but-unqualified offer falls back to auto-detect with no signal to the caller — recorded as Explicit Selection Fallback so agents don't mistake it for validation.
2. **Reward stock check respects trackInventory only** — untracked rewards are assumed available by design.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Offer Anatomy | 6 | ✅ 6/6 | 0 |
| Application | 5 | ✅ 5/5 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **20** | **✅ 20/20** | **0 in glossary / 1 schema-comment lie fixed** |

---

## 🎯 Confidence Level: HIGH (~98%)

The selection engine was traced query-by-query including ordering, schedule null-handling,
explicit-ID fallback, variant matching loop, and reward stock/deduction paths.

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Offers row added.
Remaining unmapped folders: `reviews/`, `stock/`, `analytics/`, `abandoned-orders/`, `images/`, `activity-logs/`, `users/`, `mcp/`.
