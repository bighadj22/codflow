# EcoTrack Public API Reference

Distilled from the official Postman collection (`postman_collection.json`,
"ECOTRACK API"). This is the **source of truth** for the adapter — when code
and this document disagree with memory, this document wins; when live tenant
behavior disagrees with this document, record the divergence in
`CONFORMANCE.md` and trust the live behavior.

## General

| | |
|---|---|
| Base URL | `https://{tenant}.ecotrack.dz` (one host per courier company) |
| Auth | `Authorization: Bearer {api_token}` — **except** `get/orders/status` (query param, see below) |
| Rate limit | 50 requests / minute → HTTP 429 `{"message": "Too Many Attempts."}` |
| Language | Param names are French, snake_case |

Error styles (both occur, handle both):
- **HTTP 422** — Laravel validation bag:
  `{"message": "The given data was invalid.", "errors": {"field": ["Le champ … obligatoire."]}}`
- **HTTP 200 with business failure** —
  `{"success": false, "error": <code>, "message": "…"}`

Known business error codes:

| Code | Meaning | Where |
|---|---|---|
| 10001 | Commande non modifiable (already validated / locked) | update, delete, ask-return |
| 10002 | Pas de livraison pour la wilaya sélectionnée | create |
| 10003 | Le retour ne peut pas être demandé pour cette commande | ask/for/order/return |

## Endpoint index

| # | Endpoint | Method | Purpose | Implemented in adapter |
|---|---|---|---|---|
| 1 | `/api/v1/validate/token` | GET | Check token validity | ✅ (verifyConnection) |
| 2 | `/api/v1/` | GET | (rate-limit doc endpoint) | ❌ |
| 3 | `/api/v1/create/order` | POST | Create one order (query params) | ✅ |
| 4 | `/api/v1/create/orders` | POST | Bulk create ≤100 (JSON body) | ✅ |
| 5 | `/api/v1/update/order` | POST | Modify before validation (query params) | ✅ |
| 6 | `/api/v1/delete/order` | DELETE | Delete before validation | ✅ |
| 7 | `/api/v1/valid/order` | POST | Validate + ship a parcel | ✅ |
| 8 | `/api/v1/valid/returns` | POST | Confirm reception of returned parcels (JSON body) | ✅ (validateReturns) |
| 9 | `/api/v1/get/order/label` | GET | Download PDF label | ✅ (URL construction + proxy) |
| 10 | `/api/v1/add/maj` | POST | Add remark to parcel | ✅ |
| 11 | `/api/v1/get/maj` | GET | List remarks (plain array) | ✅ |
| 12 | `/api/v1/ask/for/order/return` | POST | Request parcel return | ✅ (askReturn) |
| 13 | `/api/v1/get/tracking/info` | GET | Tracking history — one parcel | ✅ |
| 14 | `/api/v1/get/trackings/info` | GET | Tracking history — ≤100 parcels | ✅ (getTrackingsBulk) |
| 15 | `/api/v1/get/orders` | GET | List orders + statuses (paginated) | ✅ (getOrders) |
| 16 | `/api/v1/get/orders/status` | GET | Filter orders by status (≤100 trackings) | ✅ (getOrdersStatus) |
| 17 | `/api/v1/get/wilayas` | GET | Active wilayas for this tenant | ✅ (getWilayas) |
| 18 | `/api/v1/get/desks` | GET | Desk list (rich: address, phones, map, hours) | ✅ (getDesks — display only) |
| 19 | `/api/v1/get/communes` | GET | Communes / stop-desk flags | ✅ (stop-desk sync) |
| 20 | `/api/v1/get/fees` | GET | Per-wilaya tariffs (home + stopdesk) | ❌ |
| 21 | `/api/v1/get/products/list` | GET | Products + stock (paginated) | ❌ |

---

## 1. GET /api/v1/validate/token

Params: `api_token` (query).

