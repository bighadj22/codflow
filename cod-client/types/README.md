# Types Directory

This directory contains all TypeScript type definitions for the CodFlow dashboard,
organized by domain.

## 📁 Files Overview

```
types/
├── customer-group.types.ts   # Customer groups and their members
├── customer-tag.types.ts     # Customer tags and tag assignments
├── customer.types.ts         # Customer management
├── delivery.types.ts         # Delivery: wilayas, communes, companies, shipments
├── driver.types.ts           # Drivers, payments, compensation
├── order.types.ts            # Order management and tracking
├── product.types.ts          # Product catalog, variants, categories
├── shipping.types.ts         # Shipping profiles, rules, commune overrides
├── stock.types.ts            # Stock movements, alerts, adjustments
├── team.types.ts             # Team members and roles
└── index.ts                  # Central exports
```

All types are re-exported from `index.ts`:

```typescript
import type { Customer, Order, Product } from "@/types";
```

---

## 👥 customer.types.ts
- `Customer` — id, name, phone, wilaya/commune, order stats, timestamps.
- `CustomerFormState` — form state for customer creation/editing.

## 🚚 delivery.types.ts
- `Wilaya` / `Commune` — Algerian administrative entities.
- `DeliveryCompany` — third-party carrier (Yalidine, ZR Express, NOEST, EcoTrack).
- `DeliveryType` — `"home" | "stop_desk"`.
- `CompanyShipment`, `StopDesk` — carrier shipment + stop-desk entities.

## 🚗 driver.types.ts
- `Driver` — manual delivery driver with stats.
- `DriverStatus` — `"available" | "busy" | "inactive"`.
- `DriverPayment`, `DriverCompensation` — settlement records.
- `DriverPaymentType` — `"cod_remittance" | "fee_payment" | "net_settlement"`.

## 📦 order.types.ts
- `Order` — orderNumber (`ORD-YYYYMMDD-XXXX`), customer, delivery info, line items,
  status history.
- `OrderStatus` — the full lifecycle: `new | preparing | ready | assigned |
  out_for_delivery | delivered | returned | cancelled`.
- `OrderProduct` — line item, incl. `OrderProductStatus`
  (`fulfilled | partially_returned | returned`).
- `OrderType` — `"online" | "offline"`.
- `OrderFormState` — order creation form.

## 🛍️ product.types.ts
- `Product` — name, type (`PHYSICAL | DIGITAL`), status (`DRAFT | ACTIVE | ARCHIVED`),
  pricing, images, variants.
- `ProductCategory` — catalog categories.
- `ProductVariant` / `VariantOption` / `VariantOptionValue` — variant model.
- `ProductFormState` — product form + variant/option form states.

## 📬 customer-group.types.ts / customer-tag.types.ts
- `CustomerGroup`, `CustomerGroupMember`, `CustomerGroupWithMembers`, `CustomerGroupSummary`.
- `CustomerTag`, `CustomerTagAssigned`, `CustomerTagWithCustomers`, `CustomerTagSummary`.

## 📏 shipping.types.ts
- `ShippingProfile` (per-store shipping config), `ShippingRule` (wilaya-based rules),
  `CommuneOverride`, `ShippingProfileWithRules`.

## 📊 stock.types.ts
- `StockMovement` (+ `StockMovementType`), `StockAlertItem`, `StockOverview`,
  `StockHistoryResponse`, `StockAlertsResponse`, `AdjustStockInput`.

## 👨‍💼 team.types.ts
- `TeamMember` — id, name, email, role (`admin | staff`), status, timestamps.
- `TeamRole`.

---

## 🔄 Database Sync

Types mirror the schema in `cod-shared/db/schema.ts`. When the schema changes:

1. Update `cod-shared/db/schema.ts`
2. Generate the migration from `cod-server` (`npm run db:generate`)
3. Update the corresponding type file here
4. Update `index.ts` exports if a file was added/removed
5. `npm run build` in `cod-client` to type-check

## 🎯 Best Practices

1. **One domain per file** - Keep related types together
2. **Export from index** - Always re-export for convenience
3. **Use `import type`** - For type-only imports
4. **Match the schema** - Optional DB columns are `T | null`, never `?`