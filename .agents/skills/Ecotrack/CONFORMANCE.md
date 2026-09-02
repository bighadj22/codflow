# EcoTrack Conformance Audit

Code vs official Postman docs, verified 2026-09-01. Update this file whenever
the adapter changes or a live tenant diverges from the docs — note the tenant,
the date, and the observed behavior.

**Final state after the full rollout (PLAN.md Slices 0–12, 2026-09-01):**
21-of-21 endpoints integrated or deliberately deferred (products/stock list
stays out — no stock-fulfilled orders exist in the domain yet; fees stay out —
pricing belongs to shipping rules). Adapter fully characterized by tests
against the Postman contract (mock server), typed errors, 82-courier catalog +
idempotent seed, test-connection + reconciliation + returns routes, forward-only
status mapping. Suite: cod-server 78 files / 1322 tests green; cod-client-astro
33 files / 139 tests green (the MAIN dashboard — cod-client is legacy). Sibling
provider folders (noest/yalidine/zr_express) zero-diff — isolation proven.

**Deployed 2026-09-01 (wrangler only, no commit/push/PR):**
- Catalog moved to `cod-shared/lib/ecotrack-couriers.ts` (single source for
  server seed + dashboard PROVIDER_CONFIGS — the hand-written packers UI entry
  with its wrong `https://ecotrack.dz` default was replaced by the generated
  `https://packers.ecotrack.dz` entry).
- Remote D1 seeded: 83 companies (82 EcoTrack inactive/no-token + ZR Express
  untouched). Verified by direct D1 query.
- cod-server deployed: `codflow-os-server-production`
  (version a4da8a55, api.codflow.store).
- Dashboard built + deployed: `codflow-os-dashboard`
  (version d255cb72, astro-v2.codflow.store). The delivery-companies page now
  renders 85 provider cards (3 base + 82 EcoTrack); the API list endpoint
  correctly answers 401 to unauthenticated curl (auth wall verified).

## ✅ Verified correct (adapter vs docs)

| Behavior | Evidence |
|---|---|
| Bearer auth on all implemented endpoints | `adapter.ts headers()` |
| `createShipment` → `POST /api/v1/create/order`, query params, no body | `postParams()` + URLSearchParams |
| Create success/error handling incl. HTTP-200 `success:false` and 422 bag | `!res.success \|\| !res.tracking` → `flattenErrorBag` |
| `validateShipment` → `POST /api/v1/valid/order?tracking=&ask_collection=` | matches docs incl. optional pickup flag |
| `updateShipment` param RENAMES (`client`/`tel`/`tel2`/`product` vs create names) | `adapter.ts updateShipment()` |
| `deleteShipment` → `DELETE /api/v1/delete/order`, accepts both legacy `{delete}` and current `{success}` shapes | `res.delete === "fail" \|\| res.success === false` |
| `addRemark` → `POST /api/v1/add/maj?tracking=&content=` | matches docs |
| `getRemarks` handles the **plain array** response (not `{data:[]}`) | `Array.isArray(res) ? res : []` |
| `getTrackingInfo` handles the **object with `activity` array**, exposes `notification_on_order` | `res.activity ?? []` |
| `getStopDesks` handles the **index-keyed object** from `get/communes`, filters `has_stop_desk===1`, `code_postal` as Station Code | `getStopDesks()` |
| Bulk body is **object-keyed**, ≤100; results matched by `reference` with index fallback | `createShipmentsBulk()` |
| Label = Bearer-protected PDF, served via server-side proxy only | `proxyShipmentLabel` (shipment-operations.ts) |
| `canOpen` NOT mapped to `fragile` (semantically different) | explicit in adapter + types comments |
| Manual-validate default for EcoTrack family (matches "Locked at Carrier" model) | `handlers.ts autoValidate ?? !isEcotrackCompany(code)` |
| Update guard: EcoTrack orders only updatable while `status === "dispatched"` | shipment-operations.ts pre-validation guard |
| No webhooks assumed; tracking is pull-only | no receiver registration for ecotrack |
| `maxBulkCreate: 100` | capabilities.ts, matches docs |

## ❌ Not implemented (official endpoints with no adapter method)