Responses:
- `{"success": true,  "message": "VALID_TOKEN"}`
- `{"success": false, "message": "INVALID_TOKEN"}`
- `{"success": false, "message": "TOKEN_NOT_ALLOWED"}` — public API disabled for the account

Use for a "Test connection" feature. Note it takes the token as a **query
param**, not the Bearer header.

## 3. POST /api/v1/create/order

**All params go in the query string; there is no request body.**

| Param | Type / constraint | Required | Notes |
|---|---|---|---|
| `reference` | string ≤255 | no | internal reference; also the bulk-results key |
| `nom_client` | string ≤255 | **yes** | recipient full name |
| `telephone` | numeric, 9–10 digits | **yes** | |
| `telephone_2` | numeric, 9–10 digits | no | |
| `adresse` | string ≤255 | **yes** | |
| `code_postal` | numeric | no | **stop-desk station code** for stop-desk orders |
| `commune` | string ≤255 | **yes** | commune NAME, must match tenant's enabled list |
| `code_wilaya` | int 1–58 | **yes** | |
| `montant` | numeric | **yes** | COD to collect — **includes delivery fees** |
| `remarque` | string ≤255 | no | delivery notes |
| `produit` | string ≤255 | no | product name(s); comma-separated refs if `stock=1` |
| `stock` | 0 / 1 | no | prepare from stock held at courier |
| `quantite` | comma-separated | **yes if stock=1** | per-product quantities |
| `produit_a_recuperer` | string ≤255 | no | product to recover (exchange orders) |
| `boutique` | string ≤255 | no | shop name (multi-shop accounts) |
| `type` | 1–4 | **yes** | 1=Livraison, 2=Échange, 3=PICKUP, 4=Recouvrement |
| `stop_desk` | 0 / 1 | no | 0=home delivery, 1=stop desk |
| `weight` | numeric | no | |
| `fragile` | 0 / 1 | no | contents physically fragile — NOT "openable" |
| `gps_link` | string | no | customer location link |

Responses:
- `{"success": true, "tracking": "ECQFLD2103047673"}`
- `{"success": false, "error": 10002, "message": "Pas de livraison pour la wilaya sélectionnée"}`
- 422 validation bag

## 4. POST /api/v1/create/orders

JSON body, **object keyed by index string — not an array**, ≤100 orders:

```json
{ "orders": { "0": { ...create params... }, "1": { ... } } }
```

Same fields as create/order. Response `results` are **keyed by each order's
`reference` when present**, else index:

```json
{ "results": { "DEMO852": { "telephone": ["Le champ téléphone est obligatoire."] },
               "DEMO853": { "success": true, "tracking": "ECTNYH2407062554" } } }
```

Success entries: `{success: true, tracking}`. Failure entries: field-keyed
error arrays (Laravel bag per order).

## 5. POST /api/v1/update/order

Query params. Officially everything except `tracking` is optional. Param names
DIFFER from create: `client`, `tel`, `tel2`, `product` (vs `nom_client`,
`telephone`, `telephone_2`, `produit`).

Params: `tracking` (**required**), `reference`, `client`, `tel`, `tel2`,
`adresse`, `code_postal`, `commune`, `wilaya` (int 1–58), `montant`,
`remarque`, `product`, `boutique`, `type` (1–4), `stop_desk` (0/1), `fragile`
(0/1), `gps_link`.

Responses:
- `{"success": true, "message": "Commande modifiée avec succès"}`
- `{"success": false, "error": 10001, "message": "Commande non modifiable"}`
- 422 bag (e.g. invalid tracking)

⚠️ Only meaningful **before validation**. Some tenants (Packers) return
`success: true` on validated orders but silently ignore the change. Tenant
quirk (Packers): rejects calls missing `type, wilaya, commune, adresse,
montant, tel` despite docs saying all optional.

## 6. DELETE /api/v1/delete/order

Params: `tracking` (**required**). Pre-validation only.

