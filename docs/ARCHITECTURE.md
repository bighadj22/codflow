# CodFlow Architecture

System map and technical design.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Global Edge                        │
│                                                                  │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │ Storefront  │     │   Backend    │     │   Dashboard     │  │
│  │ (Astro 7)   │──▶  │   (Hono 4)   │ ◀── │  (Next.js 16)   │  │
│  └─────────────┘ API └───┬─────┬────┘ API └─────────────────┘  │
│                          │     │                                │
│                    /webhooks   │ CodCapiWorkflow                │
│                   carriers     └──────▶ Meta CAPI              │
│                                                                  │
│  ┌───────────────────┐  ┌────────┐  ┌──────────────────────┐  │
│  │   D1 (SQLite)     │  │R2 (CDN)│  │  Durable Objects     │  │
│  │   + KV + Workflows│  │Images  │  │  (MCP Agents)        │  │
│  └───────────────────┘  └────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Package Structure

```
codflow-os/
├── cod-shared/         # Shared schema, queries, RBAC scopes
├── cod-server/         # Backend API (Cloudflare Worker + Hono)
├── cod-client/         # Dashboard (Next.js + OpenNext)
└── cod-astro/theme01/  # Storefront (Astro SSR)
```

All packages import `cod-shared` via relative paths:
```typescript
import { schema } from "../../cod-shared/db/schema";
import { SCOPES } from "../../cod-shared/rbac/scopes";
```

---

## Tech Stack

| Package | Stack | Runtime |
| :--- | :--- | :--- |
| **cod-astro** | Astro 7, Tailwind v4 | Cloudflare Workers + Static Assets |
| **cod-server** | Hono 4, Drizzle ORM, Better Auth | Cloudflare Workers + D1 + R2 + KV |
| **cod-client** | Next.js 16, React 19, OpenNext | Cloudflare Workers |
| **cod-shared** | Drizzle schema, RBAC, errors | Source-shared (no build) |

---

## Data Flow

### Order Lifecycle

```
1. Customer submits order (storefront)
   └─▶ POST /store/orders (cod-server)
       └─▶ Insert into D1

2. Merchant confirms (dashboard)
   └─▶ PATCH /api/orders/:id
       └─▶ Update status: confirmed

3. Merchant creates shipment
   └─▶ POST /api/delivery/shipments
       └─▶ Call carrier API
       └─▶ Store tracking number

4. Carrier delivers & sends webhook
   └─▶ POST /webhooks/{carrier}
       └─▶ Verify HMAC
       └─▶ Update order: delivered
       └─▶ Trigger CodCapiWorkflow

5. Workflow fires Meta CAPI Purchase event
   └─▶ Hash customer PII
   └─▶ POST to Meta Conversions API
```

---

## Backend (cod-server)

**Framework:** Hono 4 + Zod OpenAPI  
**Database:** Drizzle ORM + D1 (SQLite)  
**Auth:** Better Auth 1.7 with JWT

### Endpoint Organization

```
cod-server/src/endpoints/
├── api/          # Merchant API (/api/*)
├── store/        # Storefront API (/store/*)
├── webhooks/     # Carrier webhooks
├── images/       # R2 image proxy
└── mcp/          # AI agent API
```

### Workflows

**CodCapiWorkflow** runs in the background when orders are delivered:
- Checks Meta 7-day attribution window
- Hashes customer PII
- Fires Meta Conversions API Purchase event
- Logs result to D1

---

## Dashboard (cod-client)

**Framework:** Next.js 16 (App Router)  
**Rendering:** Server Components + Server Actions  
**Auth:** Better Auth with httpOnly cookies

All dashboard pages call the backend API with JWT authentication. RBAC is enforced server-side in `cod-server`.

---

## Storefront (cod-astro)

**Framework:** Astro 7 (SSR mode)  
**Rendering:** Server-rendered on-demand  
**JavaScript:** Minimal — only interactive components

All data fetched from `cod-server` API. No direct D1 access.

---

## Database Schema

### Core Tables

```
users, accounts, sessions      # Auth
products, variants, offers     # Catalog
orders, order_items            # Orders
customers                      # Customer records
drivers, shipments             # Delivery
wilayas, communes, stop_desks  # 58-wilaya geography
meta_capi_events               # CAPI tracking log
audit_logs                     # Admin actions
```

---

## Authentication

**Better Auth 1.7:**
- Password-based (Argon2 hashing)
- JWT tokens (ES256 signing)
- RBAC scopes (defined in `cod-shared/rbac/scopes.ts`)

**Scope enforcement:**
```typescript
const listOrders = defineRoute({
  method: "get",
  path: "/orders",
  auth: { scope: SCOPES.ORDERS_READ },
  handler: handlers.list
});
```

---

## Carrier Integration

All carriers implement the same interface:
```typescript
interface CarrierAdapter {
  createShipment(params): Promise<ShipmentResult>;
  getTracking(trackingNumber): Promise<TrackingStatus>;
  syncStopDesks(wilayaCode?): Promise<StopDesk[]>;
}
```

**Webhooks (Yalidine, ZR Express):**
1. Verify HMAC signature
2. Update order status
3. Trigger downstream workflows

---

## MCP Agent System

AI agents connect via OAuth + WebSocket:

```
1. OAuth client credentials flow
   └─▶ POST /api/oauth/token (returns JWT with scopes)

2. Connect to MCP server
   └─▶ WebSocket: wss://api.yourdomain.com/mcp

3. Execute tools (orders, products, etc.)
   └─▶ RBAC enforced per tool
```

Each agent gets a stateful Durable Object session.

---

## Deployment

All three workers deploy to Cloudflare's global edge:
- **cod-server** → `https://api.yourdomain.com`
- **cod-client** → `https://admin.yourdomain.com`
- **cod-astro** → `https://shop.yourdomain.com`

Shared resources: D1, R2, KV (same Cloudflare account).

---

## Related Docs

- [CONFIGURATION.md](./CONFIGURATION.md) — Environment variables
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production deployment
