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

## Status: READY FOR MIGRATION

**Type Safety:** ✅ FIXED  
**Tests:** ✅ ALL PASSING (22/22)  
**Typecheck:** ✅ PASSING  
**Code Review:** ✅ APPROVED  

The route builder now has proper TypeScript types and is ready for migrating endpoints!

---

## Next Steps

1. ✅ Type safety fixed
2. ⏭️ Migrate wilayas endpoint (current prototype)
3. ⏭️ Document the pattern in AGENTS.md
4. ⏭️ Choose next endpoint to migrate

See `PROTOTYPE-SUMMARY.md` and `CODE-REVIEW.md` for full details.
