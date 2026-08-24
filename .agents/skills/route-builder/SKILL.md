---
name: route-builder
description: Build and migrate API routes using the defineRoute() pattern. Use when creating new endpoints OR migrating existing endpoints to the standard route-builder syntax.
---

# Route Builder Pattern

`defineRoute()` is the **standard pattern** for all endpoints in cod-server. Every new endpoint must use it. Every existing endpoint will be migrated to it.

Two workflows:
1. **Creating new endpoints** — see [NEW-ENDPOINTS.md](NEW-ENDPOINTS.md)
2. **Migrating existing endpoints** — see [MIGRATION.md](MIGRATION.md)

Real-world examples from the codebase: [EXAMPLES.md](EXAMPLES.md)

## Quick Reference

```typescript
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const myRoute = defineRoute({
  method: "get",           // "get" | "post" | "patch" | "delete" | "put"
  path: "/my-resource",
  auth: { scope: SCOPES.RESOURCE_READ },
  tags: ["MyTag"],
  summary: "List resources",
  operationId: "listResources",
  query: MyFiltersSchema,  // optional
  params: MyParamsSchema,  // optional
  body: MyBodySchema,      // optional
  responses: {             // optional: only when default responses are not enough
    200: { description: "...", content: { "application/json": { schema: MySchema }}},
    422: { description: "Business rule violation" },
  },
  handler: handlers.myHandler,
});

router.openapi(myRoute.route, myRoute.handler);
```

## Auth Strategies

```typescript
auth: "api-key"                            // Any authenticated dashboard user
auth: "admin"                              // Admin role only
auth: "store"                              // Store API key (X-Store-API-Key)
auth: { scope: SCOPES.ORDERS_READ }        // Specific scope (most common)
auth: { anyOf: [SCOPES.READ, SCOPES.ALL] } // Any of multiple scopes
auth: { allOf: [SCOPES.READ, SCOPES.ADMIN] } // All scopes required
```

## What `defineRoute()` generates automatically

- `middleware` — from `auth` strategy
- `security` — `ApiKeyAuth` or `StoreAuth`
- Standard error responses: 400, 401, 403, 404, 500
- `tags` — inferred from path if not provided
- `operationId` — from handler name if not provided

Override only what you need to customize via `responses: {...}`.

## Key Rules

1. **Always use SCOPES constants** — never magic strings
   - ✅ `auth: { scope: SCOPES.ORDERS_READ }`
   - ❌ `auth: { scope: "orders:read" }`

2. **Register specific paths before param paths**
   - ✅ `POST /bulk-dispatch` before `GET /{id}`
   - ✅ `GET /default/rules` before `GET /{id}`

3. **Schemas come from domain files in `@/openapi/schemas`**
   - ✅ `import { OrderListItemSchema } from "@/openapi/schemas"`
   - ❌ Inline anonymous schemas for entities that have domain schemas

4. **Always run typecheck + tests after migrating**
   ```bash
   cd cod-server && npm run typecheck && npm test
   ```

## Files

- [SKILL.md](SKILL.md) — this file
- [MIGRATION.md](MIGRATION.md) — how to migrate existing endpoints
- [NEW-ENDPOINTS.md](NEW-ENDPOINTS.md) — how to create new endpoints
- [EXAMPLES.md](EXAMPLES.md) — real examples from wilayas and orders
