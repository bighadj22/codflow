---
name: ecotrack
description: EcoTrack platform integration for CodFlow — one API shared by 82 Algerian couriers (DHD, Conexlog, MSM Go, Packers, World Express...). Use when connecting an EcoTrack courier, auditing or fixing the adapter, verifying behavior against the official API, handling tracking/status issues, or extending EcoTrack support.
---

# EcoTrack Integration

EcoTrack is not a courier. It is the white-label platform a large slice of
Algeria's regional couriers run on: DHD, Conexlog, MSM Go, World Express,
Packers and ~80 others each expose the SAME API on their own `*.ecotrack.dz`
domain. **One adapter, 82 companies.** The companies differ (fleet, pricing,
delivery rate); the API does not.

## Resources in this folder

| File | What it holds |
|---|---|
| `about.md` | dzship's EcoTrack guide — the 82-courier key table + per-tenant quirks |
| `postman_collection.json` | The OFFICIAL API docs (Postman export) — the source of truth |
| `API-REFERENCE.md` | Every endpoint distilled from the Postman collection |
| `CODEBASE-MAP.md` | Where our integration lives, data flow, DB shape |
| `CONFORMANCE.md` | Verified audit: implemented ✓ / missing / wrong, verification checklist |
| `PLAN.md` | The slice-by-slice rollout plan for all 82 couriers — follow it top to bottom and keep its status table current |

Read `API-REFERENCE.md` before writing any adapter code. Read `CONFORMANCE.md`
before assuming current behavior is correct. For the 82-courier rollout work,
`PLAN.md` is the operational document: pick the first slice marked NOT STARTED,
follow its checklist, verify green, mark it DONE.

## The mental model

```
delivery_companies row (code: "dhd_ecotrack", apiEndpoint: "https://dhd.ecotrack.dz", apiToken: "…")
        │
        ▼
isEcotrackCompany(code)  →  EcotrackProvider(apiToken, baseUrl)
        │
        ▼  one adapter, any *.ecotrack.dz tenant
POST /api/v1/create/order   (query params, Bearer auth)
```

- Company code MUST be `ecotrack` or end in `_ecotrack` — that suffix is what
  routes the company to this adapter (`registry.ts:32`).
- `apiEndpoint` holds the tenant base URL. There is no central EcoTrack host.
- `apiUserGuid` is unused (NOEST-only field).
- `autoValidate` defaults to **false** for the EcoTrack family — parcels wait
  as Dispatched until someone calls manual validation.

## Workflow A — Connect a new EcoTrack courier

1. Find the courier key in `about.md`'s 82-courier table (e.g. `dhd`, `conexlog`, `msmgo`).
2. Create the delivery company with:
   - `code` = `{key}_ecotrack` (or plain `ecotrack` for a generic tenant)
   - `apiEndpoint` = `https://{key}.ecotrack.dz` (the pattern; verify with the
     courier if unsure — generic fallback requires a `*.ecotrack.dz` host)
   - `apiToken` = token from that courier's dashboard (write-only; never logged)
   - `name`/`nameAr` per the courier's branding
3. Decide `autoValidate` deliberately (default false for EcoTrack family —
   manual validation keeps control of when the parcel enters courier flow).
4. Run stop-desk sync (admin action → `getStopDesks()` → `get/communes` filtered
   to `has_stop_desk === 1`, `code_postal` becomes the Station Code).
5. Verify: token check, one test dispatch, label proxy, tracking pull.

## Workflow B — Audit / verify the integration

