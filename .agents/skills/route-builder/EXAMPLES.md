# Route Builder — Real Examples

These are live examples from the codebase. Read the actual files for the full picture.

---

## Example 1: Wilayas — Simple read-only endpoint

**File:** `cod-server/src/endpoints/wilayas/routes.prototype.ts`

Two routes: a plain list, and one with a custom validation hook for numeric ID preprocessing.

```typescript
import { defineRoute } from "@/lib/route-builder";

// Simple list — no custom responses needed, defaults are fine
const listWilayasRoute = defineRoute({
  method: "get",
  path: "/",
  auth: "api-key",
  tags: ["Wilayas"],
  summary: "List wilayas",
  operationId: "listWilayas",
  query: wilayaFiltersSchema,
  handler: handlers.listWilayas,
});

// With custom validation hook — preprocess string → number,
// then throw the exact error clients depend on if invalid
const wilayaIdParam = z.preprocess(
  (v) => typeof v === "string" && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : v,
  z.number().int().min(1).max(58)
);

function invalidWilayaIdHook(result: { success: boolean }, c: Context<AppContext>) {
  if (result.success) return;
  throw new ValidationError(
    "Invalid wilaya ID — must be an integer between 1 and 58",
    ERROR_CODES.INVALID_FORMAT,
    { wilayaId: c.req.param("id") }
  );
}

const listCommunesRoute = defineRoute({
  method: "get",
  path: "/{id}/communes",
  auth: "api-key",
  tags: ["Wilayas"],
  summary: "List communes",
  operationId: "listCommunes",
  params: z.object({ id: wilayaIdParam }),
  validationHook: invalidWilayaIdHook,
  handler: handlers.listCommunes,
});

// Registration — pass validationHook as 3rd arg when present
const router = new OpenAPIHono<AppContext>();
router.openapi(listWilayasRoute.route, listWilayasRoute.handler);
router.openapi(listCommunesRoute.route, listCommunesRoute.handler, listCommunesRoute.validationHook);
```

---

## Example 2: Orders — Complex endpoint, 17 routes

**File:** `cod-server/src/endpoints/orders/routes.prototype.ts`

Key patterns from this file:

### List with explicit 200 response schema
```typescript
import { OrderListItemSchema, ListResponseSchema } from "@/openapi/schemas";

const listOrdersRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "List orders",
  operationId: "listOrders",
  query: orderFiltersSchema,
  responses: {
    200: {
      description: "List of orders with joins and computed fields",
      content: { "application/json": { schema: ListResponseSchema(OrderListItemSchema) }},
    },
  },
  handler: handlers.listOrders,
});
```

### POST with 201 and domain response schema
```typescript
import { OrderCreatedDataSchema, SuccessWithMessageSchema } from "@/openapi/schemas";

const createOrderRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.ORDERS_CREATE },
  tags: ["Orders"],
  summary: "Create order",
  operationId: "createOrder",
  body: createOrderSchema,
  responses: {
    201: {
      description: "Order created successfully",
      content: { "application/json": { schema: SuccessWithMessageSchema(OrderCreatedDataSchema) }},
    },
    404: { description: "Delivery company not found when companyId provided" },
  },
  handler: handlers.createOrder,
});
```

### Multiple params (nested route)
```typescript
const returnOrderProductRoute = defineRoute({
  method: "patch",
  path: "/{id}/products/{productLineId}/return",
  auth: { scope: SCOPES.ORDERS_UPDATE },
  tags: ["Orders"],
  summary: "Record a product line return",
  operationId: "returnOrderProduct",
  params: IdParamSchema.extend({
    productLineId: z.string().openapi({ description: "Order product line ID" }),
  }),
  body: returnOrderProductSchema,
  responses: {
    200: {
      description: "Return recorded",
      content: { "application/json": { schema: SuccessWithMessageSchema(ReturnProductDataSchema) }},
    },
    400: { description: "Validation error (VALIDATION_FAILED / VALUE_OUT_OF_RANGE)" },
    422: { description: "Order already in terminal state" },
  },
  handler: handlers.returnOrderProduct,
});
```

### Route registration order — bulk before /{id}
```typescript
const router = new OpenAPIHono<AppContext>();

router.openapi(listOrdersRoute.route, listOrdersRoute.handler);
router.openapi(bulkDispatchRoute.route, bulkDispatchRoute.handler); // ← BEFORE /{id}
router.openapi(getOrderRoute.route, getOrderRoute.handler);         // GET /{id}
router.openapi(createOrderRoute.route, createOrderRoute.handler);
// ... remaining /{id}/* routes
```

---

## Response Schemas — What to import

All entity and response schemas live in `@/openapi/schemas` (barrel export from `src/openapi/schemas.ts`).

```typescript
import {
  // Wrappers
  SuccessResponseSchema,      // { success: true, data: T }
  SuccessWithMessageSchema,   // { success: true, data: T, message: string }
  MessageResponseSchema,      // { success: true, message: string }
  ListResponseSchema,         // { success: true, data: T[], count: number }
  ErrorResponseSchema,        // { error, code, category, context? }
  IdParamSchema,              // z.object({ id: z.string() })

  // Domain schemas — use these, don't inline
  OrderListItemSchema,
  OrderDetailSchema,
  OrderSchema,                // alias for OrderDetailSchema
  OrderCreatedDataSchema,
  ShipmentCreatedDataSchema,
  BulkDispatchDataSchema,
  CustomerSchema,
  ProductSchema,
  DriverSchema,
  // ... all others in schemas.ts
} from "@/openapi/schemas";
```

---

## Auth Strategy Cheat Sheet

```typescript
auth: "api-key"                              // Any authenticated user, no scope check
auth: "admin"                                // Requires admin role
auth: "store"                                // X-Store-API-Key (storefront endpoints)
auth: { scope: SCOPES.ORDERS_READ }          // Single scope (most common)
auth: { anyOf: [SCOPES.READ, SCOPES.ALL] }   // Either scope works
auth: { allOf: [SCOPES.READ, SCOPES.WRITE] } // Both scopes required
```

Always import `SCOPES` from `cod-shared/rbac/scopes`. Never use magic strings.

---

## What `defineRoute()` auto-generates

These are always added and do not need to be in `responses: {}`:

| Status | When added |
|--------|-----------|
| 400 | Always |
| 401 | Always |
| 403 | Always for scoped/admin routes |
| 404 | Always |
| 500 | Always |

Only add a status to `responses` if you want to override the description or add a content schema.
