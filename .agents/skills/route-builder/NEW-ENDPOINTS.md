# Creating New Endpoints

All new endpoints use `defineRoute()`. No exceptions. Do not use raw `createRoute()`.

## File Structure

```
cod-server/src/endpoints/my-resource/
├── handlers.ts        # Route handlers (thin, delegate to queries)
├── handlers.test.ts   # Tests
├── queries.ts         # D1 database queries (via Drizzle)
├── validation.ts      # Zod schemas for request input
└── routes.ts          # defineRoute() definitions + router export
```

No prototype phase needed for new endpoints — write `routes.ts` directly with `defineRoute()`.

## Step-by-step

### 1. `validation.ts` — input schemas

```typescript
import { z } from "@hono/zod-openapi";

export const myResourceFiltersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "inactive"]).optional(),
});

export const createMyResourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
```

### 2. `handlers.ts` — thin handlers

```typescript
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { NotFoundError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import * as queries from "./queries";

export async function list(c: Context<AppContext>) {
  const { limit, offset } = c.req.valid("query");
  const items = await queries.list({ limit, offset, storeId: c.get("storeId") });
  return c.json({ success: true, data: items, count: items.length });
}

export async function getById(c: Context<AppContext>) {
  const { id } = c.req.valid("param");
  const item = await queries.getById(id, c.get("storeId"));
  if (!item) throw new NotFoundError("Not found", ERROR_CODES.NOT_FOUND);
  return c.json({ success: true, data: item });
}

export async function create(c: Context<AppContext>) {
  const body = c.req.valid("json");
  const item = await queries.create({ ...body, storeId: c.get("storeId") });
  return c.json({ success: true, data: { id: item.id }, message: "Created" }, 201);
}

export async function remove(c: Context<AppContext>) {
  const { id } = c.req.valid("param");
  await queries.remove(id, c.get("storeId"));
  return c.json({ success: true, message: "Deleted" });
}
```

### 3. Add response schema to `@/openapi/schemas`

If your resource has a response shape that gets reused, add it to the right domain file under `src/openapi/schemas/` and re-export it from `src/openapi/schemas.ts`.

```typescript
// src/openapi/schemas/my-domain.ts
export const MyResourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("MyResource");
```

```typescript
// src/openapi/schemas.ts — add to the barrel
export { MyResourceSchema } from "./schemas/my-domain";
```

### 4. `routes.ts` — defineRoute definitions

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import { myResourceFiltersSchema, createMyResourceSchema } from "./validation";
import {
  MyResourceSchema,
  ListResponseSchema,
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  IdParamSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends import("zod").ZodType>(s: T) => ({ "application/json": { schema: s } });

const listRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.MY_RESOURCE_READ },
  tags: ["MyResource"],
  summary: "List resources",
  operationId: "listMyResources",
  query: myResourceFiltersSchema,
  responses: {
    200: {
      description: "List of resources",
      content: jsonContent(ListResponseSchema(MyResourceSchema)),
    },
  },
  handler: handlers.list,
});

const getRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.MY_RESOURCE_READ },
  tags: ["MyResource"],
  summary: "Get resource",
  operationId: "getMyResource",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Resource detail",
      content: jsonContent(SuccessResponseSchema(MyResourceSchema)),
    },
  },
  handler: handlers.getById,
});

const createRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.MY_RESOURCE_CREATE },
  tags: ["MyResource"],
  summary: "Create resource",
  operationId: "createMyResource",
  body: createMyResourceSchema,
  responses: {
    201: {
      description: "Created",
      content: jsonContent(SuccessWithMessageSchema(MyResourceSchema)),
    },
  },
  handler: handlers.create,
});

const deleteRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.MY_RESOURCE_DELETE },
  tags: ["MyResource"],
  summary: "Delete resource",
  operationId: "deleteMyResource",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Deleted",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: handlers.remove,
});

const router = new OpenAPIHono<AppContext>();
router.openapi(listRoute.route, listRoute.handler);
router.openapi(createRoute.route, createRoute.handler);
router.openapi(getRoute.route, getRoute.handler);   // /{id} routes after specifics
router.openapi(deleteRoute.route, deleteRoute.handler);

export default router;
```

### 5. Register in `src/index.ts`

```typescript
import myResourceRoutes from "@/endpoints/my-resource/routes";
app.route("/api/my-resource", myResourceRoutes);
```

### 6. Add SCOPES if needed

```typescript
// cod-shared/rbac/scopes.ts
export const SCOPES = {
  // ...existing
  MY_RESOURCE_READ: "my_resource:read",
  MY_RESOURCE_CREATE: "my_resource:create",
  MY_RESOURCE_UPDATE: "my_resource:update",
  MY_RESOURCE_DELETE: "my_resource:delete",
} as const;
```

## Verification

```bash
cd cod-server && npm run typecheck && npm test
```

Both must pass before you're done.

## Patterns for common cases

### Bulk operation (register before `/{id}`)
```typescript
// Register order matters!
router.openapi(listRoute.route, listRoute.handler);
router.openapi(bulkRoute.route, bulkRoute.handler);  // /bulk before /{id}
router.openapi(getRoute.route, getRoute.handler);     // /{id} last
```

### Custom validation hook
```typescript
const myHook = (result: { success: boolean }, c: Context<AppContext>) => {
  if (result.success) return;
  throw new ValidationError("...", ERROR_CODES.INVALID_FORMAT, { id: c.req.param("id") });
};

const route = defineRoute({ ..., validationHook: myHook, handler: handlers.get });
router.openapi(route.route, route.handler, route.validationHook);
```

### Store (public) endpoint
```typescript
auth: "store"
// Uses X-Store-API-Key, security: [{ StoreAuth: [] }]
```
