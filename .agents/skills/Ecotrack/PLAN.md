# EcoTrack Full-Rollout Plan — 82 Couriers, Production Ready

Execution plan for: all 82 EcoTrack couriers onboarded, adapter verified
against the official API, production-grade, zero interference with non-EcoTrack
providers (noest, yalidine, zr_express).

**How to use this file**: work slices in order, top to bottom. Before starting
a slice, mark it `IN PROGRESS` here. When done, mark `DONE ✅` with the date.
Every slice ends green (`npm run typecheck` + `npm test` in cod-server) or it
is not done. Never batch-skip verification.

**Sources of truth**:
- `API-REFERENCE.md` — official API (from the Postman collection)
- `CONFORMANCE.md` — current audit (what is right / missing / wrong)
- `CODEBASE-MAP.md` — where our code lives

---

## Design principles (from `.agents/skills/codebase-design`)

1. **The adapter is one deep module.** 82 companies ride one `EcotrackProvider`
   behind the existing small `DeliveryProvider` interface. We add ZERO
   per-company code — companies are catalog DATA + DB rows.
2. **The tenant catalog is data, not code.** No `if (company === "dhd")`
   anywhere. Tenant quirks live in CONFORMANCE.md as observations, never as
   branches.
3. **The mock EcoTrack server is a test adapter at an internal seam.** It
   satisfies the same HTTP surface as a real `*.ecotrack.dz` host using the
   Postman collection's documented responses. One mock, reused by every test —
   that is how we "test the Postman collection until we get real keys".
4. **Isolation by contract, proven by tests.** EcoTrack changes must not leak
   through the shared seams (`DeliveryProvider` interface stays frozen;
   registry only gains read logic). The proof is the untouched sibling adapter
   test suites staying green.
5. **Never assume.** Every slice begins by reading the actual code it touches.
   Docs-claims require code-verification (repo rule) before they go in a README.

## Definition of Done (whole project)

- [x] All 82 couriers seeded (idempotent script — `node cod-server/scripts/seed-ecotrack-companies.mjs`, proven on local D1; run with `--remote` for production)
- [x] Adapter tested against Postman-documented responses for every implemented endpoint (success + every documented error shape) — mock server + characterization suite
- [x] All CONFORMANCE.md discrepancies resolved or explicitly deferred with reason
- [x] Full cod-server suite green (78 files / 1322 tests) — noest / yalidine / zr_express folders untouched; cod-client-astro (the MAIN dashboard) green (33 files / 139 tests) with the new carrier API adapters; cod-client is legacy (its 2 pre-existing MCP_* registry failures predate and are unrelated to EcoTrack)
- [x] No credentials committed; mock-only testing documented
- [x] README claims code-verified (checked 2026-09-01 — accurate, no changes needed); CONFORMANCE.md updated to final state

---

## Slice overview

| # | Slice | Depends on | Status |
|---|---|---|---|
| 0 | Baseline & guard rails | — | DONE ✅ 2026-09-01 |
| 1 | Mock EcoTrack server (Postman fixtures) | 0 | DONE ✅ 2026-09-01 |
| 2 | Adapter characterization tests | 0, 1 | DONE ✅ 2026-09-1 |
| 3 | Error handling: rate limit + business codes | 2 | DONE ✅ 2026-09-01 |
| 4 | Discrepancy fixes + `montant` decision | 3 | DONE ✅ 2026-09-01 |
| 5 | Tenant catalog module (82 couriers, data) | 0 | DONE ✅ 2026-09-01 |
| 6 | Seed script: idempotent upsert of 82 companies | 5 | DONE ✅ 2026-09-01 |
| 7 | Test-connection (`validate/token`) + territory checks (`get/wilayas`) | 1, 4 | DONE ✅ 2026-09-01 |
| 8 | Tracking completeness: bulk tracking + orders list + status filter | 4 | DONE ✅ 2026-09-01 |
| 9 | Returns lifecycle: ask-return + validate-returns | 4 | DONE ✅ 2026-09-01 |
| 10 | Stop-desk enrichment (`get/desks`) | 4 | DONE ✅ 2026-09-01 |
| 11 | Status mapping + reconciliation guard | 8, 9 | DONE ✅ 2026-09-01 |
| 12 | Isolation proof + production rollout checklist | ALL | DONE ✅ 2026-09-01 |

---

## Slice 0 — Baseline & guard rails

**Goal**: know exactly what "not broken" means before touching anything.