| Endpoint | What it would power | Priority |
|---|---|---|
| ~~`GET /api/v1/get/orders`~~ | **IMPLEMENTED (Slice 8)** — `getOrders()` on the adapter; reconciliation consumer lands in Slice 11 | ~~High~~ Done |
| ~~`GET /api/v1/get/trackings/info`~~ | **IMPLEMENTED (Slice 8)** — `getTrackingsBulk()` (shape unverified, see Slice 8 findings) | ~~Medium~~ Done |
| ~~`GET /api/v1/get/orders/status`~~ | **IMPLEMENTED (Slice 8)** — `getOrdersStatus()` with query-param auth | ~~Medium~~ Done |
| `POST /api/v1/ask/for/order/return` | ~~"Ask courier to return" action~~ **IMPLEMENTED (Slice 9)** — `POST /orders/:id/ask-return`: only from out_for_delivery, request-not-state-change (carrier may ignore; order status untouched), error 10003 → 502 | ~~Medium~~ Done |
| `POST /api/v1/valid/returns` | ~~Merchant confirms received returns~~ **IMPLEMENTED (Slice 9)** — `POST /orders/:id/confirm-return-reception`: carrier confirm → order flips to `returned` via the normal status path (inventory + customer stats + history); `{returned:"fail"}` → 422 without touching the order | ~~Medium~~ Done |
| `GET /api/v1/get/wilayas` | ~~Pre-dispatch territory check~~ **IMPLEMENTED (Slice 7)** — `verifyConnection()` enriches valid checks with served wilaya ids; `getWilayas()` public on the adapter. A dispatch-time 10002-prevention warning remains future work (non-blocking only). | ~~Medium~~ Partially done |
| `GET /api/v1/get/desks` | **IMPLEMENTED (Slice 10)** — `getDesks()` typed read (address/phones/map/hours). **Decision**: display enrichment ONLY — the endpoint publishes no station codes, so dispatch's Station Code authority stays `get/communes` (code_postal); desks never feed the stop-desk sync (name-based join across sources is unreliable). `StopDesk` interface unchanged. | Low/Medium |
| `GET /api/v1/get/fees` | Carrier-side tariff display (reference only — pricing stays in shipping rules) | Low |
| `GET /api/v1/get/products/list` | Stock-fulfilled orders (`stock=1` + `quantite`) | Low (feature not built) |

## ⚠️ Discrepancies & risks (verify before relying)

**Slice 3+4 resolutions (2026-09-01)** — items below marked ~~resolved~~ are
closed; the rest remain open:

1. ~~**`montant` vs `order.price` — suspected COD under-collection.**~~
   **RESOLVED by merchant decision (2026-09-01): the carrier collects the COD
   total = `order.price + order.deliveryFee`.** Implemented for ALL providers
   at the shared dispatch flows (orders/dispatch.ts single + bulk) and the
   update-shipment default (shipment-operations.ts pre-fills COD; explicit
   `body.amount` still overrides AND is the only case that syncs price back).
   Pinned by test: dispatch asserts `createShipment({amount: 9600})` for
   price 9000 + fee 600. Note: `orders.codAmount` also holds price+fee but
   can go stale after edits, so dispatch computes from price+deliveryFee.

2. ~~**`capabilities.ts` contradicts the docs.**~~ **RESOLVED**: the flags
   describe the ADAPTER integration (not the raw carrier API). Header now
   points at adapter.test.ts as the living source; `canUpdateAfterValidation`
   set false (carrier silently ignores validated-order updates);
   `canExchange` stays false because the integration dispatches type=1 only
   (platform types 2/3/4 documented in the header for future work).

3. ~~**`updateShipment` forces `type=1`.**~~ **RESOLVED (kept + pinned)**:
   correct while every order is Livraison; pinned by test, header documents
   the invariant. Untracked `weight` param on update REMOVED (undocumented —
   official update param table has no weight) and pinned absent by test.

4. ~~**Rate limit (50 req/min) unhandled.**~~ **RESOLVED in Slice 3**:
   429 / "Too Many Attempts." throws `EcoTrackApiError` with `isRateLimit`.
   (Automatic backoff/retry remains future work — see PLAN Slice 11 note.)

5. ~~**Error codes 10001/10002/10003 not typed.**~~ **RESOLVED in Slice 3**:
   `EcoTrackApiError.errorCode` carries the business code; message prefixed
   `"EcoTrack 10001: …"` for actionable logs.

6. **Stop desks come from `get/communes` (has_stop_desk + code_postal), not
   `get/desks`.** Works, but `get/desks` publishes address/phones/map/hours
   that the communes shape lacks. Consider enriching the sync.

7. **No `adapter.test.ts` for ecotrack.** noest/yalidine/zr_express each have
   one. Any adapter change is currently verified only against the live
   carrier. Add tests (fetch-mock pattern from yalidine) before the next
   adapter edit.

