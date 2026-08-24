# Migrating Existing Endpoints to Route Builder

`defineRoute()` is the standard pattern. Every existing endpoint that still uses raw `createRoute()` ceremony will be migrated. This guide is the process.

## Why Migrate?

| Before (raw createRoute) | After (defineRoute) |
|--------------------------|---------------------|
| Duplicated `jsonContent`/`errorResponse` helpers per file | No helpers needed |
| Verbose `middleware: [requireScope(...)]` arrays | Clean `auth` property |
| Easy to forget `security:` | Auto-generated |
| Inconsistent between files | Consistent pattern everywhere |
| Hard to scan | One object, all intent visible |

## Migration Process

### Phase 1 — Baseline

```bash
cd cod-server && npm test -- <endpoint>
```

Note test count. All tests must pass before you touch anything.

### Phase 2 — Create `routes.prototype.ts`

Create `routes.prototype.ts` next to `routes.ts`. This is a safe side-by-side comparison — the original keeps running in production while you validate the rewrite.

```typescript
// src/endpoints/my-resource/routes.prototype.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import { filtersSchema, createSchema } from "./validation";
import { MyResourceSchema, ListResponseSchema } from "@/openapi/schemas";

const listRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.MY_RESOURCE_READ },
  tags: ["MyResource"],
  summary: "List resources",
  operationId: "listResources",
  query: filtersSchema,
  responses: {
    200: {
      description: "List of resources",
      content: { "application/json": { schema: ListResponseSchema(MyResourceSchema) }},
    },
  },
  handler: handlers.list,
});

const router = new OpenAPIHono<AppContext>();
router.openapi(listRoute.route, listRoute.handler);
export default router;
```

### Phase 3 — Validate the prototype

```bash
cd cod-server && npm run typecheck && npm test -- <endpoint>
```

All tests must still pass. The prototype test (`routes.prototype.test.ts`) compares route counts and paths against the original — if it exists, run it explicitly:

```bash
npm test -- routes.prototype.test
```

### Phase 4 — Graduate: replace `routes.ts`

Once tests pass:
1. Delete `routes.ts`
2. Rename `routes.prototype.ts` → `routes.ts`
3. Delete `routes.prototype.test.ts` (the comparison test is no longer needed once there's only one file)
4. Run full test suite: `npm run typecheck && npm test`

## Route Conversion Reference

### Before → After

**List endpoint:**
```typescript
// BEFORE
const listRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "List orders",
  operationId: "listOrders",
  request: { query: filtersSchema },
  responses: {
    200: { description: "...", content: { "application/json": { schema: ListResponseSchema(OrderSchema) }}},
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema }}},
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema }}},
  },
  security: [{ ApiKeyAuth: [] }],
});
router.openapi(listRoute, handlers.listOrders);

// AFTER
const listRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "List orders",
  operationId: "listOrders",
  query: filtersSchema,
  responses: {
    200: { description: "...", content: { "application/json": { schema: ListResponseSchema(OrderSchema) }}},
  },
  handler: handlers.listOrders,
});
router.openapi(listRoute.route, listRoute.handler);
```

**POST with custom response:**
```typescript
// AFTER
const createRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.ORDERS_CREATE },
  tags: ["Orders"],
  summary: "Create order",
  operationId: "createOrder",
  body: createOrderSchema,
  responses: {
    201: {
      description: "Order created",
      content: { "application/json": { schema: SuccessWithMessageSchema(OrderCreatedDataSchema) }},
    },
    404: { description: "Delivery company not found when companyId provided" },
  },
  handler: handlers.createOrder,
});
router.openapi(createRoute.route, createRoute.handler);
```

**With validation hook:**
```typescript
const myHook = (result: { success: boolean }, c: Context<AppContext>) => {
  if (result.success) return;
  throw new ValidationError("Invalid ID", ERROR_CODES.INVALID_FORMAT, { id: c.req.param("id") });
};

const getRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.RESOURCE_READ },
  params: z.object({ id: myIdSchema }),
  validationHook: myHook,
  handler: handlers.get,
});

// Pass the hook as 3rd arg when registering
router.openapi(getRoute.route, getRoute.handler, getRoute.validationHook);
```

## Route Registration Order

**CRITICAL:** Specific paths must come before param-based paths.

```typescript
const router = new OpenAPIHono<AppContext>();

router.openapi(listRoute.route, listRoute.handler);           // GET /
router.openapi(bulkDispatchRoute.route, bulkDispatchRoute.handler); // POST /bulk-dispatch  ← BEFORE /{id}
router.openapi(getRoute.route, getRoute.handler);             // GET /{id}
router.openapi(createRoute.route, createRoute.handler);       // POST /
router.openapi(updateRoute.route, updateRoute.handler);       // PATCH /{id}
router.openapi(deleteRoute.route, deleteRoute.handler);       // DELETE /{id}
```

## Checklist

- [ ] `npm test -- <endpoint>` passes before starting
- [ ] Create `routes.prototype.ts` using `defineRoute()`
- [ ] Import response schemas from `@/openapi/schemas` (not inline)
- [ ] Use `SCOPES` constants for all `auth`
- [ ] Route registration order: specific before param-based
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all 1007 tests)
- [ ] Delete `routes.ts`, rename prototype → `routes.ts`
- [ ] Run full typecheck + tests again