Responses:
- `{"success": true, "message": "Commande supprimée"}`
- `{"success": false, "error": 10001, "message": "Commande non modifiable"}`

(Legacy shape `{"delete": "success"|"fail"}` has also been observed — accept both.)

## 7. POST /api/v1/valid/order

Params: `tracking` (**required**), `ask_collection` (int 0/1 — 1 = request
courier pickup at your location).

Locks the order: no further update or delete.

Response: `{"success": true, "message": "Commande expedier avec succès"}`

## 8. POST /api/v1/valid/returns

JSON body (one of the only two body endpoints):

```json
{ "trackings": ["ECO-123456", "ECO-789012"] }
```

Sender confirms physical reception of returned parcels. Responses:
- `{"returned": "success"}` — ok
- `{"returned": "fail"}` — nothing eligible (already received / not transferred)
- 422 bag (`trackings` required / invalid)

## 9. GET /api/v1/get/order/label

Params: `tracking` (**required**). Returns **raw PDF bytes** (not a URL
redirect). Requires Bearer auth — the URL is never publicly printable.

## 10. POST /api/v1/add/maj

Params: `tracking` (**required**), `content` (string ≤255, **required**).

Works any time after dispatch (before or after validation). Visible to both
carrier and sender.

Response: `{"success": true, "message": "Mise a jour avec success"}`

## 11. GET /api/v1/get/maj

Params: `tracking` (**required**). Response is a **plain JSON array**:

```json
[ { "remarque": "Test Shop : TEST MAJ", "station": "", "livreur": "",
    "created_at": "2021-03-05 11:04:19", "tracking": "ECQFLD2103047673" } ]
```

`remarque` is prefixed with the sender name (`"Name : content"`). Carrier-side
entries fill `station` / `livreur` and may be Arabic.

## 12. POST /api/v1/ask/for/order/return

Params: `tracking` (**required**). Only while the parcel is in delivery;
the courier MAY ignore the request.

Responses:
- `{"success": true, "message": "Retour demandé avec succès"}`
- `{"success": false, "error": 10003, "message": "Le retour ne peut pas etre demandé pour cette commande"}`

## 13. GET /api/v1/get/tracking/info

Params: `tracking` (**required**).

Response — object, NOT wrapped in `data`:

```json
{ "recipientName": "client", "shippedBy": "Test Shop",
  "originCity": 16, "destLocationCity": 16, "currentStation": "Médéa",
  "activity": [ { "date": "2021-03-04", "time": "22:32:47",
                  "status": "order_information_received_by_carrier",
                  "station": "", "scanLocation": "HUB" } ],
  "reasons": [] }
```

`activity[].status` values (official + observed):

| Key | Meaning |
|---|---|
| `order_information_received_by_carrier` | order registered & validated by seller |
| `notification_on_order` | a remark (maj) was added — NOT in official docs |
| `picked` | picked up by carrier |
| `accepted_by_carrier` | received at sorting hub/station |
| `dispatched_to_driver` | dispatched to delivery driver |
| `attempt_delivery` | delivery attempt |
| `return_asked` | return initiated by hub/station |
| `return_in_transit` | return in transit |
| `Return_received` | return received by seller (capital R — as documented) |
| `livred` | delivered |
| `encaissed` | cash collected |
| `payed` | payment made to seller |

## 14. GET /api/v1/get/trackings/info

Params: `trackings[]` array, ≤100 trackings. Same activity keys as above, plus
a per-parcel `status` in **French display wording** (drifts per tenant):

'Prêt à expédier', 'Prêt à préparer', 'En ramassage', 'Stock en préparation',
'Vers hub', 'En hub', 'Vers wilaya', 'En préparation', 'En livraison',
'Suspendus', 'Retours chez livreur', 'Retours en traitement', 'Retours prêts',
'Retours reçu', 'Retours à dispatcher vers stock', 'Retours en transit stock',
'Retours en stock', 'Livre non encaissé', 'Livre encaissé non payé',
'Paiement prêt', 'Paiement archivé', 'Retours archivé'

