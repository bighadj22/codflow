# ZR Express — Conformance & Live-Audit Report

**Date:** 2026-09-10 · **Environment tested:** Production tenant (fresh sandbox created the same day; credentials held in `/tmp` only).
**Method:** Read every ZR-related file in `cod-server`, diff it against the official
swagger (`.agents/skills/zr-express/swagger.json`), then exercise the **live API**
(`https://api.zrexpress.app/api/v1`) with the endpoints and exact request bodies the
adapter sends. Credentials were held in `/tmp` only and are **not** part of this report.

> This report only documents findings. **No code was changed, nothing was committed.**

---

## TL;DR — is ZR Express "done for all"?

**No. The happy-path single home-delivery flow works, but three flows are silently
broken, geo-naming fails outright for 9/58 wilayas (16%) with 10 more resolving only
via a fragile fallback, and stop-desk (pickup-point) dispatch cannot work as
implemented.**

| Area | Verdict |
|---|---|
| Auth headers (`X-Api-Key` + `X-Tenant`) | ✅ Correct |
| Create customer / single home parcel / bulk | ✅ Correct (bulk = 207) |
| GET parcel by id / by tracking number | ✅ Both work |
| Update amount / update customer | ✅ Works |
| Update delivery address | ❌ Street-only body **400**; UI still reports success |
| Get state-history | ❌ Uses tracking number → **404**; only parcel UUID works |
| Delete parcel | ❌ POST on DELETE-only endpoint → **405**; documented DELETE works |
| Label generation + PDF proxy | ✅ Works (SAS URL) |
| Stop-desk / pickup-point dispatch | ❌ Territory UUID as `hubId` → **404 HubNotFound** |
| `getStopDesks` | ⚠️ Capped territory list, no hub linkage |
| Webhook registration / secret / delete | ✅ Works |
| Webhook status mapping | ❌ Defaults don't match real state names (slugs) |
| Webhook event subscription | ⚠️ Only `parcel.state.updated` subscribed |
| Wilaya geo resolution | ❌ 9/58 fail; 10 more rely on fragile fallback |
| Commune geo resolution | ⚠️ Accent failures + silent wrong-commune fallback |

---

## 1. What is RIGHT (live-verified)

| # | Claim | Evidence |
|---|---|---|
| 1 | `X-Api-Key` + `X-Tenant` authenticate | `GET /users/profile` → 200 |
| 2 | `POST /customers/individual` returns `{ id }` | 200 |
| 3 | `POST /parcels` returns `{ id }`; `stockType:"none"` accepted | 200; echoes `productsStockType:"none"` |
| 4 | Tracking number only from `GET /parcels/{id}` | format `16-AJXL7ORFOL-ZR` |
| 5 | `GET /parcels/{trackingNumber}` works | 200 |
| 6 | `PATCH /parcels/{id}/amount` `{parcelId, amount}` | 200 |
| 7 | `PATCH /parcels/{id}/customer` `{parcelId, name, phone}` | 200 |
| 8 | `POST /parcels/bulk` → `successes`/`failures` with 0-based index | 207 |
| 9 | Label `POST /parcels/labels/individual/pdf` → SAS `fileUrl`; fetching → `application/pdf` | 200/200, `%PDF-1.4`, 122 KB, ~65-min expiry |
| 10 | Webhook create `{id: ep_…}` + secret `{secret: whsec_…}` + delete | 200 / 200 / 200 |
| 11 | `DELETE /parcels/bulk/by-tracking-number` | 200 `successCount:1` |
| 12 | `POST /workflows/search` exposes full state vocabulary | 200, 23 states |

---

## 2. What is WRONG (live-verified, with file references)

### BUG-1 · `getTrackingInfo` always 404s → tracking returns `[]`
`adapter.ts` calls `GET /api/v1/parcels/{trackingNumber}/state-history`.
Live: tracking number → **404** (only the parcel UUID works; swagger path param is
`{parcelId}`). The `catch` swallows it and returns `[]`, so `GET /orders/:id/tracking`
silently shows *no events* for every ZR order. Fix: resolve the UUID via
`GET /parcels/{trackingNumber}`, then call `state-history` with the UUID (verified 200).

### BUG-2 · `deleteShipment` uses POST → always 405
`adapter.ts` posts to `DELETE /api/v1/parcels/bulk/by-tracking-number` (wrong method).
Live: **POST → 405**, documented **DELETE → 200** (deleted). `capabilities.ts`
(`canDelete*: false`) is a symptom of this bug, not an API limitation. `cancelShipment`
also ignores the returned boolean and resets the order to `ready` even when the parcel
still exists at the carrier — **silent DB/carrier desync**.

