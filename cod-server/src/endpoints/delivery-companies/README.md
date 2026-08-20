# Delivery Companies & Provider Integration

A modular system for integrating with third-party Algerian delivery companies (Yalidine, ZR Express, NOEST, EcoTrack, etc.) through a unified adapter interface.

## Structure

```
delivery-companies/
├── routes.ts           # API routes for company management
├── handlers.ts         # Handlers for CRUD and dispatch
├── queries.ts          # DB operations for company records
├── validation.ts       # Zod schemas for company config
├── providers/          # Adapter implementations
│   ├── types.ts        # Shared DeliveryProvider interface
│   ├── registry.ts     # Provider instantiation logic
│   ├── shipments.ts    # DB operations for tracking numbers & API logs
│   ├── noest/          # NOEST (Create + Validate flow)
│   ├── zr_express/     # ZR Express (Territory UUID-based)
│   ├── yalidine/       # Yalidine (Token + API ID)
│   └── ecotrack/       # EcoTrack-based (Packers, etc.)
└── README.md           # This file
```

## Architecture: The Provider Pattern

The system uses an **Adapter Pattern** to abstract the differences between various delivery APIs into a single, predictable interface.

### 1. The Shared Interface (`DeliveryProvider`)
Located in `providers/types.ts`, every adapter must implement:
- `createShipment(input)`: Creates a parcel and returns a tracking number.
- `validateShipment(trackingNumber)`: For providers requiring an explicit "confirm" step (e.g., NOEST).
- `getStopDesks()`: Fetches the list of pickup points for "Stop-Desk" delivery.

Pricing is **not** fetched from providers. Customer-facing rates are defined entirely in the internal `shipping_profiles` / `shipping_rules` / `shipping_rule_communes` tables.

### 2. The Registry (`registry.ts`)
The `getProvider(company)` function acts as a factory. It reads the company's `code` (e.g., `zr_express`) and returns the specialized adapter initialized with the correct credentials (`apiToken`, `apiUserGuid`, etc.).

## Supported Providers

| Provider | Code | Auth Requirements | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **ZR Express** | `zr_express` | Token + Tenant ID | UUID-based territories. Auto-validates. |
| **Yalidine** | `yalidine` | Token + API ID | Highly stable. Requires `from_wilaya` config in notes. |
| **NOEST** | `noest` | Token + User GUID | Requires separate `validateShipment` call to go live. |
| **EcoTrack** | `ecotrack` | Token + Base URL | Generic adapter for EcoTrack-powered companies (e.g., Packers). |

## Key Workflows

### 1. Dispatching an Order
When an order is dispatched (via `POST /api/orders/:id/dispatch`):
1. The **Registry** instantiates the correct adapter.
2. `createShipment` is called with customer info and destination IDs.
3. A tracking number is returned and stored in the `orders` table.
4. A permanent record is created in `company_shipments`.
5. Every outbound request and response is logged in `company_api_logs` for audit.

### 2. Stop-Desk (Pickup Point) Handling
For "Stop-Desk" deliveries, the system uses `getStopDesks()` to populate the available pickup points for a given wilaya, ensuring that the `stationCode` passed to the API is valid for that specific provider.

## Configuration & Credentials

Credentials are stored in the `delivery_companies` table:
- `apiToken`: Usually the main API Key or Secret.
- `apiUserGuid`: Used as `X-API-ID` (Yalidine), `X-Tenant` (ZR Express), or `api_user_guid` (NOEST).
- `apiEndpoint`: The base URL for the API (critical for EcoTrack adapters).
- `notes`: A JSON field used for provider-specific config (e.g., `{ "from_wilaya_name": "Alger" }` for Yalidine).

## Extending the System

To add a new delivery company:
1. Create a new folder in `providers/` (e.g., `providers/my_company/`).
2. Implement the `DeliveryProvider` interface in `adapter.ts`.
3. Register the new code in `providers/registry.ts`.
4. Add the company record to the database with the matching `code`.
