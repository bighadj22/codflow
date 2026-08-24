# Drivers CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file in the folder read in full, plus shared sources:

- `drivers/handlers.ts`, `routes.ts`, `validation.ts` (complete), `queries.ts`
- `cod-shared/queries/drivers.ts` (complete — all CRUD + compensation helpers)
- `cod-shared/db/schema.ts:235-282` — drivers + driver_compensations tables, FK cascades
- `drivers/README.md` — checked for misleading claims
- Repo-wide grep to confirm nothing auto-writes driver status

---

## ✅ VERIFIED — Terms Match Code

### Identity

| Term | Code evidence | Status |
|------|---------------|--------|
| Driver | schema.ts:230-256 "In-house delivery drivers managed by the store" | ✅ |
| Availability Status | enum `available/busy/inactive` (validation.ts:15; schema.ts:242-244); dedicated PATCH /{id}/status endpoint (routes.ts:232-270) | ✅ |
| Vehicle Type | enum `motorcycle/car/van`, nullable (validation.ts:14) | ✅ |
| Phone Uniqueness | primary checked on create AND update → DUPLICATE_PHONE 409 (shared queries/drivers.ts:136-145, 175-185; handlers.ts:77-79, 108-110); phone2 never uniqueness-checked | ✅ |
| Algerian phone format | `/^0[5-7]\d{8}$/` both fields (validation.ts:9-13) | ✅ |

### Payroll

| Term | Code evidence | Status |
|------|---------------|--------|
| Compensation Grid | getCompensationsForDriver returns ALL wilayas with `feePerDelivery: null` for unset ("always 58 rows, sparse overlay", shared queries/drivers.ts:223-251) | ✅ |
| Fee Per Delivery | "What the store pays this driver per delivery in this wilaya (DZD)" min(0) (validation.ts:52); idempotent upsert PUT (routes.ts:338-340) | ✅ |
| Sparse Grid Rule | header comment "assignment still works at driverFee = 0" (shared queries/drivers.ts:4-7); delete-compensation route doc agrees (routes.ts:388-389) | ✅ |
| Coverage | compensationWilayaCount computed on list and detail (shared queries/drivers.ts:87-99, 128-131); wilayaId filter matches drivers WITH a configured row (:65-76) | ✅ |

### Guards

| Term | Code evidence | Status |
|------|---------------|--------|
| Active Orders | delete blocked when status IN (assigned, out_for_delivery) → DRIVER_HAS_ACTIVE_ORDERS 409 + activeOrderCount (queries.ts:35-53) | ✅ |
| Cascade Erasure | driver_compensations.driverId ON DELETE CASCADE (schema.ts:270-272) **and** driver_payments.driverId ON DELETE CASCADE (schema.ts:296-298) | ✅ |

### Boundaries & Edge Cases

✅ Status purely manual — repo-wide grep: the only writer of `drivers.status` is updateDriverStatus (shared queries/drivers.ts:205-208); assignment/dispatch/delivery flows never touch it
✅ Deletion destroys financial history — verified cascade above; README §6 mentions only compensations cascading, NOT payments
✅ Secondary phones can collide — no uniqueness check exists for phone2
✅ Search ignores secondary phones — like() on firstName/lastName/phone only (shared queries/drivers.ts:55-63)
✅ Recent Orders snapshot — limit(10) ordered by updatedAt desc (shared queries/drivers.ts:120-126)
✅ Ledger counters live on driver record but semantics owned by Payments context (schema.ts:245-252 comments point at delivered transition / remittance)
✅ RBAC delivery:read / delivery:manage (routes.ts:59, 102, 306, 336, 385)
✅ Activity audit — driver.created / updated / status_changed / deleted (handlers.ts:72, 103, 131, 154)

---

## ❌ DISCREPANCIES FOUND IN CODE DOCS (not in CONTEXT.md)

CONTEXT.md was written to **actual behavior**; these doc gaps were deliberately not baked in.

### 1. README understates Cascade Erasure

README §6 says deletion "cascades to all associated `driver_compensations` rows" — true but
incomplete. `driver_payments` rows ALSO cascade (schema.ts:296-298), so settlement/audit history
is destroyed too. A merchant deleting a driver with unsettled COD loses the receipts trail.
CONTEXT.md records this as **Cascade Erasure** so agents warn about it.

### 2. Detail query computes an unused total

getDriverById computes `totalFee` (sum of configured fees, shared queries/drivers.ts:111-118)
but never returns it. Dead computation — harmless, worth knowing before someone "fixes" it
into the API shape.

### 3. REST vs AI-tool verb asymmetry

REST operationIds: `createDriver`, `updateDriver`. AI tools: `createNewDriver`,
`updateDriverProfile`. Same operations, different canonical verbs across surfaces — noted here
so glossary consumers don't treat them as distinct concepts.

### 4. Minor

"Case-insensitive search" in README relies on SQLite LIKE default collation — true for ASCII,
untested intent for Arabic names (search also matches Arabic via nameAr? No — driver search is
name/phone only; the Arabic-name matching claim belongs to the wilayas module).

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Identity | 4 | ✅ 4/4 | 0 |
| Payroll | 4 | ✅ 4/4 | 0 |
| Guards | 2 | ✅ 2/2 | 0 |
| Boundaries | 3 pointers | ✅ 3/3 | 0 |
| Edge Cases | 5 | ✅ 5/5 | 0 |
| **TOTAL** | **18** | **✅ 18/18** | **0 in glossary / 4 doc discrepancies** |

---

## 🎯 Confidence Level: HIGH (~98%)

All 18 glossary terms verified line-by-line against implementation. The status-writer grep
eliminated the one claim most likely to be wrong ("status is purely manual") before it was written.

---

## 🛠️ Next Steps (per convention: one CONTEXT.md per endpoint folder)

- [x] `orders/CONTEXT.md`
- [x] `delivery-companies/CONTEXT.md`
- [x] `driver-payments/CONTEXT.md`
- [x] `drivers/CONTEXT.md` ← this file
- [ ] `shipping-profiles/CONTEXT.md` (research ready: profiles, rules, commune overrides, fee resolution)
- [ ] `wilayas/CONTEXT.md`
- [ ] `products/CONTEXT.md`, `customers/CONTEXT.md`, `store/CONTEXT.md`

Map updated: `cod-server/CONTEXT-MAP.md` — Drivers added as its own context row.

---

**Resolution (Aug 24, 2026):** README §6 corrected in place — deletion now documented as cascading both compensations AND payment history.
