# Wilayas CONTEXT.md Verification Report

**Date:** August 24, 2026
**Status:** ✅ VERIFIED AGAINST CODE

---

## 🔍 Verification Method

Every file read in full, plus seed-data inspection:

- `wilayas/handlers.ts`, `routes.ts`, `queries.ts`, `validation.ts`, `ai-tools.ts`, `README.md`
- `cod-shared/queries/wilayas.ts` (complete)
- `index.ts:23` — which router is actually mounted
- Migration seed `0000_complete.sql:654+` — actual commune ID / postal code formats
- Repo-wide grep for `"16001"` and commune-ID usage across schemas, routes, tests

---

## ✅ VERIFIED — Terms Match Code

### Geography

| Term | Code evidence | Status |
|------|---------------|--------|
| Wilaya | integer PK = official number (schema.ts:121-130 "Integer PK matches the official wilaya number"); consumed as int everywhere (orders, shipping rules, compensations) | ✅ |
| Commune | text PK; seed format `c-01-001`… verified across all INSERT rows (0000_complete.sql:654+) | ✅ |
| Postal Code | separate nullable column, zero-padded strings `'01001'` in seed; used for stop-desk lookups (schema.ts:134 comment) | ✅ |
| Bilingual Names | name + nameAr on both tables; search `or(like(name), like(nameAr))` (shared queries/wilayas.ts:21) | ✅ |

### Reference Data Rules

| Term | Code evidence | Status |
|------|---------------|--------|
| Read-Only Reference | only two GET handlers exist (handlers.ts); ai-tools.ts:21 "purely read-only" | ✅ |
| Open Access | no requireScope middleware on either route (routes.ts:44-84); header comment "DELIVERY_READ not required" | ✅ |
| Official Ordering | wilayas orderBy id asc (:26); communes orderBy name asc (:38) | ✅ |

### Boundaries & Edge Cases

✅ Tolerant ID parsing — route preprocess mirrors handler parseInt incl. `"16abc"` acceptance, with explanatory comments (routes.ts:35-42, 86-99)
✅ ID ≠ Postal Code — distinct columns in seed; conflated in old examples (now fixed)
✅ Empty Arabic names — seed row `('c-01-024',1,'Talmine','','01024')` has blank nameAr
✅ No pagination — filter schema exposes only `search` (validation.ts)

---

## 🔧 TRUTH FIXES APPLIED WHILE VERIFYING

1. **README.md structure block** — listed a phantom `openapi.ts` (same lie as driver-payments had). Removed; tree now lists real files including the unmounted `routes.prototype.ts` prototype and dated archival docs, each labeled.
2. **ai-tools.ts — three "UUID" claims** — header comment, tool description, and inline comment called commune IDs UUIDs. Seed proves they are `c-XX-YYY` text IDs. All three rewritten.
3. **openapi/schemas.ts CommuneSchema example** — `id: "16001"` is a postal-code-shaped string, not a real ID. Changed to `"c-16-001"` (matches seed pattern).
4. **shipping-profiles/routes.ts communeId example** — same `"16001"` mistake. Changed to `"c-16-001"`.

Note: test fixtures still use arbitrary mock IDs like `"16001"` — those are mocked-database values, not documentation claims, and were left alone.

---

## ❌ REMAINING DOC NOTES (not lies — flagged for awareness)

1. **Archival process docs**: `CODE-REVIEW.md` (dated Aug 23, 2026), `PROTOTYPE-SUMMARY.md`, `READY-TO-MIGRATE.md` describe the route-builder migration as pending, but it already happened (`index.ts` mounts the migrated `routes.ts`). They are dated history, kept for reference and labeled as archival in the README tree — safe to delete if you want a cleaner folder.
2. **Map's "~1500 communes"** — seed contains 1541; approximation is fine but now on record.

---

## 📊 Verification Summary

| Category | Terms | Verified | Issues |
|----------|-------|----------|--------|
| Geography | 4 | ✅ 4/4 | 0 |
| Reference Data Rules | 3 | ✅ 3/3 | 0 |
| Boundaries | 4 pointers | ✅ 4/4 | 0 |
| Edge Cases | 4 | ✅ 4/4 | 0 |
| **TOTAL** | **15** | **✅ 15/15** | **0 in glossary / 4 doc lies fixed** |

---

## 🎯 Confidence Level: HIGH (~99%)

Smallest module in the repo, fully traced — including against the actual SQL seed rather than
any doc's claims about ID formats.

---

## 🛠️ Next Steps (per convention: one CONTEXT.md per endpoint folder)

- [x] `orders/`, `delivery-companies/`, `driver-payments/`, `drivers/`, `shipping-profiles/`
- [x] `wilayas/CONTEXT.md` ← this file (+ 4 doc lies fixed across README/ai-tools/OpenAPI examples)
- [ ] `products/CONTEXT.md`, `customers/CONTEXT.md`, `store/CONTEXT.md`

Map updated: `cod-server/CONTEXT-MAP.md` — Wilayas added as its own context row.