8. **Tenant drift is expected.** Packers: bulk create → HTTP 500 (server bug);
   update requires "all fields" despite docs. dzship (about.md): status label
   wording drifts per tenant. Never assume one tenant's quirk is the
   platform's; record it here with the tenant name + date.

9. **`askCollection` (pickup request) is never exposed.** The provider accepts
   it; no route passes it. Manual-validation teams may want pickup requests.

10. **No inbound return signal.** With `get/orders` + `valid/returns`
    unimplemented, a returned parcel's cash flow (COD reversal) is invisible
    until someone looks at tracking events manually.

## Characterization findings (Slice 2, 2026-09-01 — 28 adapter tests, all passing)

11. **422 field-level details are dropped at the HTTP helper layer.** ~~Open~~
    **RESOLVED in Slice 3**: all failures now throw `EcoTrackApiError`
    (errors.ts); 422 messages include the flattened field bag
    (`"The given data was invalid. — nom_client: Le champ nom client est obligatoire."`).
    Business codes (10001/10002/10003) ride on `error.code`, rate limits on
    `error.isRateLimit` (HTTP 429 or "Too Many Attempts." body). The adapter's
    four duplicated HTTP helpers were collapsed into one `request()` — the
    single place error parsing lives.
12. **`updateShipment` sends `weight` — an undocumented param** for
    `update/order` (the official param table has no weight). Laravel ignores
    unknown params, so harmless, but it is a divergence from the documented
    contract. Candidate for removal in Slice 4.

## Slice 8 additions (2026-09-01)

- **Three tracking endpoints implemented adapter-level** (no routes — the
  dashboard's single-order `GET /orders/:id/tracking` is unchanged; the
  reconciliation layer in Slice 11 consumes these):
  - `getTrackingsBulk(trackings ≤100)` — repeated `trackings[]` params.
    **⚠️ Success shape UNVERIFIED** (Postman documents only a 422): the
    adapter tolerates an array of rows carrying a `tracking` field OR an
    object keyed by tracking (with/without `data` wrapper) and matches
    entries to REQUESTED trackings only — never positionally (dzship's
    "wrong parcel's status" trap is pinned by test).
  - `getOrders({page,startDate,endDate,tracking})` — Laravel pagination
    (40/page, 90-day default, archived excluded), defensive defaults.
  - `getOrdersStatus(trackings ≤100, statuses)` — **api_token QUERY-param
    auth** (pinned by test: the call carries `api_token`, not just Bearer);
    comma-separated trackings + status enum keys, defaults to `all`.

## Slice 11: EcoTrack → CodFlow status mapping (2026-09-01)

Authoritative table (code in `providers/ecotrack/status-mapping.ts` must match
exactly). **Rule: unmapped values surface as raw and are logged — never
guessed** (webhook contract rule). Reconciliation applies updates ONLY through
`updateOrderStatusWebhook` (the shared forward-only rank guard — a mapped
status can never move an order backwards; Delivered/Returned/Cancelled are
terminal).

### Status enum keys (`get/orders` rows, `get/orders/status` filter)

| EcoTrack key | Our status | Note |
|---|---|---|
| `prete_a_expedier` | `dispatched` | parcel at carrier, pre-validation |
| `prete_a_preparer` | `dispatched` | stock preparation at carrier |
| `en_preparation_stock` | `dispatched` | |
| `en_ramassage` | `dispatched` | pickup phase |
| `vers_hub` / `en_hub` / `vers_wilaya` / `en_preparation` | `dispatched` | transit — no-op once out_for_delivery (rank guard) |
| `en_livraison` | `out_for_delivery` | |
| `livre_non_encaisse` | `delivered` | |
| `encaisse_non_paye` | `delivered` | |
| `paiements_prets` | `delivered` | |
| `paye_et_archive` | `delivered` | |
| `suspendu` | `unreachable` | |
| `retour_chez_livreur` / `retour_transit_entrepot` / `retour_en_traitement` / `retour_recu` / `retour_archive` | `returned` | our "returned" = refused at door, goods back to merchant |
| `annule` | `cancelled` | |
| `all` | — | filter value, never a row status |

### Activity keys (`get/tracking/info`, `get/trackings/info`)