Steps:
- [ ] `cd cod-server && npm run typecheck && npm test` — record results (must be green before proceeding; if red, stop and report)
- [ ] Read `cod-server/scripts/seed-local.mjs` end-to-end; record how it talks to
      the DB (direct sqlite vs HTTP) — the seed slice depends on this, do not assume
- [ ] Read `cod-server/src/endpoints/delivery-companies/providers/capabilities.ts`
      (the shared `ProviderCapabilities` type) — confirm which fields the UI reads
- [ ] Add `registry.test.ts` (new file, providers root): `isEcotrackCompany()`
      accepts `ecotrack`, `dhd_ecotrack`, `packers_ecotrack`; rejects `ecotrackx`,
      `noest`, `yalidine`, `zr_express`, empty string. `getProvider()` returns
      `EcotrackProvider` for `ecotrack` + `{any}_ecotrack`, throws for unknown
      codes, throws when `apiToken`/`apiEndpoint` missing
- [ ] Verify: typecheck + tests green

**Done when**: baseline recorded, registry contract locked by tests.

## Slice 1 — Mock EcoTrack server (Postman fixtures)

**Goal**: a reusable in-test HTTP double that behaves like a real
`*.ecotrack.dz` tenant, per the Postman collection. This is THE testing
strategy until real keys exist.

Files (all inside `providers/ecotrack/`):
- [ ] `test/fixtures.ts` — every documented response body as typed constants:
      create success `{success:true, tracking}`, create 422 Laravel bag,
      create 10002 wilaya-refused, bulk success mixed with per-order errors
      (reference-keyed results), validate/update/delete responses (both delete
      shapes), maj array, tracking-info object (all 11 activity keys),
      communes index-keyed object, wilayas array, desks object, fees, orders
      pagination, 429 body
- [ ] `test/mock-server.ts` — `createEcotrackMockServer()`: route handlers for
      all 21 endpoints that assert auth (Bearer everywhere EXCEPT
      `get/orders/status` which must receive `api_token` as query param), assert
      query-param-only bodies on single-order endpoints, and return fixtures.
      Records every request for call-site assertions
- [ ] Wire `global.fetch` interception OR serve + point baseUrl at it — follow
      the SAME pattern yalidine's `adapter.test.ts` uses (fetch mock), extended
      with routing. Keep it internal to the ecotrack folder (internal seam —
      sibling providers must not import it)

**Design check (codebase-design)**: the mock is one deep test module — small
`createEcotrackMockServer()` interface, all 21 endpoints' behavior hidden
inside. Every later test reuses it instead of hand-rolling fixtures.

**Done when**: mock server imported nowhere outside `providers/ecotrack/`, and
a smoke test drives `create/order` + `create/orders` through it.

## Slice 2 — Adapter characterization tests

**Goal**: prove today's adapter against the documented contract, endpoint by
endpoint. `ecotrack/adapter.test.ts` (new — yalidine pattern).

Cover, using the mock server:
- [ ] `createShipment`: correct query-string params (French snake_case, no body),
      full field mapping (nom_client/telephone/adresse/code_wilaya/commune/
      montant/type=1/stop_desk/code_postal/remarque/produit/weight/fragile),
      fragile ≠ canOpen (canOpen must NOT appear in params), 422 bag flattened,
      10002 surfaced, tracking + labelUrl returned
- [ ] `validateShipment`: `valid/order?tracking=&ask_collection=`, both branches
- [ ] `updateShipment`: param RENAMES (client/tel/tel2/product — NOT the create
      names), `type=1` always sent, success and failure branches
- [ ] `deleteShipment`: both response shapes (`{delete:"fail"}`, `{success:false}`)
- [ ] `addRemark` / `getRemarks`: maj plain-array parse, remarque content passthrough
- [ ] `getTrackingInfo`: activity object parse, `date time` combination,
      notification_on_order included
- [ ] `getStopDesks`: index-keyed object parse, has_stop_desk filter,
      code_postal → code mapping, null commune
- [ ] `createShipmentsBulk`: object-keyed body (`orders: {"0":…}`), reference-keyed
      result matching with index fallback, >100 rejection, per-order errors
- [ ] A failing test is a FINDING: fix the test if the code matches
      API-REFERENCE.md; fix the code (in Slice 4) if it doesn't. Record every
      finding in CONFORMANCE.md — never delete a failing expectation silently

**Done when**: `npm test -- ecotrack` green, findings logged.

## Slice 3 — Error handling: rate limit + business codes

**Goal**: EcoTrack's two nonstandard failure modes become typed, testable
behavior. Adapter-internal — no shared-file changes.

- [ ] New `providers/ecotrack/errors.ts`: `EcoTrackApiError` carrying
      `errorCode?` (10001/10002/10003) and `isRateLimit` flag (HTTP 429 or
      "Too Many Attempts" body)
