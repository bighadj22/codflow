---
name: zr-express
description: ZR Express delivery platform integration for CodFlow — all 129 public API endpoints (catalog, claims, customers, orders/parcels, delivery pricing, hubs, supplier, treasury, users, webhooks), organized per domain. Use when connecting ZR Express as a delivery company, auditing or fixing the zr_express adapter in cod-server, verifying behavior against the official API, pulling tracking/state, registering webhooks, or extending ZR Express support.
---

# ZR Express Delivery Integration

ZR Express is an Algerian cash-on-delivery delivery platform
(`https://api.zrexpress.app`, dashboard `zrexpress.app`). Its REST API covers the
full supplier flow: **parcels/orders** (create, bulk, exchange, refund, labels,
state updates), **catalog** (products, stock, receipts), **customers**
(individual + company, addresses, imports), **claims**, **delivery pricing**
(rates per territory), **treasury** (payments, payment requests, balance),
**users** (profile, API keys), **hubs**, and **webhooks** (programmatic
registration).

Start at `references/` in this folder — do not guess from the raw swagger.
**Read `CONFORMANCE.md` before assuming the current adapter behavior is correct** —
it lists live-verified bugs (tracking 404, delete 405, address update 400, stop-desk
hub 404, geo naming) that the code comments below may not reflect.

## Reference files (in this skill folder)

| File | What it holds |
|---|---|
| `endpoints-index.md` | Master index — all 129 endpoints, per-domain, with auth notes |
| `CONFORMANCE.md` | **Verified audit (2026-09-10, live-tested): what works / what's broken / fix order** — read before assuming current behavior is correct |
| `references/catalog.md` | Products, stock movements, receipts, categories, catalog reports (17) |
| `references/claims.md` | Claim categories, claims, comments, workflows (11) |
| `references/customers.md` | Individual/company customers, addresses, imports/exports (15) |
| `references/orders.md` | **Parcels, pickup bags, modification requests, territories, labels, reports (50)** |
| `references/delivery-pricing.md` | Rates, service pricing, price lists (5) |
| `references/hubs.md` | Hubs (2) |
| `references/supplier.md` | Supplier profile, blocking, price-list assignments (3) |
| `references/treasury.md` | Supplier payments, payment requests, treasury reports (15) |
| `references/users.md` | Profile, API-key management (4) |
| `references/webhooks.md` | Webhook endpoint CRUD (7) |
| `schemas/*.json` | Full request/response schemas per domain (verbatim from swagger) |

Path prefix is `/api/v1/…` (`version` defaults to `1`). Read the domain
reference + its `schemas/{domain}.json` before writing adapter code.

## Codebase

- `cod-server/src/endpoints/delivery-companies/providers/zr_express/` — the adapter
  (`adapter.ts`, `types.ts`, `capabilities.ts`) implementing the
  `DeliveryProvider` interface used by `dispatch.ts`.
- `cod-server/src/endpoints/delivery-companies/providers/registry.ts` — routes
  company code `zr_express` to the adapter; `apiToken` = ZR API key,
  `apiUserGuid` = ZR **tenant Id**.
- `cod-server/src/endpoints/delivery-companies/webhook-handlers.ts` — programmatic
  webhook registration (`registerZrWebhook`) against `/api/v1/webhooks/endpoints`.
- `cod-server/src/endpoints/webhooks/zr-status-mapper.ts` — maps ZR state names
  to CodFlow statuses.

## Auth

- Headers: `X-Api-Key: {secretKey}` **+** `X-Tenant: {tenantId}`
  (the adapter uses these consistently; the swagger also lists `Bearer`).
- Every request also carries `Accept`/`Content-Type` `application/json`.

## Gotchas (verified against the live integration)

1. **No separate validation step** — ZR auto-activates parcels on creation;
   `validateShipment` is a no-op.
2. **Single create returns a parcel UUID**; the tracking number only comes back from
   `GET /parcels/{id}`. **Bulk create** (`POST /parcels/bulk`) returns the
   tracking number directly. `maxBulkCreate` = 100.
3. **Territories are UUIDs** (city + district), not `wilaya_id`/commune strings —
   resolve them via `POST /territories/search` and cache the city per wilaya.
4. **Auth is `X-Api-Key` + `X-Tenant`** — do not switch to `Authorization: Bearer`
   just because examples show it; the stored `apiToken` is an API key.
5. **State names are free text** (`data.state.name`), not a fixed enum: only
   `"Out for Delivery"`, `"In Transit"` and `"At Hub"` are documented defaults.
   Unknown names must surface as `unmapped` — never guessed into a status.
6. **Label URLs expire (~1 hour, SAS-token based)** — from create you get a
   deferred label token (CodFlow uses `DEFERRED_LABEL_MARKER`); serve labels
   server-side, never expose a signed URL to the browser.
7. **Update semantics** — `PATCH /parcels/{id}/amount`, `/customer` and
  `/deliveryAddress` apply while `canUpdateAfterValidation: true`.
8. **Delete is unreliable** (HTTP 405 in tests) — `canDeleteBeforeValidation`/
   `AfterValidation` are both false; prefer state updates/refund flows.
9. **Webhook registration is API-driven** — `POST /webhooks/endpoints` with
   `X-Api-Key` + `X-Tenant`; the registered URL is CodFlow's `/webhooks/zr_express`.
10. All IDs (parcel, customer, address, claim, etc.) are **UUIDs** — any other
    format is an error or a legacy/alias field.

## Workflow A — Connect ZR Express

1. Create the delivery company with `code: "zr_express"`, `apiToken` = ZR API key,
   `apiUserGuid` = ZR **tenant Id**.
2. Verify: token check → create a test parcel (`POST /parcels`,
   `POST /customers/individual` first) → `GET /parcels/{id}` returns the tracking
   number → `POST /parcels/labels/individual` → tracking pull
   (`GET /parcels/{id}/state-history`).
3. Register the webhook (`registerZrWebhook` → `POST /webhooks/endpoints`) and
   configure `webhook_status_mapping` for any non-default state names.

## Workflow B — Audit / fix the integration

1. Read the relevant `references/{domain}.md` + `schemas/{domain}.json`.
2. Diff `adapter.ts` / `types.ts` endpoint-by-endpoint against the reference.
3. Keep every header name, path, query param, and body field **exactly** as the
   reference spells them (the generated files are verbatim from swagger).

## Security

Never commit ZR API keys or tenant IDs. They live in `wrangler secrets` /
`.dev.vars` only (repo convention).