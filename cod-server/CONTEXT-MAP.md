# CodFlow Server - Context Map

CodFlow is a cash-on-delivery (COD) e-commerce platform for Algeria. Multiple bounded contexts handle different aspects of the business.

## Contexts

Convention: one `CONTEXT.md` per endpoint folder; cross-folder terms live in the owning context below.

| Status | Context | File | Scope |
|--------|---------|------|-------|
| ✅ written | Orders | [./src/endpoints/orders/CONTEXT.md](./src/endpoints/orders/CONTEXT.md) | Order lifecycle, status transitions, COD workflow |
| ✅ written | Delivery | [./src/endpoints/delivery-companies/CONTEXT.md](./src/endpoints/delivery-companies/CONTEXT.md) | Carrier integration, shipment tracking, dispatch, stop desks, webhook status mapping |
| ✅ written | Products | [./src/endpoints/products/CONTEXT.md](./src/endpoints/products/CONTEXT.md) | Product catalog, variants, inventory counting, lifecycle & storefront exposure |
| ✅ written | Customers | [./src/endpoints/customers/CONTEXT.md](./src/endpoints/customers/CONTEXT.md) | Customer identity by phone, purchase ledger, groups & tags memberships |
| ✅ written | Payments | [./src/endpoints/driver-payments/CONTEXT.md](./src/endpoints/driver-payments/CONTEXT.md) | Driver payouts, settlement, financial records, driver ledger |
| ✅ written | Drivers | [./src/endpoints/drivers/CONTEXT.md](./src/endpoints/drivers/CONTEXT.md) | In-house workforce: identity, availability, per-wilaya pay grid, deletion guards |
| ✅ written | Shipping Profiles | [./src/endpoints/shipping-profiles/CONTEXT.md](./src/endpoints/shipping-profiles/CONTEXT.md) | Customer delivery pricing: rate cards, commune overrides, fee resolution |
| ✅ written | Wilayas | [./src/endpoints/wilayas/CONTEXT.md](./src/endpoints/wilayas/CONTEXT.md) | Algeria's 58 wilayas + communes as read-only reference geography (IDs, postal codes, bilingual names) |
| ✅ written | Offers | [./src/endpoints/offers/CONTEXT.md](./src/endpoints/offers/CONTEXT.md) | Buy X Get Y promotions: triggers, rewards, auto-application at checkout |
| ✅ written | Reviews | [./src/endpoints/reviews/CONTEXT.md](./src/endpoints/reviews/CONTEXT.md) | Moderation of order-anchored product reviews; live rating aggregates |
| ✅ written | Stock | [./src/endpoints/stock/CONTEXT.md](./src/endpoints/stock/CONTEXT.md) | Inventory ledger: movements, manual adjustments, health alerts & valuation |
| ✅ written | Variants | [./src/endpoints/variants/CONTEXT.md](./src/endpoints/variants/CONTEXT.md) | Sellable combinations of variable products: pricing, SKUs, deletion semantics (routes mounted via products/) |
| ✅ written | Analytics | [./src/endpoints/analytics/CONTEXT.md](./src/endpoints/analytics/CONTEXT.md) | Dashboard metrics: order counts per lifecycle status (read-only, dashboard:view) |
| ✅ written | Abandoned Orders | [./src/endpoints/abandoned-orders/CONTEXT.md](./src/endpoints/abandoned-orders/CONTEXT.md) | Captured half-finished checkouts: session capture, 30-min sweep, recovery stats (storefront + dashboard surfaces) |
| ✅ written | Images | [./src/endpoints/images/CONTEXT.md](./src/endpoints/images/CONTEXT.md) | R2 media pipeline: proxy & presigned uploads, immutable public serving, record linking |
| ✅ written | Activity Logs | [./src/endpoints/activity-logs/CONTEXT.md](./src/endpoints/activity-logs/CONTEXT.md) | Admin-only audit trail: who did what across every context (fire-and-forget writes) |
| ✅ written | MCP | [./src/endpoints/mcp/CONTEXT.md](./src/endpoints/mcp/CONTEXT.md) | AI-agent surface: OAuth-verified tool sessions, scope-gated registry, HITL confirmations, connection revocation |
| ✅ written | Store Settings | [./src/endpoints/stores/CONTEXT.md](./src/endpoints/stores/CONTEXT.md) | Merchant configuration: branding, theme, localization, SEO, Meta pixel (single-tenant, admin-only) |
| ✅ written | Customer Tags | [./src/endpoints/customer-tags/CONTEXT.md](./src/endpoints/customer-tags/CONTEXT.md) | Free-form customer labels: unique names, idempotent assignments, count-guarded deletion |
| ✅ written | Customer Groups | [./src/endpoints/customer-groups/CONTEXT.md](./src/endpoints/customer-groups/CONTEXT.md) | Curated customer segments: descriptions, membership counts, count-guarded deletion |
| ✅ written | Product Groups | [./src/endpoints/product-groups/CONTEXT.md](./src/endpoints/product-groups/CONTEXT.md) | Category tree for products: nesting, slugs, SEO fields, live product counts (routes call it "categories") |
| ✅ written | Users | [./src/endpoints/users/CONTEXT.md](./src/endpoints/users/CONTEXT.md) | Team management: roles, scope grants/revokes, one-time API keys (admin-role gated) |
| ✅ written | Store | [./src/endpoints/store/CONTEXT.md](./src/endpoints/store/CONTEXT.md) | Public storefront: catalog, shipping rates, COD checkout, reviews (X-Store-API-Key auth) |

All endpoint folders are now documented — no candidates remain. Future folders follow the same convention: one CONTEXT.md per folder, registered here with a ✅ row.
## Relationships

- **Orders → Delivery**: Orders are dispatched to delivery companies; tracking updates flow back
- **Orders → Products**: Orders contain product lines; inventory is decremented on order creation
- **Orders → Customers**: Each order belongs to a customer; auto-creates customer if not found
- **Orders → Payments**: Delivered orders trigger driver payment records
- **Store → Orders**: Public storefront creates orders; abandoned carts become abandoned orders
- **Delivery ↔ Orders**: Bidirectional - orders push shipments, webhooks push tracking updates
- **Orders → Drivers**: Manual delivery assigns orders to drivers; the delivered transition increments the driver ledger (delivered count, earnings, pending cash)
- **Drivers → Payments**: Settlements are recorded per driver and stamp the settled orders; deleting a driver cascades away both compensations and payment history

## Shared Concepts

- **Wilaya/Commune**: Algerian administrative divisions (58 wilayas, ~1500 communes)
- **COD Amount**: Total to collect = product price + delivery fee
- **Store**: Multi-tenant - each merchant has their own store with isolated data