### BUG-3 · Address update always 400s and failure is swallowed
`adapter.ts` sends only `{ street }` in `deliveryAddress`. Live: **400**
`CityTerritoryId is required` / `DistrictTerritoryId is required`. Sending street +
`cityTerritoryId` + `districtTerritoryId` → **200**. `updateShipment` catches the error
and returns `false`; `updateShipmentInfo` ignores the return value and still replies
"Shipment updated successfully". The dashboard advertises address editing for ZR.

### BUG-4 · Stop-desk dispatch impossible — territory UUID used as `hubId`
`adapter.ts` sets `hubId = districtId`, and for stop-desk that is the **pickup-point
territory UUID** (`getStopDesks` → `code: t.id`). Live: `POST /parcels` with a territory
id as `hubId` → **404 `HubErrors.HubNotFound`**. With a **real hub id**
(e.g. `614e28bd…` "Hub Baraki 16") → **200**. ZR has 96 hubs (`POST /hubs/search`,
`isPickupPoint`, each with `address.districtTerritoryId`). The whole stop-desk
contract (`CONTEXT.md:40` "territory UUID for ZR Express") and the dashboard sync feed
the wrong identifier into parcel creation.

### BUG-5 · Status-mapper defaults don't match ZR's real state names
`zr-status-mapper.ts` defaults (`"out for delivery"`, `"in transit"`, `"at hub"`) don't
exist in the tenant's workflow. The **real default workflow** uses French slugs:
`commande_recue`, `en_traitement`, `appel_confirmation`, `commande_confirmee`,
`en_preparation`, `pret_a_expedier`, `confirme_au_bureau`, `confirme_chez_partenaire`,
`dispatch`, `vers_wilaya`, `en_livraison`, `livre`, `encaisse`, `recouvert`, … .
Real parcel state observed live: `state.name = "commande_recue"` (slug),
`state.description = "Commande reçue"`. `delivered`/`returned`/`cancelled` can't map by
default, so terminal ZR events record as `unmapped` unless admins configure the mapping
with the actual slug names. Only `parcel.isReturn.updated` (hardcoded) reliably produces
`returned` — see BUG-6.

### BUG-6 · Webhook registration subscribes to only one event type
`registerZrWebhook` sends `eventTypes: ["parcel.state.updated"]`, but the handler also
reacts to `parcel.isReturn.updated` (→ returned) and `parcel.state.situation.created`.
Existing ZR endpoints in the tenant list register **all three**. If ZR filters by
`eventTypes`, return signals never arrive. Needs confirmation via a live transition,
but the registration should subscribe to all three event types the handler understands.

### BUG-7 · Bulk failures collapse multiple errors per parcel
`createShipmentsBulk` builds `failureByBulkIdx` as a `Map(index → failure)`; a live call
produced **two errors for the same index** (`Name is required` + `Description is
required`) and only the last survives. Cosmetic today; keep all messages.

### GEO-1 · Wilaya resolution fails for 9/58 wilayas
Reproduced `resolveCityId` for all 58 wilayas against the live API:
- **37/58** resolve on the first (name) search.
- **10/58** only via the code-string fallback (e.g. `Sétif` → ZR uses `Setif`).
- **9/58 fail outright**: `Béjaïa`, `Béchar`, `Tébessa`, `Saïda`, `Aïn Témouchent`
  (ZR strips accents: `Bejaia`, `Bechar`, `Tebessa`, `Saida`, `Ain Temouchent`), and
  `Illizi` (33), `Tindouf` (37), `Bordj Badji Mokhtar` (50), `Djanet` (56) — **ZR has no
  wilaya-level territory for these at all** (0 results even accent-free). Parcel
  creation **throws** for these wilayas.
- The code-string fallback is pagination-fragile: keyword `"16"` returns 112 hits but
  **no wilaya in the first page** → Alger depends on the name path.

### GEO-2 · Commune resolution shares the accent problem + silent wrong-commune fallback
`resolveDistrictId` searches by commune name. Live: `"Bir Mourad Raïs"` → **0 results**
(ZR: `Bir Mourad Rais`); the fallback `items.find(parentId!=null) ?? items[0]` can pick
an **unrelated commune**. `"Sidi Bel Abbes"` (no accent) returned no commune row.