- [ ] HTTP helpers in `adapter.ts` parse: 200-with-`success:false` +
      `error` code → `EcoTrackApiError(code)`; 429 → `EcoTrackApiError(rateLimit)`;
      422 bags already handled (keep `flattenErrorBag`)
- [ ] Decide (small design, present in PR): do dispatch flows catch
      `EcoTrackApiError` rate limits specially? Minimum viable: message
      contains the code + meaning so logs/company_api_logs are actionable.
      Backoff/retry is Slice 11 territory (needs the bulk flows first)
- [ ] Tests: 429, each business code, 422 — via mock server

**Done when**: three failure styles distinguishable in logs and tests.

## Slice 4 — Discrepancy fixes + the `montant` decision

**Goal**: close every CONFORMANCE.md item that is a plain defect. One finding
per commit for reviewability.

- [ ] **`montant` semantics — DECISION REQUIRED (ask the merchant question)**:
      docs say COD includes delivery fees; we send `order.price` only. Options:
      (a) send `order.price + deliveryFee` when the order's shipping rule
      charged a fee, (b) keep product-only if that is the merchant intent.
      This affects ALL providers (shared `CreateShipmentInput.amount`), so the
      fix lands in dispatch flows, not the EcoTrack adapter. Do NOT change
      unilaterally — present evidence (docs quote + schema comment) and ask
- [ ] `capabilities.ts`: reconcile with docs — `canExchange`/`canPartialDelivery`
      flags describe the CARRIER. Decide with the same merchant conversation:
      set flags true (carrier supports) while our domain only dispatches
      type=1, or keep false with a comment explaining the domain limitation.
      Update the file's stale "Test Results 12/13" header to point at
      adapter.test.ts as the live source
- [ ] `updateShipment` `type=1` forcing: keep (all orders are Livraison today),
      but make it read the input's order-type source when order types exist.
      For now: add the invariant to the doc comment + a test pinning it
- [ ] Remove the duplicate `getLabelUrl` retry comment noise if any; no logic
      change expected — verify against mock
- [ ] Re-run adapter tests; update CONFORMANCE.md statuses

**Done when**: every CONFORMANCE ⚠️ item is fixed, decided-with-owner, or
explicitly deferred with a written reason.

## Slice 5 — Tenant catalog module (82 couriers)

**Goal**: the 82 couriers as typed, frozen reference data. Zero behavior.

- [ ] New `providers/ecotrack/catalog.ts`: `EcotrackCourier` =
      `{ key, name, nameAr, baseUrl }`; export `ECOTRACK_COURIERS` (82 entries
      from `about.md`) + `findEcotrackCourier(key)` + `ecotrackCompanyCode(key)`
      → `` `${key}_ecotrack` ``. Keys EXACTLY as in about.md (e.g. `e48hrlivraison`,
      `abdelivery`, … `zinyatec`)
- [ ] baseUrl = `https://{key}.ecotrack.dz` per about.md's stated pattern —
      EXCEPT any courier the docs give a different host for; about.md is
      authoritative, note deviations in comments is NOT allowed (repo: no
      comments unless asked) — keep deviations in CONFORMANCE.md instead
