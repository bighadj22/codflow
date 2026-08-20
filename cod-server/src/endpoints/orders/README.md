# Orders Management API

Complete API for managing orders, status history, and inventory-linked transactions.

## Structure

```
orders/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
├── orders.test.ts  # Unit and integration tests
└── README.md       # This file
```

## API Endpoints

### GET /api/orders
List all orders with comprehensive filtering and pagination.

**Authorization:** Requires `orders:read` scope

**Query Parameters:**
- `status` - Filter by status (`new`, `preparing`, `ready`, `assigned`, `out_for_delivery`, `delivered`, `returned`, `cancelled`)
- `wilayaId` - Filter by wilaya ID (1-58)
- `search` - Search by order number, customer name, or phone
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderNumber": "ORD-20260327-0042",
      "status": "new",
      "customerName": "Ahmed Benali",
      "price": 5000,
      "wilaya": "الجزائر",
      "commune": "الجزائر الوسطى",
      "createdAt": "2024-11-27T10:00:00Z"
    }
  ],
  "count": 10
}
```

### GET /api/orders/:id
Get a single order with its full products list, status history, and assigned driver/company details.

**Authorization:** Requires `orders:read` scope

### POST /api/orders
Create a new order. 
- **Auto-Customer Creation:** If the provided `customerId` is not found, a new customer record is automatically created.
- **Inventory Management:** Automatically deducts stock from products/variants that have `trackInventory` enabled.
- **Stock Movements:** Logs `ORDER_DEDUCTED` movements for audit trails.

**Authorization:** Requires `orders:create` scope

**Request Body:**
```json
{
  "customerId": "uuid",
  "customerName": "Ahmed Benali",
  "phone": "0555123456",
  "wilayaId": 16,
  "communeId": "uuid",
  "price": 5000,
  "orderType": "online",
  "deliveryType": "home",
  "deliveryFee": 500,
  "products": [
    {
      "productId": "uuid",
      "productName": "Product Name",
      "variantId": "uuid",
      "variantLabel": "Red / XL",
      "quantity": 1,
      "pricePerUnit": 5000,
      "lineTotal": 5000
    }
  ]
}
```

### PATCH /api/orders/:id/status
Update the status of an order. 
- **Side Effect (delivered):** Updates driver earnings and delivery statistics.
- **Side Effect (cancelled/returned):** Restores inventory and logs `ORDER_CANCELLED` or `ORDER_RETURNED` stock movements.

**Authorization:** Requires `orders:update` scope

**Valid Statuses:**
`new`, `preparing`, `ready`, `assigned`, `out_for_delivery`, `delivered`, `returned`, `cancelled`

### PATCH /api/orders/:id/assign-driver
Assign a driver for manual delivery. 
- Automatically sets the status to `assigned` if it was in a pre-assignment state.
- Automatically calculates the `driverFee` from `driver_compensations` for the (driverId, order.wilayaId) pair (0 when no row exists).
- **Constraint:** Blocked if the order is already dispatched to a delivery company.

**Authorization:** Requires `orders:assign` scope

### POST /api/orders/:id/dispatch
Dispatch the order to a third-party delivery company API (NOEST, Yalidine, ZR Express, etc.).
- Creates a shipment record and retrieves a tracking number.
- Updates the order's `trackingNumber` and `deliveryMethod`.
- **Constraint:** Blocked if a manual driver is already assigned.

**Authorization:** Requires `delivery:dispatch` scope

### DELETE /api/orders/:id
Soft-delete an order by transitioning it to the `cancelled` status. This triggers an inventory restore.

**Authorization:** Requires `orders:delete` scope

## Features & Implementation

- **Transactional Consistency:** Critical operations like stock deduction and status updates are handled sequentially to ensure data integrity.
- **Stock Tracking:** Integrated with the stock management system; every change in order status that affects inventory is logged in `stock_movements`.
- **Delivery Providers:** Support for multiple Algerian delivery providers via a unified adapter pattern.
- **Reference Table Integration:** Automatically resolves and returns Arabic names for Wilayas and Communes in API responses.
- **RBAC:** Granular control over reading, creating, updating status, assigning drivers, and dispatching.