### MINOR
- `VALID_OUR_STATUSES` omits `confirmed`, `unreachable`, `ready`, `dispatched` — the
  ZR mapping UI can't map to `unreachable` though call-failure situations exist in the
  default workflow.
- No `zr-status-mapper.test.ts` exists (the yalidine mapper has one).
- `getStopDesks` caps at `pageSize:200` of 1573 pickup-capable territories and includes
  non-stop-desk rows; the stop-desk UI depends on it (see BUG-4).

---

## 3. Live-test evidence summary

| Call | Method/Path | Result |
|---|---|---|
| profile | `GET /users/profile` | 200 |
| territories | `POST /territories/search` (Alger, 16, Alger Centre, pickup) | 200 |
| customers | `POST /customers/individual` | 200 |
| parcel | `POST /parcels` (home, `stockType:none`) | 200 |
| parcel fetch | `GET /parcels/{id}` | 200 (trackingNumber, state slug) |
| parcel fetch | `GET /parcels/{trackingNumber}` | 200 |
| state history | `GET /parcels/{trackingNumber}/state-history` | **404** |
| state history | `GET /parcels/{uuid}/state-history` | 200 |
| update amount | `PATCH /parcels/{id}/amount` | 200 |
| update customer | `PATCH /parcels/{id}/customer` | 200 |
| update address | `PATCH /parcels/{id}/deliveryAddress` (street only) | **400** |
| update address | `PATCH …` (street + city + district) | 200 |
| label | `POST /parcels/labels/individual/pdf` | 200 + PDF fetch 200 |
| delete | `DELETE /parcels/bulk/by-tracking-number` | 200 (deleted) |
| delete | `POST /parcels/bulk/by-tracking-number` (adapter's method) | **405** |
| bulk | `POST /parcels/bulk` | 207 (multi-error per index confirmed) |
| pickup | `POST /parcels` (`pickup-point`, no hubId) | **400** `HubId is required` |
| pickup | `POST /parcels` (with real hub id) | 200 |
| hubs | `POST /hubs/search` | 200, 96 hubs, `isPickupPoint` + `address` |
| workflows | `POST /workflows/search` | 200, 23 states (slug vocabulary) |
| webhooks | `POST /webhooks/endpoints` + `GET …/{id}/secret` + `DELETE …/{id}` | 200 / 200 (`whsec_…`) / 200 |

---

## 4. What must be fixed next (proposed order)

1. **BUG-4 (stop-desk / hubId) + `getStopDesks` redesign** — resolve the real hub for
   the pickup point (hubs carry `address.districtTerritoryId`); send the hub id as
   `hubId` and the hub's district territory in `deliveryAddress`. Until this lands, ZR
   stop-desk dispatch 404s.
2. **BUG-2 (delete)** — switch `deleteShipment` to `DELETE`; flip `canDelete*` in
   `capabilities.ts`; make `cancelShipment` surface failure instead of silently
   resetting the order.
3. **BUG-1 (state-history)** — resolve the parcel UUID from the tracking number first;
   stop swallowing the error.
4. **BUG-3 (address update)** — send the full `deliveryAddress` (+ `hubId` where
   needed); check the return value in `updateShipmentInfo`.
5. **GEO-1 / GEO-2 (geo naming)** — the EcoTrack/Yalidine pattern: seed
   `carrier_wilayas` / `carrier_communes` for `zr_express` with ZR's canonical names
   (accent-free: `MSila`, `El Meghaier`, `Setif`, `Ain Temouchent`, …), resolve before
   dispatch, and normalize accents in `searchTerritories`. Surface the 4 wilayas ZR does
   not serve (33/37/50/56) as a supported-region limitation.
6. **BUG-5 + BUG-6 (webhook states)** — seed the mapper defaults with the real
   default-workflow slugs (or match `description`); subscribe to all three event types;
   allow `unreachable` in `VALID_OUR_STATUSES`; add a `zr-status-mapper.test.ts` like
   the yalidine one.
7. **BUG-7** — keep all bulk error messages per index (minor).

---

## 5. Unverified / needs the ZR dashboard
- Actual webhook delivery payload for `parcel.state.updated` (slug vs description) —
  requires a real carrier state transition.
- Whether `parcel.isReturn.updated` / `parcel.state.situation.created` are delivered
  when only `parcel.state.updated` is subscribed.

---

*Evidence captured under `/tmp/zrexpress/live/*.json` (key never written to the repo;
re-run the audit harnesses with a fresh key to reproduce).*