- [ ] **nameAr review gate**: schema requires Arabic names. Draft Arabic names
      (transliterations for Latin brand names are acceptable: "DHD" → "دي إتش دي
      للتوصيل"). This list needs ONE human review pass before seeding remote —
      flag it in the PR, do not block local seeding
- [ ] `catalog.test.ts`: 82 entries, keys unique, codes lowercase-valid
      (regex `^[a-z0-9_]+$`), baseUrls `*.ecotrack.dz`, every `key` ≠ `ecotrack`
      (the generic fallback stays separate)

**Done when**: catalog compiles, tests green, nothing imports it yet (seed is
next).

## Slice 6 — Seed script: idempotent upsert of 82 companies

**Goal**: 82 `delivery_companies` rows, safely, repeatably, remotely.

- [ ] Inspect `seed-local.mjs` mechanics first (Slice 0 finding) and follow its
      established pattern; if it cannot express upserts, add
      `cod-server/scripts/seed-ecotrack-companies.mjs` alongside it
- [ ] Upsert semantics (critical):
      - INSERT if `code` absent: `code={key}_ecotrack`, names from catalog,
        `apiEndpoint` from catalog, `active: false`, NO token (empty = not
        connected — merchant adds their own token per courier dashboard)
      - UPDATE if present: refresh `name`/`nameAr`/`apiEndpoint` ONLY.
        **NEVER touch `apiToken`, `autoValidate`, `active`, `notes`** — those are
        merchant-owned state on existing rows
- [ ] Local run + test: seed twice, assert same 82 rows, assert a manually-set
      token survives the second run (test via the script's dry-run/verify mode
      or a vitest that shells it against the local sqlite — follow whatever the
      existing seed script does for testability; if untestable, add a
      `--verify` mode that prints counts + diffs and test THAT)
- [ ] Remote path documented for Slice 12 (likely `wrangler d1 execute` or a
      one-off admin route — decide here, build in Slice 12)
- [ ] Update CODEBASE-MAP.md + this plan's progress

**Done when**: idempotency proven by running twice, no-credential-clobber
proven by test.

## Slice 7 — Test-connection + territory checks

**Goal**: the two cheap, high-value missing endpoints, wired end-to-end.

- [ ] `verifyToken()` on the adapter: `GET /api/v1/validate/token` — ⚠️ token
      as QUERY PARAM (mock must assert this), parse the three outcomes
      (VALID_TOKEN / INVALID_TOKEN / TOKEN_NOT_ALLOWED)
- [ ] `getWilayas()` on the adapter: parse plain array; expose for coverage
      checks
- [ ] New route via the **route-builder skill** (read its SKILL.md first):
      `POST /delivery-companies/:id/test-connection` → runs verifyToken,
      returns the outcome; scope it like sibling company routes
- [ ] Optional (only if natural): use `getWilayas()` in a read-only
      "coverage" response or as a dispatch-time warning (error 10002
      prevention). If wiring dispatch guards, keep it NON-BLOCKING (warn, don't
      reject) — territory data freshness is not guaranteed
- [ ] Tests: adapter (mock asserts auth styles) + route (handler test pattern
      from existing delivery-companies tests)

**Done when**: a merchant can paste a token and click "Test connection".

## Slice 8 — Tracking completeness

**Goal**: pull-based truth for EcoTrack orders, respecting the 50 req/min budget.

- [ ] `getTrackingsBulk(trackings[])` on the adapter (≤100, `trackings[]`
      array param) — parse per-tracking entries incl. French display statuses
      (pass through raw; mapping is Slice 11)
- [ ] `getOrders({page?, startDate?, endDate?, tracking?})` on the adapter —
      Laravel pagination parse (40/page, 90-day default)
- [ ] `getOrdersStatus(trackings, statuses)` — ⚠️ `api_token` QUERY param auth
- [ ] Wire: `GET /orders/:id/tracking` continues single-lookup; consider a
      batch endpoint ONLY if the dashboard needs it — otherwise these stay
      adapter-level (reconciliation in Slice 11 consumes them)
- [ ] Tests for all three through the mock (esp. the auth assertion)

**Done when**: all tracking endpoints implemented + tested; no route changes
beyond what the dashboard actually calls today.

## Slice 9 — Returns lifecycle

**Goal**: EcoTrack's return flow usable by the operations team.

- [ ] `askReturn(tracking)` on the adapter (`ask/for/order/return`, error 10003
      surfaced)
- [ ] `validateReturns(trackings[])` on the adapter (`valid/returns` JSON body —
      one of only two body endpoints)
- [ ] Wire via route-builder: `POST /orders/:id/ask-return` (guard: order must
      be out_for_delivery at a company; carrier may IGNORE the request — say so
      in the response message) and an admin action to confirm return reception
      (flips order to `returned` through the normal status-transition path —
      reuse whatever the existing cancel/return handlers do; read
      `status-transitions.ts` first)
- [ ] Tests: adapter + handlers, forward-only status compliance

**Done when**: ask-return + confirm-return both work and respect order
lifecycle guards.

## Slice 10 — Stop-desk enrichment

**Goal**: richer desk data without breaking the existing sync contract.

- [ ] `getDesks()` on the adapter: parse `{my_desk, other_desks}` shape
      (address, phones, map, hours)
- [ ] Decide the shape: keep `StopDesk` interface FROZEN (shared seam). Map
      desks into it (`code` needs a stable value — check what dispatch uses as
      Station Code today: `code_postal` from communes; desks endpoint lacks
      postal codes → likely keeps communes as the code authority and desks
      ENRICH address/phones only, or desks are listed but marked
      non-dispatchable if no code exists). Read the stop-desk sync handler +
      UI column expectations BEFORE choosing (never assume)
- [ ] Tests: parse both present/absent fields, null-heavy entries

**Done when**: decision documented in CONFORMANCE.md, tests green.

## Slice 11 — Status mapping + reconciliation guard

**Goal**: EcoTrack status vocabulary → CodFlow order statuses, safely.

- [ ] Write the mapping table (CONFORMANCE.md first, code second):
      activity keys (`livred`→delivered, `Return_received`→returned, …) and
      status enums (`en_livraison`→out_for_delivery, `retour_recu`→returned,
      `annule`→cancelled, `suspendu`→unreachable, …) — every unmapped value
      surfaces as raw (never guessed — webhook contract rule)
- [ ] Reconciliation consumer: uses `getOrders` (Slice 8) to compare carrier
      status vs ours, applies updates through the SAME forward-only
      transition guard used by webhooks (read `status-transitions.ts` +
      webhook-handlers.ts regression guard first; reuse, don't duplicate)
- [ ] Rate-limit aware: page through `get/orders` with the budget in mind;
      bulk `get/trackings/info` (1 call/100) preferred over per-order pulls
- [ ] Tests: every mapped value, unmapped → raw + logged, never backwards

**Done when**: a drift-repair path exists that cannot move an order backwards.

## Slice 12 — Isolation proof + production rollout

**Goal**: prove nothing leaked; ship it.

- [ ] `git diff` audit: no changes inside `providers/noest|yalidine|zr_express`
      folders; `DeliveryProvider` interface unchanged; shared files touched
      only with additive, tested changes
- [ ] Full suites: `cd cod-server && npm run typecheck && npm test` AND
      `cd cod-client-astro && npm run typecheck && npm test`
- [ ] README feature claims audit (repo rule: code-verified only)
- [ ] Update CONFORMANCE.md to final state; mark this plan complete
- [ ] Production rollout checklist (human steps):
      1. Run the seed against remote D1 (mechanism from Slice 6)
      2. Verify 82 rows landed inactive, no tokens
      3. Per courier a merchant wants: obtain token from that courier's
         dashboard → create/patch credentials via the company API →
         Test-connection (Slice 7) → stop-desk sync → test dispatch on one
         real order → label + tracking pull verified
      4. Only then flip `active: true` for that courier
- [ ] When real API keys eventually arrive: run one live smoke per HIGH-USE
      courier (create+cancel a test order), replace mock-only assertions
      where reality differs, record tenant drift in CONFORMANCE.md

**Done when**: Definition of Done checklist above is fully checked.

---

## Rules of engagement (every slice)

1. **Never assume — read first.** Open every file a slice touches before
   editing it.
2. **One slice = one coherent commit** (or a small stack). Message names the
   slice: `ecotrack(slice 6): idempotent 82-courier seed`.
3. **Green to merge**: typecheck + tests pass at the end of every slice. Red
   at the start of a slice → stop, report, do not build on red.
4. **Findings go to CONFORMANCE.md** (tenant drift, doc-vs-reality gaps,
   decisions made) — not into code comments (repo rule: no comments unless
   asked).
5. **New endpoints use the route-builder skill** and its `defineRoute()`
   pattern; scopes from `cod-shared/rbac/scopes`.
6. **No new dependencies, no schema changes** without asking first
   (AGENTS.md boundary). The 82-company rollout needs NEITHER.
7. **No secrets, ever.** Testing is mock-only until real tokens arrive, and
   real tokens go in `wrangler secrets` / `.dev.vars` only.
8. **Sibling providers are canaries.** If noest/yalidine/zr_express tests
   change behavior (not just move), the slice has a leak — fix before
   proceeding.

## Current status

| Slice | Status |
|---|---|
| 0 Baseline & guard rails | DONE ✅ |
| 1 Mock EcoTrack server | DONE ✅ |
| 2 Adapter characterization tests | DONE ✅ |
| 3 Error handling | DONE ✅ |
| 4 Discrepancy fixes | DONE ✅ |
| 5 Tenant catalog | DONE ✅ |
| 6 Seed script | DONE ✅ |
| 7 Test-connection + territory | DONE ✅ |
| 8 Tracking completeness | DONE ✅ |
| 9 Returns lifecycle | DONE ✅ |
| 10 Stop-desk enrichment | DONE ✅ |
| 11 Status mapping + reconciliation | DONE ✅ |
| 12 Isolation proof + rollout | DONE ✅ |

**Dashboard note (2026-09-01)**: the main dashboard is
`cod-client-astro` — all dashboard-side EcoTrack work (carrier API adapters,
tests, UI) happens there. Slice 12 wired the four new server endpoints
(test-connection, reconcile-orders, ask-return, confirm-return-reception) into
its `features/delivery/api.ts` + `features/orders/api.ts` with seam tests.
