# EcoTrack Integration — Codebase Map

Where CodFlow's EcoTrack integration lives, and how a parcel flows through it.
All paths relative to repo root. Audit date: 2026-09-01.

## Files

| File | Role |
|---|---|
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/adapter.ts` | `EcotrackProvider` — all carrier HTTP. The ONLY file that talks to `*.ecotrack.dz` |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/types.ts` | Request/response types per endpoint (documents real observed shapes) |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/capabilities.ts` | Static `ProviderCapabilities` consumed by the UI (⚠️ several flags contradict the docs — see CONFORMANCE.md) |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/errors.ts` | `EcoTrackApiError` + business-code (10001–10003) / rate-limit / 422-bag parsing — the single error-shape authority |
| `cod-shared/lib/ecotrack-couriers.ts` | 82-courier tenant catalog — the SINGLE source of truth, consumed by BOTH apps: cod-server's seed (seed-sql.ts) and cod-client-astro's PROVIDER_CONFIGS (features/delivery/types.ts) |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/seed-sql.ts` | Pure SQL builders for the idempotent 82-company upsert (no runtime imports — Node-loadable) |
| `cod-server/scripts/seed-ecotrack-companies.mjs` | Seed CLI: `node scripts/seed-ecotrack-companies.mjs [--remote\|--dry-run]` — upserts all 82, never clobbers merchant state |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/test/fixtures.ts` | Every documented Postman response as typed fixtures |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/test/mock-server.ts` | In-test HTTP double for a real `*.ecotrack.dz` tenant (stateful, auth-quirk-faithful) |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/adapter.test.ts` | Characterization suite — the living conformance source |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/catalog.test.ts` | Catalog contract tests (82, unique, routable codes) |
| `cod-server/src/endpoints/delivery-companies/providers/ecotrack/seed-sql.test.ts` | Upsert contract tests (idempotency + no-clobber clause) |
| `cod-server/src/endpoints/delivery-companies/providers/registry.ts` | `getProvider()` company→adapter factory; `isEcotrackCompany()` = code `ecotrack` OR `*_ecotrack` |
| `cod-server/src/endpoints/delivery-companies/providers/registry.test.ts` | Routing contract tests (all four provider families) |
| `cod-server/src/endpoints/delivery-companies/providers/types.ts` | Provider-agnostic `DeliveryProvider` interface, `CreateShipmentInput`, `StopDesk`, `UpdateShipmentInput` |
| `cod-server/src/endpoints/delivery-companies/providers/shipments.ts` | DB writes: `company_shipments` rows, `company_api_logs` audit trail |
| `cod-server/src/endpoints/delivery-companies/handlers.ts` | Company CRUD; EcoTrack family defaults `autoValidate=false` (line ~74) |
| `cod-server/src/endpoints/orders/dispatch.ts` | Dispatch orchestration — single, bulk, manual validation |
| `cod-server/src/endpoints/orders/shipment-operations.ts` | Update / cancel / remarks / tracking / label proxy |
| `cod-shared/db/schema.ts` | `delivery_companies`, `orders`, `company_shipments`, `company_api_logs` tables |
| `cod-client-astro/` | **The main merchant dashboard** (Astro + React islands). Carrier cards render from `PROVIDER_CONFIGS` in `src/features/delivery/types.ts` — 3 base providers + 82 EcoTrack entries GENERATED from `cod-shared/lib/ecotrack-couriers.ts` (never hand-edited; TODO noted in-file to render from DB rows later). Carrier APIs live in `src/features/delivery/api.ts` (test-connection, reconcile-orders, sync-stop-desks, webhooks) and `src/features/orders/api.ts` (dispatch, validate/update/cancel shipment, ask-return, confirm-return-reception, remarks, tracking, label) |
| `cod-client/` | LEGACY Next.js dashboard — behavior reference only until cutover; do not add EcoTrack features there |
| `cod-server/src/endpoints/delivery-companies/CONTEXT.md` | Domain language (Company Code, Auto-Validate, Locked at Carrier, Station Code…) |

**Tests**: `noest/adapter.test.ts`, `yalidine/adapter.test.ts`,
`zr_express/adapter.test.ts` exist. **`ecotrack/adapter.test.ts` does NOT** —
add one before touching the adapter; copy the fetch-mock pattern.

## Data flow — dispatch (happy path)

```
POST /orders/:id/dispatch                       (orders/dispatch.ts)
  ├─ guards: no trackingNumber yet, no driver assigned, wilaya+commune set,
  │           stop_desk ⇒ stationCode present
  ├─ getProvider(company) ⇒ EcotrackProvider(apiToken, apiEndpoint)
  ├─ provider.createShipment(input)            → POST /api/v1/create/order (query params)
  ├─ createShipmentRecord(...)                 → company_shipments row
  ├─ updateOrderTracking(orderId, tracking)    → orders.trackingNumber
  └─ if company.autoValidate (NOT default for EcoTrack):
  │     provider.validateShipment()            → POST /api/v1/valid/order
  │     status → out_for_delivery
  │   else:
  │     status → dispatched   (awaits manual validation)
