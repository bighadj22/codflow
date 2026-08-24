# Abandoned Orders CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `abandoned-orders/routes.ts` (4 dashboard routes), `store-routes.ts` (2 storefront routes)
- `cod-shared/queries/abandoned-orders.ts` (complete)
- Schema: `cod-shared/db/schema.ts:1284-1332` (lifecycle comment, unique session, indexes)
- Cron wiring: `cron/sweep-abandoned-orders.ts` + `index.ts:196`
- Mount points: `index.ts:80` (/store) and `:182` (/api/abandoned-orders)
- Storefront caller verified: `cod-astro/theme01/src/theme/scripts/track-abandonment.ts`

---

## ✅ VERIFIED — Terms Match Code

### Capture

| Term | Code evidence | Status |
|------|---------------|--------|
| Abandoned Checkout | schema header "filled name + phone… never placed an order"; sessionId UNIQUE (schema.ts:1293) | ✅ |
| Session Upsert | ON CONFLICT(sessionId) DO UPDATE refreshing all capture fields but NOT status/createdAt (shared queries:43-89) | ✅ |
| Attribution Capture | fbc/fbp columns + IP/UA captured from headers in route handler (store-routes.ts:113-123; schema:1311-1314) | ✅ |

### Lifecycle

| Term | Code evidence | Status |
|------|---------------|--------|
| Pending / Abandoned / Converted / Contacted | status enum verbatim (schema.ts:1316-1318); lifecycle doc comment (:1285-1290) | ✅ |
| Recovery Sweep | cron flips pending→abandoned where createdAt < now−30min, returns count (shared queries:126-143); wired via waitUntil (index.ts:196) | ✅ — note cutoff uses **createdAt**, not updatedAt |
| Converted link | stores convertedOrderId + convertedOrderNumber; idempotency guard `status != 'converted'` (:109-123) | ✅ |

### Measurement

| Term | Code evidence | Status |
|------|---------------|--------|
| Recovery Stats | totalAbandoned + totalConverted counts; conversionRate = round(converted/(abandoned+converted)×100) (:184-207) | ✅ |
| Estimated Lost Revenue | Σ(price) over abandoned records (:194-197, :205); price is client-supplied optional field (store-routes upsert schema :42) | ✅ |

### Boundaries & Edge Cases

✅ Fire-and-forget conversion — handler `.catch(() => {})` swallows all errors; 200 always (store-routes.ts:133-138), documented intentionally in route description
✅ Unguarded transitions — updateAbandonedOrderStatus writes any enum value with no rank/transition table (shared queries:210-220), unlike order webhooks' Regression Guard
✅ Upsert preserves earned status — conflict update set omits status
✅ Search spans customerName + phone; list newest-first; limit max 200 (routes.ts:58)
✅ Split auth surfaces — X-Store-API-Key under /store vs ABANDONED_ORDERS_READ/MANAGE dashboard scopes (routes.ts:46, :87, :112, :144)
✅ AGENTS.md claim re-verified: backend collection + cron exist while merchant UI is a placeholder — consistent

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

**None required.** This folder ships no README; both route files carry accurate docstrings
(including the honest "Intentionally returns 200 even if the session is unknown" and the
tenancy/scope notes). The only correction this session was to the coordinator's own earlier
map description, which had filed abandoned orders under Store — the map now names this folder.

---

## ❌ REMAINING SHARP EDGES (behavior, deliberately documented)

1. **Silent conversion failures**: a swallowed DB error means recovery attribution can be lost invisibly.
2. **No transition ranks**: converted→abandoned via PATCH would distort stats — possible today, guarded nowhere.
3. **Aspirational revenue**: estimatedLostRevenue trusts client-typed prices; treat as directional only.
4. **Sweep uses createdAt**: long-running sessions are flagged abandoned mid-edit; later conversion still corrects them.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Capture | 3 | ✅ 3/3 | 0 |
| Lifecycle | 6 | ✅ 6/6 | 0 |
| Measurement | 2 | ✅ 2/2 | 0 |
| Boundaries | 3 pointers | ✅ 3/3 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **19** | **✅ 19/19** | **0 in glossary / 0 fixes needed — docs were already truthful** |

---

## 🎯 Confidence Level: HIGH (~98%)

Both public and dashboard surfaces traced including cron timing semantics and the deliberate
fire-and-forget contract. The createdAt-vs-updatedAt sweep detail was read line-by-line before
being written down.

*Repo-wide typecheck remains red from the concurrent `src/openapi/schemas/*` refactor by another
agent — unrelated to this folder (markdown-only changes here).*

---

## 🛠️ Next Steps

Map updated by coordinator: `cod-server/CONTEXT-MAP.md` — Abandoned Orders row added.
Remaining unmapped folders: `images/`, `activity-logs/`, `users/`, `mcp/`.
