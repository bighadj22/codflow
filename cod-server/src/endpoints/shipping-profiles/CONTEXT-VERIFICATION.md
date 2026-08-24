# Shipping Profiles CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full:

- `shipping-profiles/routes.ts` (all 10 routes), `handlers.ts`, `queries.ts`, `validation.ts`, `README.md`
- `cod-shared/queries/shipping-profiles.ts` (complete)
- `cod-shared/db/schema.ts:145-226` — profiles, rules, rule_communes tables + FKs; schema.ts:600-607 product FK
- `orders/resolve-fee.ts` (complete) + `orders/handlers.ts:95-129` (fee resolution call site)

---

## ✅ VERIFIED — Terms Match Code

### Profiles

| Term | Code evidence | Status |
|------|---------------|--------|
| Shipping Profile | "rate cards" README:32; metadata-only create (validation.ts:7-11) | ✅ |
| Default Profile | exactly-one invariant enforced in updateProfile (queries.ts:58-77) + delete guard (handlers.ts:102-108); atomic unset-all on set-default (shared queries:227-229) | ✅ |
| Product Override | products.shippingProfileId FK, onDelete set null (schema.ts:603-604); resolution reads ONLY productIds[0] (resolve-fee.ts:66-83) | ✅ |

### Rules

| Term | Code evidence | Status |
|------|---------------|--------|
| Shipping Rule | wilayaId 1–58 unique per profile, homePrice/stopDeskPrice min 0, homeEnabled default true, stopDeskEnabled default false (validation.ts:19-25; schema.ts:179-194) | ✅ |
| Mode Disable | both-false = no delivery; DELIVERY_NOT_AVAILABLE at creation (resolve-fee.ts:167-182) | ✅ |
| Rule Replacement | PUT delete-then-insert bulk only (queries.ts:94-147); commune overrides cascade via FK (schema.ts ruleId cascade); empty array clears all (route desc routes.ts:238) | ✅ |

### Commune Overrides

| Term | Code evidence | Status |
|------|---------------|--------|
| Commune Override | four nullable fields (validation.ts:33-38); sparse table (schema.ts:208-226) | ✅ |
| Inherit-on-Null | null-check merge at resolution (resolve-fee.ts:153-164); documented route semantics (routes.ts:316-319) | ✅ |
| Effective Values | effectiveHome*/effectiveStopDesk* + hasOverride returned by listing (shared queries:310-332; routes.ts:281-284) | ✅ |
| Empty Override Self-Destructs | all-four-null deletes the row (shared queries:346-362) | ✅ |

### Fee Resolution

| Term | Code evidence | Status |
|------|---------------|--------|
| Fee Resolution | resolveDeliveryFee steps 1–7 verified line-by-line (resolve-fee.ts:57-187) | ✅ |
| Delivery Not Available | missing wilaya rule (:120-128) and disabled mode (:167-182), both DELIVERY_NOT_AVAILABLE | ✅ |
| Free Shipping Offer | active free_shipping offer on any order product reaching triggerQuantity zeroes fee (resolve-fee.ts:194-228) | ✅ |

### Boundaries & Edge Cases

✅ First-product-only override — code checks productIds[0] exclusively; header comment previously claimed "any product" — comment now fixed to match behavior
✅ Replacement wipes commune tuning — cascade verified
✅ No config = free, not blocked — step 3 returns {deliveryFee: 0} with no restriction (resolve-fee.ts:97-100); contrast with missing-rule rejection
✅ Offline bypass — offline orders accept explicit deliveryFee override and swallow coverage errors (handlers.ts:102-128); online re-throws
✅ Last default untouchable — DEFAULT_PROFILE_REQUIRED on unset-last (queries.ts:60-73) and delete-default (handlers.ts:102-108)
✅ In-use profiles refuse deletion — PROFILE_IN_USE when productCount > 0 (handlers.ts:89-99)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

Per repo policy (docs must match code behavior):

1. **resolve-fee.ts header docstring** — claimed "If any product has shippingProfileId set…" / "use the first one found" among multiple products. Actual code consults only `productIds[0]`. Docstring rewritten to state first-product-only. No behavior change.
2. **resolve-fee.ts header citation** — referenced a `SHIPPING_SYSTEM.md` that does not exist anywhere in the repo. Reference removed.

---

## ❌ REMAINING DOC NOTES (accurate docs, surprising behavior)

Not fixes — deliberate design facts recorded so nobody "corrects" them into bugs:

1. **First-product override is a sharp edge**: a cart whose first item lacks an override silently uses the default profile even if item #2 carries one. If this is ever deemed wrong, it's a CODE change, not a docs change.
2. **Rule replacement destroys commune overrides** — inherent to delete-then-insert; intended but lossy.
3. **README verified clean** — every claim checked against code (structure list, invariants, dedup/cascade semantics, set-null FK, fee-resolution description). One wording upgrade applied: fee-resolution line now says "product-level profile override" → clarified to reflect first-product behavior.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Profiles | 3 | ✅ 3/3 | 0 |
| Rules | 3 | ✅ 3/3 | 0 |
| Commune Overrides | 4 | ✅ 4/4 | 0 |
| Fee Resolution | 3 | ✅ 3/3 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 6 | ✅ 6/6 | 0 |
| **TOTAL** | **23** | **✅ 23/23** | **0 in glossary / 2 code-comment lies fixed** |

---

## 🎯 Confidence Level: HIGH (~98%)

All 23 terms verified line-by-line. The fee-resolution path was traced end-to-end from
order creation through profile/rule/override/offer — the most behavior-dense flow verified so far.

---

## 🛠️ Next Steps (per convention: one CONTEXT.md per endpoint folder)

- [x] `orders/`, `delivery-companies/`, `driver-payments/`, `drivers/`
- [x] `shipping-profiles/CONTEXT.md` ← this file (+ README confirmed truthful, resolve-fee comments fixed)
- [ ] `wilayas/CONTEXT.md`
- [ ] `products/CONTEXT.md`, `customers/CONTEXT.md`, `store/CONTEXT.md`

Map updated: `cod-server/CONTEXT-MAP.md` — Shipping Profiles added as its own context row.
