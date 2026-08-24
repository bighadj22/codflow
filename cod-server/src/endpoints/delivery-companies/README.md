# Delivery Companies & Carrier Integration API

The Delivery Companies module manages 3rd-party Algerian carrier integrations (Yalidine, ZR Express, NOEST, EcoTrack/Packers), API credentials, stop-desk (pickup point) syncing, and webhook receivers.

Customer shipping pricing is governed separately by [`/api/shipping-profiles`](../shipping-profiles/README.md). In-house delivery drivers are managed via [`/api/drivers`](../drivers/README.md).

---

## Directory Structure

```
src/endpoints/delivery-companies/
├── handlers.ts          # HTTP request handlers (CRUD, stop-desk sync & toggles)
├── queries.ts           # Re-exports database query helpers from cod-shared
├── routes.ts            # @hono/zod-openapi route definitions with RBAC guards
├── validation.ts        # Zod request validation & filter schemas
├── webhook-handlers.ts  # ZR Express & Yalidine webhook setup & status mapping controllers
├── providers/           # Provider abstraction & carrier adapters
│   ├── capabilities.ts  # Capability matrix, validation & feature reflection
│   ├── registry.ts      # Factory for carrier adapter instantiation
│   ├── shipments.ts     # Company shipment recording & API call audit logs
│   ├── types.ts         # Standard DeliveryProvider interface & payload types
│   ├── utils.ts         # Territory mapping and helper utilities
│   ├── ecotrack/        # EcoTrack platform adapter (Packers, TNT, etc.)
│   ├── noest/           # NOEST adapter (2-step create & validate flow)
│   ├── yalidine/        # Yalidine adapter (API ID + Token)
│   └── zr_express/      # ZR Express adapter (Svix webhooks, UUID territories)
└── README.md            # Endpoint reference documentation (this file)
```

---

## Architecture: The Provider Pattern

The system uses an **Adapter Pattern** to normalize diverse Algerian courier APIs into a single interface (`DeliveryProvider` in `providers/types.ts`).

### 1. The 4 Supported Courier Adapters

| Provider | Code | Auth Requirements | Territory System | Tracking & Webhooks | Auto-Validate Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ZR Express** | `zr_express` | `apiToken` (`X-Api-Key`) + `apiUserGuid` (`X-Tenant`) | UUID-based territories | Inbound **Svix HMAC webhooks** + on-demand tracking | `true` |
| **Yalidine** | `yalidine` | `apiToken` (`X-API-TOKEN`) + `apiUserGuid` (`X-API-ID`) | Wilaya names (e.g., `"Alger"`) | Inbound webhooks (secret stored; signature verification not yet implemented) + on-demand tracking | `true` |
| **NOEST** | `noest` | `apiToken` (`api_token`) + `apiUserGuid` (`api_user_guid`) | Wilaya IDs (1–58) | On-demand tracking pull (no inbound webhooks) | `true` |
| **EcoTrack / Packers** | `ecotrack`<br>`*_ecotrack` | `apiToken` (`token`) + `apiEndpoint` (Base URL) | Postal codes (`code_postal`) | On-demand tracking pull (no inbound webhooks) | `false` (keeps orders editable before courier lock) |

### 2. Auto-Validation & Order Lifecycle
* When an order is dispatched via `POST /api/orders/:id/dispatch`, the system calls `createShipment`.
* If `autoValidate === true`, the system immediately calls `validateShipment` (locking the order at the carrier).
* For EcoTrack carriers (e.g. Packers), `autoValidate` defaults to `false` so merchant teams can edit parcel contents post-dispatch before explicitly validating.

### 3. Stop-Desk (Pickup Point) Cache & Admin Controls
* `POST /api/delivery-companies/:id/sync-stop-desks`: Fetches all carrier pickup points, resolves wilaya IDs against the wilayas table (unknown/out-of-range IDs are stored as null), and upserts them into `company_stop_desks` via D1 `batch()` chunks.
* **Admin Active Toggle**: Merchants can disable individual pickup points that cannot be serviced (`PATCH /:id/stop-desks/:code/toggle`). The `active` status survives re-syncs — but a desk deleted by the carrier is removed on the next sync, and if it reappears it comes back active.
* `GET /api/delivery-companies/:id/stop-desks`: Reads fast from the local D1 cache without making outbound API requests.

