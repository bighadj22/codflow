# Route Builder - Change Log

## [Unreleased] - 2026-08-31 (2)

### ✅ Added: bodyContent for Non-JSON Bodies (images migration)

**Problem:**
- `body` only produces `application/json` content — the images upload
  route documents a `multipart/form-data` body with a binary `file` field

**Added:**

```typescript
const uploadRoute = defineRoute({
  method: "post",
  path: "/upload",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  bodyContent: {
    "multipart/form-data": {
      schema: z.object({ file: z.instanceof(File).openapi({ type: "string", format: "binary" }) }),
    },
  },
  ...
});
```

- `bodyContent` is passed through verbatim as `request.body.content` with
  `required: true`; takes precedence over `body`

---

## [Unreleased] - 2026-08-31

### ✅ Added: Public Routes and Header Schemas (webhooks migration)

**Problem:**
- `auth` was mandatory with no way to express an unauthenticated endpoint
- Webhook receivers (Yalidine, ZR Express) are public — signature-verified
  inside their handlers, no API key, no `security` block in the spec
- `defineRoute()` had no `headers` support; the ZR receiver documents its
  required `svix-*` headers via `request.headers`

**Added:**

```typescript
// 1. "public" auth strategy — no middleware, security omitted from the spec
const webhookRoute = defineRoute({
  method: "post",
  path: "/zr_express",
  auth: "public",
  headers: z.object({ "svix-id": z.string(), ... }),  // 2. new
  responses: { ... },
  handler: handlers.handleZrWebhook,
});

// 2. headers?: ZodType — passed through to request.headers
```

**Behavior details:**
- `auth: "public"` omits the `security` key entirely (NOT `security: []`) —
  matches raw `createRoute()` routes without a security block, verified by
  `serve.test.ts` asserting `post.security` is `undefined` on `/webhooks/zr_express`
- Public routes get no auto-generated 401 and never get 403
- Backward compatible — existing strategies unchanged

**Testing:**
- ✅ Typecheck passes
- ✅ Webhooks route tests pass side-by-side against old and new routers
- ✅ Full suite green (spec assertions included)

---

## [Unreleased] - 2026-08-23

### ✅ Fixed: Type Safety (Issue #1 from Code Review)

**Problem:**
- Used `any` types for `query`, `params`, `body`, and `handler`
- Lost TypeScript compile-time safety
- Could pass wrong Zod schemas without errors

**Before:**
```typescript
export interface RouteDefinition {
  query?: any;    // ❌ No type checking
  params?: any;   // ❌ No type checking
  body?: any;     // ❌ No type checking
  handler: any;   // ❌ No type checking
}
```

**After:**
```typescript
import type { ZodType } from "zod";
import type { Context } from "hono";

export interface RouteDefinition {
  query?: ZodType;                         // ✅ Must be Zod schema
  params?: ZodType;                        // ✅ Must be Zod schema
  body?: ZodType;                          // ✅ Must be Zod schema
  handler: (c: Context<AppContext>) => any; // ✅ Typed handler
}
```

**Benefits:**
- ✅ Compile-time errors if you pass non-Zod schema
- ✅ Better IDE autocomplete
- ✅ Safer refactoring
- ✅ Catches mistakes before runtime

**Testing:**
- ✅ Typecheck passes: `npm run typecheck`
- ✅ All 22 tests pass: `npm test -- wilayas`
- ✅ No behavior changes (tests prove it)

**Example Error Now Caught at Compile Time:**
```typescript
// This will now error at compile time:
defineRoute({
  method: "get",
  path: "/test",
  auth: "api-key",
  query: "not-a-schema",  // ❌ TypeScript error!
  handler: handlers.test
});

// Must use Zod schema:
defineRoute({
  method: "get",
  path: "/test",
  auth: "api-key",
  query: z.object({ id: z.string() }),  // ✅ Type safe!
  handler: handlers.test
});
```

---

## Status: MIGRATION COMPLETE ✅

**All 22 endpoint domains** now use `defineRoute()` — no raw `createRoute()`
remains in `src/endpoints/`. Status history:

- 2026-08-23: type safety fixed, route builder ready
- 2026-08-31 (PR #71): 8 domains migrated (wilayas and orders/products were
  already done); `auth: "public"` + `headers` added for webhooks
- 2026-08-31 (PR #72): remaining 11 domains migrated; `bodyContent` added
  for multipart uploads (images)

Auth strategies now in use across the codebase: `"api-key"`, `"admin"`,
`"store"`, `"public"`, and `{ scope }`. Two domains keep router-level RBAC
deliberately (activity-logs' throw-based `adminOnly`, delivery-companies'
`use()` patterns) — see their routes.ts docblocks.

The migration guide (`.agents/skills/route-builder/MIGRATION.md`) is retained
for reference; new endpoints follow NEW-ENDPOINTS.md directly.