POST /orders/:id/validate-shipment             (orders/dispatch.ts)
  └─ provider.validateShipment() → status → out_for_delivery
```

## Data flow — post-dispatch operations

| Operation | Endpoint | Carrier call |
|---|---|---|
| Update shipment | `PATCH /orders/:id/shipment` | `POST /api/v1/update/order` — EcoTrack guard: only while `status === "dispatched"` (client-side; carrier silently ignores post-validation updates) |
| Cancel shipment | `DELETE /orders/:id/shipment` | `DELETE /api/v1/delete/order` — clears trackingNumber, status → ready |
| Add remark | `POST /orders/:id/remarks` | `POST /api/v1/add/maj` |
| List remarks | `GET /orders/:id/remarks` | `GET /api/v1/get/maj` (plain array) |
| Tracking events | `GET /orders/:id/tracking` | `GET /api/v1/get/tracking/info` (pull-only — no webhooks) |
| Label | `GET /orders/:id/label` | `GET /api/v1/get/order/label` — **server-side fetch** (Bearer), streams PDF inline |

Bulk: `POST /orders/bulk-dispatch` → `createShipmentsBulk` →
`POST /api/v1/create/orders` (object-keyed body, results keyed by `reference`).
Per-tenant caveat: Packers has returned HTTP 500 here (server bug — see
dispatch.ts comments); sequential fallback is the safe path on that tenant.

## DB shape (what the adapter touches)

`delivery_companies` (cod-shared/db/schema.ts:323):
- `code` — **must be `ecotrack` or end in `_ecotrack`** (adapter routing, autoValidate default, update guard all key off this)
- `apiEndpoint` — tenant base URL (`https://packers.ecotrack.dz`)
- `apiToken` — Bearer token (write-only; responses expose `isConnected` only)
- `apiUserGuid` — unused for EcoTrack
- `autoValidate` — defaults **false** for EcoTrack family
- `webhookSecret` / `webhookEndpointId` / `webhookStatusMapping` — unused (no webhooks)

`orders`: `trackingNumber`, `status` (owns lifecycle), `deliveryMethod`
(driver XOR company), `stationCode` (EcoTrack = `code_postal` of the desk
commune), `weight`, `isFragile`.

`company_shipments`: trackingNumber, `validated` flag, labelUrl, rawResponse.

`company_api_logs`: every outbound carrier call, success/failure + duration —
check this table first when debugging "did we even call the carrier".

## The 82-courier model

- One adapter serves every `*.ecotrack.dz` tenant; onboarding a courier = a
  `delivery_companies` row, no code.
- Courier key table lives in `about.md` (dzship keys like `dhd`, `conexlog`,
  `msmgo`). Our code = `{key}_ecotrack`; base URL = `https://{key}.ecotrack.dz`.
- Generic fallback: code `ecotrack` + `apiEndpoint` = any `*.ecotrack.dz` host.
- Capabilities may differ per tenant in PRACTICE (e.g. Packers bulk-create 500,
  forced-update fields) even though the platform API is identical. Record
  tenant-specific findings in CONFORMANCE.md, not in platform assumptions.