| EcoTrack activity | Our status |
|---|---|
| `order_information_received_by_carrier` | `dispatched` |
| `notification_on_order` | — (remark added; NOT a status) |
| `picked` | `dispatched` |
| `accepted_by_carrier` | `dispatched` |
| `dispatched_to_driver` | `out_for_delivery` |
| `attempt_delivery` | `out_for_delivery` (stays) |
| `return_asked` / `return_in_transit` / `Return_received` | `returned` |
| `livred` / `encaissed` / `payed` | `delivered` |

⚠️ `dispatched` is absent from `STATUS_RANK` in cod-shared/queries/orders.ts
(webhook guard) — its rank defaults to 0, so mapping transit keys to
`dispatched` can never regress an `out_for_delivery` order. Reconciliation
relies on this; changing STATUS_RANK requires re-checking this table.

**Reconciliation** (`providers/ecotrack/reconcile.ts` + route
`POST /delivery-companies/:id/reconcile-orders`, DELIVERY_MANAGE, EcoTrack
family only): pages `get/orders` (≤10 pages/run = ≤10 API calls, well under
the 50/min budget), maps row statuses, applies drift fixes via
`updateOrderStatusWebhook` (source `ecotrack-reconcile:{code}`), skips
unmapped rows (sampled in the response), and never touches orders whose
mapped status equals or ranks below current.

## Slice 7 additions (2026-09-01)

- **`POST /delivery-companies/:id/test-connection` shipped** (route-builder,
  DELIVERY_READ scope): provider-agnostic via the new optional
  `DeliveryProvider.verifyConnection?()` seam — only the EcoTrack adapter
  implements it today (others answer OPERATION_NOT_SUPPORTED, same pattern as
  remarks/tracking). A negative outcome (invalid token / API access disabled)
  is HTTP 200 with `ok:false` — the check succeeded. Transport failures → 502.
  Valid EcoTrack checks are enriched with `servedWilayaIds` / `servedWilayaCount`
  (best-effort — territory failure never fails the check).
- **Mock fidelity finding**: `validate/token` answers INVALID_TOKEN on HTTP
  200 for any token — the mock's generic 401 auth gate had to exempt it (an
  invalid token is a legitimate documented response there, not an auth failure).
- Status-code convention learned: `ValidationError` → 400 (no-token case,
  matching sibling sync handler), `BusinessLogicError` → 422 (unsupported
  provider), `ExternalApiError` → 502 with code `EXTERNAL_API_FAILURE`.

## Baseline findings (Slice 0, 2026-09-01)

- **Baseline green**: typecheck ✅; 70 test files / 1154 tests ✅ (before any
  EcoTrack work).
- **Seed mechanics**: `scripts/seed-local.mjs` shells out to
  `npx wrangler d1 execute` per statement (`--local --persist-to ../.wrangler-shared`
  or `--remote`), using `INSERT OR REPLACE`. ⚠️ REPLACE clobbers merchant state
  (tokens, flags) — the 82-company seed (PLAN Slice 6) must instead use
  `INSERT … ON CONFLICT(code) DO UPDATE` limited to name/nameAr/apiEndpoint.
- **Capabilities registry is dead code**: `providers/capabilities.ts`
  (`getProviderCapabilities`, `hasCapability`, `validateAdapterCapabilities`)
  has ZERO consumers in cod-server or cod-client. The per-provider capability
  flags are documentation-only today — reconciling them (PLAN Slice 4) carries
  no runtime risk, and they should be treated as machine-readable docs for
  future UI work.
- **Registry contract locked**: `providers/registry.test.ts` pins
  `isEcotrackCompany` + `getProvider` selection and credential guards for all
  four provider families (the non-EcoTrack cases double as leak canaries).

## Verification checklist (run for every EcoTrack change)

```sh
cd cod-server
npm run typecheck
npm test
# targeted, once adapter tests exist:
npm test -- ecotrack
```

- [ ] Param names match `API-REFERENCE.md` exactly (French snake_case; update uses `client`/`tel`/`product`)
- [ ] Response parse matches the endpoint's real shape (array / object / index-keyed / reference-keyed)
- [ ] Both error styles handled (HTTP 200 `success:false` + error code, HTTP 422 bag)
- [ ] No new auth assumption: Bearer everywhere except `get/orders/status`
- [ ] 429 behavior unchanged or improved (never silently swallowed)
- [ ] `isEcotrackCompany` still matches the company codes you test with
- [ ] No credentials / tenant URLs / tokens committed (`.dev.vars` only)
- [ ] README / route descriptions updated ONLY if the behavior is code-verified (repo rule)
- [ ] Tenant-specific findings recorded in this file with tenant + date
