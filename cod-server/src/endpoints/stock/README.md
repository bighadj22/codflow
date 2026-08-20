# Stock Management API

A comprehensive system for tracking inventory levels, logging stock movements, and monitoring warehouse health.

## Structure

```
stock/
├── routes.ts       # Global overview and product-nested routes
├── handlers.ts     # Handlers for adjustments and history
├── queries.ts      # Logic for inventory math and aggregation
├── validation.ts   # Zod schemas for adjustments and filters
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## Core Concepts

### 1. Inventory Model
Stock is tracked at the SKU level:
- **Simple Products:** Inventory is stored directly on the `products` table.
- **Variant Products:** Inventory is stored on the `product_variants` table.
- **Automation:** Stock is automatically deducted on order creation and restored on cancellation/return.

### 2. Stock Movements
Every change to inventory is logged in the `stock_movements` table.
- **Types:** `PURCHASE`, `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, `ORDER_DEDUCTED`, `ORDER_CANCELLED`, `ORDER_RETURNED`, `OFFLINE_SALE`.
- **Audit Trail:** Each log records `qtyBefore`, `qtyAfter`, and the `actor` (user) who performed the change.

### 3. Stock Health (Alerts)
The system monitors "Low Stock" based on a configurable `lowStockThreshold` per product/variant.

## API Endpoints

### GET /api/stock/overview
Returns a high-level summary of warehouse health.
- **Metrics:** Total SKUs, out-of-stock count, low-stock count, and total inventory value (DZD).
- **Segments:** Arrays of specific items that are out-of-stock or low-stock.

### GET /api/stock/alerts
Paginated list of all items currently requiring attention (at or below threshold).

### POST /api/products/:id/stock/adjust
Adjust stock for a simple product.
- **Request:** `{ "type": "PURCHASE", "delta": 50, "reason": "Restock from supplier" }`
- **Validation:** Prevents adjustments that would result in negative inventory.

### GET /api/products/:id/stock/history
Retrieve the full audit trail of movements for a specific product. Can be filtered by `variantId`.

## Implementation Details

- **Atomic Adjustments:** Inventory updates and movement logging are performed sequentially to ensure the audit trail always matches the current state.
- **Hierarchical Support:** The `getStockOverview` logic automatically navigates the product/variant relationship to provide a unified health report.
- **Value Calculation:** Aggregates `inventory * price` across the entire catalog to provide real-time asset valuation.
- **RBAC:** Requires `products:read` for monitoring and `products:manage` for performing adjustments.