### 4. Webhooks vs. Tracking Pull
* **Inbound Webhook Receivers** exist exclusively for **Yalidine** (`/webhooks/yalidine`) and **ZR Express** (`/webhooks/zr_express`).
  * ZR Express: Automated API registration (`POST /:id/webhook/register`) storing Svix secrets and custom state mapping (`webhookStatusMapping`).
  * Yalidine: Manual webhook URL configuration in Yalidine dashboard with secret key stored via `PATCH /:id/webhook/secret`.
* **On-Demand Tracking Pull**: NOEST and EcoTrack tracking updates are pulled on demand via `GET /api/orders/:id/tracking-events`.

### 5. Credential Sanitization
All client-facing responses strip raw `apiToken` and `apiUserGuid` secrets, returning a computed boolean `isConnected: true | false`.

---

## REST Endpoints

### 1. List Delivery Companies
Retrieve all delivery company integrations.

* **Route:** `GET /api/delivery-companies`
* **Authorization:** Requires `delivery:read` scope
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `active` | `string` (`"true"` \| `"false"`) | No | — | Filter by active status |
  | `search` | `string` | No | — | Search in company name (EN/AR) or code |
  | `limit` | `integer` | No | `50` | Max items to return (max `100`) |
  | `offset` | `integer` | No | `0` | Number of items to skip |

* **Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "comp_yalidine_01",
      "name": "Yalidine",
      "nameAr": "ياليدين",
      "code": "yalidine",
      "website": "https://yalidine.app",
      "active": true,
      "supportsHomeDelivery": true,
      "supportsStopDesk": true,
      "supportsTracking": true,
      "autoValidate": true,
      "isConnected": true,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

---

### 2. Get Delivery Company
Retrieve details for a single delivery company.

* **Route:** `GET /api/delivery-companies/:id`
* **Authorization:** Requires `delivery:read` scope
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "comp_yalidine_01",
    "name": "Yalidine",
    "nameAr": "ياليدين",
    "code": "yalidine",
    "website": "https://yalidine.app",
    "active": true,
    "supportsHomeDelivery": true,
    "supportsStopDesk": true,
    "supportsTracking": true,
    "autoValidate": true,
    "isConnected": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-20T14:30:00.000Z"
  }
}
```

---

### 3. Create Delivery Company
Create a new carrier integration.

* **Route:** `POST /api/delivery-companies`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "name": "Yalidine",
  "nameAr": "ياليدين",
  "code": "yalidine",
  "website": "https://yalidine.app",
  "active": true,
  "apiEndpoint": "https://api.yalidine.app/v1",
  "apiToken": "yal_secret_token_123",
  "apiUserGuid": "yal_api_id_456",
  "supportsHomeDelivery": true,
  "supportsStopDesk": true,
  "supportsTracking": true,
  "autoValidate": true,
  "notes": "{\"from_wilaya_name\":\"Alger\"}"
}
```
* **Response (`201 Created`):** Returns the created sanitized company record.

---

### 4. Update Delivery Company
Update carrier credentials, capabilities, or auto-validation settings.

* **Route:** `PATCH /api/delivery-companies/:id`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:** Partial update object (any create fields).
* **Response (`200 OK`):** Returns the updated sanitized company record.

---

### 5. Delete Delivery Company
Delete a carrier integration.

* **Route:** `DELETE /api/delivery-companies/:id`
* **Authorization:** Requires `delivery:manage` scope
* **Constraint:** Blocked if active (non-terminal) orders are currently assigned to this company.
* **Response (`200 OK`):** `{ "success": true }`

---

### 6. Read Cached Stop-Desks
Retrieve pickup points from local D1 storage.

* **Route:** `GET /api/delivery-companies/:id/stop-desks`
* **Authorization:** Requires `delivery:read` scope
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `wilayaId` | `integer` | No | — | Filter pickup points by wilaya ID (1–58) |
  | `activeOnly` | `string` (`"true"` \| `"false"`) | No | `"true"` | Filter by admin active flag |

* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "stopDesks": [
      {
        "id": "sd_uuid_1",
        "companyId": "comp_yalidine_01",
        "code": "1601",
        "name": "Yalidine Alger Centre",
        "commune": "Alger Centre",
        "wilayaId": 16,
        "address": "12 Rue Didouche Mourad",
        "phones": ["0550123456"],
        "active": true,
        "syncedAt": "2026-01-20T10:00:00.000Z"
      }
    ],
    "total": 1,
    "company": {
      "id": "comp_yalidine_01",
      "name": "Yalidine",
      "code": "yalidine"
    }
  }
}
```

---

### 7. Sync Stop-Desks from Carrier
Pull all active pickup points from the carrier's live API and upsert into D1.

* **Route:** `POST /api/delivery-companies/:id/sync-stop-desks`
* **Authorization:** Requires `delivery:manage` scope
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "total": 1359,
    "removed": 2,
    "syncedAt": "2026-01-20T10:00:00.000Z"
  }
}
```