## 15. GET /api/v1/get/orders

Params: `page` (int), `start_date` / `end_date` (Y-m-d, filter by order
creation date), `tracking` (single order lookup).

Laravel pagination, **40 orders/page**, default window = last 90 days,
archived orders excluded. Each row:

```json
{ "tracking": "ECG4SU2112195902", "reference": "REF123", "client": "kas",
  "phone": "0560351041", "phone_2": null, "adresse": "Alger",
  "commune": "Ain Taya", "wilaya_id": 16, "montant": "500",
  "tarif_prestation": "400", "tarif_retour": "200", "type_id": 1,
  "created_at": "2021-12-19", "payment_id": 312, "return_id": null,
  "status": "prete_a_expedier", "products": "Prod 1" }
```

`status` here uses the enum keys (below), not the French display wording.

## 16. GET /api/v1/get/orders/status

⚠️ **Auth exception: `api_token` is a QUERY PARAM.** Params: `api_token`
(required), `trackings` (comma-separated, ≤100), `status` (comma-separated
filter values, required).

Status enum values (match the sender dashboard menu):

`prete_a_expedier`, `en_ramassage`, `en_preparation_stock`, `vers_hub`,
`en_hub`, `vers_wilaya`, `en_preparation`, `en_livraison`, `suspendu`,
`livre_non_encaisse`, `encaisse_non_paye`, `paiements_prets`,
`paye_et_archive`, `retour_chez_livreur`, `retour_transit_entrepot`,
`retour_en_traitement`, `retour_recu`, `retour_archive`, `annule`, `all`

Response `data` keyed by tracking; entries include `status`, `order_id`,
optional desk fields (`desk_phone`, `desk_commune`, `desk_map_link`,
`desk_address`), optional `driver_phone`, and an `activity` array whose entries
carry `reason`, `details`, `station`, `driver`, `date`, `time`,
`postponed_to`.

## 17. GET /api/v1/get/wilayas

Plain array: `[{"wilaya_id": 1, "wilaya_name": "Adrar"}, …]` — **only wilayas
this tenant actually delivers to** (note: e.g. 12 may be absent). Use before
dispatch to avoid error 10002.

## 18. GET /api/v1/get/desks

```json
{ "my_desk": { "hub_id": 6, "hub_name": "Station Batna",
    "location": { "wilaya": "Batna", "commune": "Batna", "adresse": "…",
                  "phone": "…", "phone2": "…", "email": "…", "map": "https://…" },
    "working_hours": [ {"days": "…", "hours": "09:00 - 17:00"} ] },
  "other_desks": [ { "name": "Station Adrar", "phone": "…", "phone2": null,
    "code_wilaya": "1", "wilaya": "Adrar", "commune": "Adrar",
    "adresse": "…", "map": null } ] }
```

Richer than communes-based stop-desk sync (address, phones, map links, hours).

## 19. GET /api/v1/get/communes

Params: `wilaya_id` (optional, 1–58 — pass it to slice the payload).

Response — **object keyed by index string, NOT an array**:

```json
{ "0": { "nom": "Abadla", "wilaya_id": 8, "code_postal": "817", "has_stop_desk": 0 }, … }
```

`has_stop_desk === 1` marks communes that are stop desks; `code_postal` is the
station code for stop-desk orders.

## 20. GET /api/v1/get/fees

Per-wilaya tariffs for YOUR account, per service: livraison (home / stopdesk),
pickup, échange, recouvrement, retour — each `{wilaya_id, tarif,
tarif_stopdesk}`. Only active wilayas returned. String amounts in centimes
(e.g. `"1300"`).

## 21. GET /api/v1/get/products/list

`{ "products": [ { "reference", "barcode", "title", "is_active", "image",
"stock_disponible", "stock_reserve", "stock_phisique" } ], "pagination": {…} }`
— 15/page. Relevant to `stock=1` / `quantite` order creation.
