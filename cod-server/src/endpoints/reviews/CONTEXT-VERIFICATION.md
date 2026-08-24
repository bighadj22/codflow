# Reviews CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `reviews/handlers.ts`, `routes.ts` (all 3 routes), `queries.ts`, `README.md`
- `cod-shared/queries/reviews.ts` (complete)
- Reviews table: `cod-shared/db/schema.ts:846-878` incl. unique index and cascade FKs
- Storefront intake cross-checked: `store/handlers.ts` submitReview (:188-227), `store/validation.ts` storeReviewSchema docstring, `cod-shared/queries/store.ts` findOrderForReview (:904-939), getExistingReviewByOrder (:941-943), createReview (:945-978), getApprovedProductReviews (:861-901)
- Audit constants verified in `lib/activity.ts:61-63`
- Repo-wide grep proving `helpfulCount` is never incremented

---

## ✅ VERIFIED — Terms Match Code

### Review Anatomy

| Term | Code evidence | Status |
|------|---------------|--------|
| Review | schema.ts:846-849 header "identity comes from the order" | ✅ |
| Rating | integer, zod min/max 1–5 + DB CHECK comment (schema.ts:866-867) | ✅ |
| Order Anchor | app check (store/handlers getExistingReviewByOrder :204-214) AND `reviews_order_unique` index on orderId (schema.ts:877) | ✅ |
| Snapshot Attribution | denormalised orderNumber + customerName copied at submission (schema.ts:862-865; store.ts createReview :961-975) | ✅ |
| Helpful Count | default 0; repo-wide grep shows zero increment sites (only reads + init) | ✅ |

### Moderation Lifecycle

| Term | Code evidence | Status |
|------|---------------|--------|
| Pending Queue | status default "pending" (schema.ts:870-872); global pendingCount ignoring filters (shared queries:51-55) | ✅ |
| Approval / Rejection | PATCH accepts all three statuses; audit logs REVIEW_APPROVED/REVIEW_REJECTED with rating + orderNumber metadata (handlers.ts:46-52; activity.ts:61-62) | ✅ |
| Re-Queuing | PATCH body enum includes "pending" — reversal legal (routes.ts:91) | ✅ |
| Hard Deletion | db.delete, REVIEW_DELETED logged with metadata (shared queries:85-87; handlers.ts:57-73) | ✅ |

### Visibility & Aggregation

| Term | Code evidence | Status |
|------|---------------|--------|
| Approved-Only Display | storefront listing filters status="approved" (store.ts:874-877); CRM list sees all | ✅ |
| Live Aggregates | ROUND(AVG)/COUNT computed per read over approved reviews in products list/detail and store catalog (products queries:135-136; store.ts:94-95) | ✅ |

### Boundaries & Edge Cases

✅ Product match unchecked — submitReview validates the ORDER only; data.productId stored verbatim with no membership test (store/handlers.ts:199-225 has no such check)
✅ Deleting anchor order cascades review away (schema.ts:859-861 onDelete cascade)
✅ pendingCount global by design — badge metric (routes.ts:37-39 description matches query behavior)
✅ RBAC split via router-level middleware REVIEWS_READ on "/" vs REVIEWS_MANAGE on "/:id" (routes.ts:141-142)
✅ Storefront intake ownership documented as a boundary (Store context), matching the store folder's own docs

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README structure block** — phantom `openapi.ts` removed (**5th instance** of this lie family across audited folders); missing `ai-tools.ts` + tests added; routes.ts credited with spec ownership.
2. **README PATCH section** — said "approve or reject"; endpoint also accepts `pending`, so re-queuing is legal. Added.

Everything else checked out: action names (`review.approved` / `review.rejected` / `review.deleted`), leftJoin product-name claim, live pendingCount claim, audit metadata claims — all verified accurate.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Unverified product-order pairing at submission**: a valid order number can review ANY product in the store. Recorded verbatim in glossary Edge Cases — tightening it would be a CODE change.
2. **Helpful Count is dormant**: displayed everywhere, mutated nowhere. Documented so agents don't invent an increment path that doesn't exist.
3. **Order deletion silently deletes reviews**: aggregates shift with no tombstone — inherent to cascade design.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Review Anatomy | 5 | ✅ 5/5 | 0 |
| Moderation Lifecycle | 4 | ✅ 4/4 | 0 |
| Visibility & Aggregation | 2 | ✅ 2/2 | 0 |
| Boundaries | 3 pointers | ✅ 3/3 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **19** | **✅ 19/19** | **0 in glossary / 2 README fixes applied** |

---

## 🎯 Confidence Level: HIGH (~98%)

Small module, fully traced including its storefront counterpart and the DB-level uniqueness
backstop. The helpfulCount grep eliminated the one claim most likely to be written wrong.

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Reviews row added.
Remaining unmapped folders: `stock/`, `analytics/`, `abandoned-orders/`, `images/`, `activity-logs/`, `users/`, `mcp/`.