1. Open `CONFORMANCE.md` — read the "Verified correct" and "Discrepancies" lists.
2. Diff `adapter.ts` + `types.ts` against `API-REFERENCE.md`, endpoint by endpoint.
3. Check response-shape handling for every endpoint you touch — EcoTrack shapes
   are NOT uniform (see Hard Rules #3).
4. If you changed TypeScript: `cd cod-server && npm run typecheck`.
5. If you changed behavior: `cd cod-server && npm test` — and note the EcoTrack
   adapter has NO test file (yalidine/noest/zr_express all have
   `adapter.test.ts`); when you touch the adapter, add/extend one using the same
   fetch-mock pattern.
6. Live API verification only when the user explicitly provides a sandbox tenant
   and token. Never commit credentials. `.dev.vars` only.

## Workflow C — Extend the adapter

1. Copy the exact param names / response shape from `API-REFERENCE.md` — do not
   guess, do not copy from another provider. EcoTrack uses French param names
   and three different response styles.
2. Single-order endpoints take **query params, no JSON body**. Only
   `create/orders` (bulk) and `valid/returns` take a JSON body.
3. Keep every response-shape guard defensive (`Array.isArray`, `?? []`) —
   tenants drift.
4. Register nothing in the registry unless a new company family appears —
   `*_ecotrack` codes already route here.
5. Add tests. Run typecheck + tests.

## Hard rules (traps that bite)

1. **Auth is Bearer everywhere — EXCEPT `GET /api/v1/get/orders/status`**, which
   authenticates via an `api_token` **query param**. If you send only the
   Bearer header there, you get an auth error.
2. **Rate limit: 50 requests/minute → HTTP 429** `{"message": "Too Many Attempts."}`.
   Auto-validate flows make 2 calls per order (create + valid) — a bulk dispatch
   of 25+ orders can hit the ceiling. Surface 429 distinctly; pace or back off.
3. **Response shapes are not uniform.** Memorize:
   - `get/maj` → plain JSON **array**
   - `get/tracking/info` → **object** with `activity` array
   - `get/communes` → **object keyed by index** (never assume array)
   - `get/wilayas`, `get/orders` data → plain array / paginated object
   - `get/desks` → `{ my_desk: {...}, other_desks: [...] }`
   - bulk `create/orders` results → **keyed by `reference`** when the order had
     one, else by index string
   - Single create errors → HTTP 200 with `{success: false, error: 1000x}` OR
     HTTP 422 Laravel `errors` bag. Handle BOTH.
4. **`montant` is the COD amount INCLUDING delivery fees** (official param doc).
   CodFlow currently sends `order.price` (product subtotal) at
   `dispatch.ts` createShipment call — see CONFORMANCE.md before shipping a fix;
   confirm merchant intent (delivery fee charged to customer ⇒ must be included).
5. **`type` param**: 1=Livraison, 2=Échange, 3=PICKUP, 4=Recouvrement. Our
   adapter always sends `1`. `capabilities.ts` claiming `canExchange: false`
   contradicts the official docs — all four types are allowed.
6. **Update semantics**: officially all params optional, but Packers (one
   tenant) rejects calls missing `type, wilaya, commune, adresse, montant, tel`.
   The caller must pre-fill ALL fields from the order, then apply overrides —
   the route handler already does this; keep it that way.
7. **Update after validation is a silent no-op**: EcoTrack answers
   `success: true` but ignores the change (Packers-confirmed). We guard
   client-side (status must be `dispatched`). Never trust a post-validation
   update response.
8. **Delete only works pre-validation** (error 10001 after). Post-validation,
   the only carrier-side actions are `ask/for/order/return` (courier may
   IGNORE it) and `valid/returns` (confirming received returns).
9. **Labels are raw PDF bytes behind Bearer auth** — the URL is never public.
   Always serve through `proxyShipmentLabel` (server-side fetch), never expose
   the token to the browser.
10. **No webhooks.** Tracking is pull-only: `get/tracking/info` (single) and
    `get/trackings/info` (bulk, ≤100). The `/orders/:id/tracking` endpoint is
    the only freshness source for EcoTrack orders.
11. **Status wording drifts per tenant.** Never treat French display labels as
    stable identifiers. The stable vocabulary is the `activity` enum keys and
    the status enum keys (both listed in API-REFERENCE.md). An unknown label
    must surface as-is, never be guessed into a status.
12. **Tracking queries answer list-style** — a lazy "take the first row" client
    can attach the wrong parcel's status. Always query with the exact tracking
    number and match exactly.
13. **Validation limits**: phone 9–10 digits numeric; wilaya code 1–58 integer;
    every string field max 255 chars. `commune` is a NAME (string), matched
    against the tenant's enabled commune list — a wrong/misspelled commune name
    is a 422, and a disabled wilaya returns error 10002.
14. **Bulk endpoint reliability is per-tenant**: Packers' `create/orders`
    returned HTTP 500 (server-side bug, documented in `dispatch.ts`). Verify on
    the specific tenant before relying on bulk dispatch; fall back to
    sequential single creates.
15. **The `_ecotrack` suffix is load-bearing**: adapter selection, the
    autoValidate default, and the update guard all key off
    `isEcotrackCompany(code)`. A company code without the suffix silently loses
    all three.

## What "done right" looks like

- Every param name matches `API-REFERENCE.md` exactly (French, snake_case).
- Every response parse handles the endpoint's actual shape (rule #3).
- 429 and `success:false` + error-code responses are surfaced with their codes.
- `npm run typecheck` and `npm test` pass in cod-server.
- The adapter test file covers create/validate/update/delete/remarks/tracking.
- No credentials, tokens, or tenant URLs in code or tests — only in
  `wrangler secrets` / `.dev.vars`.