---

### 8. Toggle Stop-Desk Active Status
Enable or disable a specific pickup point for the store.

* **Route:** `PATCH /api/delivery-companies/:id/stop-desks/:code/toggle`
* **Authorization:** Requires `delivery:manage` scope
* **Path Parameters:**
  * `id`: Delivery company ID
  * `code`: Stop-desk station code
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "code": "1601",
    "active": false
  }
}
```

---

### 9. Register ZR Express Webhook
Programmatically register the webhook endpoint with ZR Express.

* **Route:** `POST /api/delivery-companies/:id/webhook/register`
* **Authorization:** Requires `delivery:manage` scope
* **Response (`200 OK`):**
```json
{
  "success": true,
  "webhookUrl": "https://api.yourstore.com/webhooks/zr_express",
  "endpointId": "ep_1234567890"
}
```

---

### 10. Unregister ZR Express Webhook
Delete the registered webhook endpoint from ZR Express.

* **Route:** `DELETE /api/delivery-companies/:id/webhook/register`
* **Authorization:** Requires `delivery:manage` scope
* **Response (`200 OK`):** `{ "success": true }`

---

### 11. Save Yalidine Webhook Secret
Store the secret key configured in the Yalidine dashboard for HMAC verification.

* **Route:** `PATCH /api/delivery-companies/:id/webhook/secret`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:** `{ "secret": "your_yalidine_webhook_secret" }`
* **Response (`200 OK`):** `{ "success": true }`

---

### 12. Save ZR Express Status Mapping
Save custom mappings between ZR Express state names and CodFlow order statuses.

* **Route:** `PATCH /api/delivery-companies/:id/webhook/mapping`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "mapping": {
    "delivered": ["Livré", "Delivered"],
    "returned": ["Retourné", "Returned"],
    "out_for_delivery": ["En cours de livraison"]
  }
}
```
* **Response (`200 OK`):** `{ "success": true }`

---

## Error Handling & Error Codes

The Delivery Companies endpoint adheres to the platform's standardized JSON error envelope:

```json
{
  "error": "A delivery company with code \"yalidine\" already exists",
  "code": "DUPLICATE_ENTITY",
  "category": "BUSINESS_LOGIC",
  "context": {
    "code": "yalidine",
    "existingCompanyId": "comp_yalidine_01"
  }
}
```

### Handled Error Codes

| HTTP Status | Error Code | Category | Cause / Context |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | `VALIDATION` | Invalid payload (e.g. invalid URL, invalid status key mapping). |
| `400 Bad Request` | `MISSING_API_CREDENTIALS` | `VALIDATION` | Carrier is missing `apiToken` or `apiUserGuid` during sync/registration. |
| `400 Bad Request` | `OPERATION_NOT_SUPPORTED` | `BUSINESS_LOGIC` | Attempting carrier-specific actions on unsupported providers (e.g., ZR webhook registration on Yalidine). |
| `404 Not Found` | `NOT_FOUND` | `BUSINESS_LOGIC` | Company or stop-desk code does not exist. |
| `409 Conflict` | `DUPLICATE_ENTITY` | `BUSINESS_LOGIC` | A company with the specified `code` already exists. |
| `422 Unprocessable Entity` | `PROVIDER_NOT_SUPPORTED` | `BUSINESS_LOGIC` | Unknown carrier code with no matching adapter in `registry.ts`. |
| `502 Bad Gateway` | `EXTERNAL_API_FAILURE` | `EXTERNAL_API` | Outbound request to carrier API failed (network error, invalid API key, timeout). |
| `401 Unauthorized` | `UNAUTHENTICATED` | `AUTHENTICATION` | Missing or invalid API key / OAuth token. |
| `403 Forbidden` | — (no `code` field) | — | Missing required scope (`delivery:read` or `delivery:manage`). Scope denials come from RBAC middleware as plain JSON: `{ "error": "Insufficient permissions", "required": "<scope>" }`. |

