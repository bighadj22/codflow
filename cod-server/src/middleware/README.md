# Middleware Layer

Core Hono middleware for authentication, security, and global error handling. These components ensure consistent request processing across both the Management API and the Public Storefront API.

## Structure

```
middleware/
├── auth.ts         # Dashboard API Authentication (RBAC)
├── storeAuth.ts    # Storefront API Authentication (Secure Hash)
├── error.ts        # Global Error & Validation Handler
├── cors.ts         # CORS & Preflight Handling
└── README.md       # This file
```

## Middleware Components

### 1. Dashboard Authentication (`auth.ts`)
The primary security layer for all `/api/*` endpoints.
- **Mechanism:** Validates the `X-API-Key` header against the `users` table.
- **RBAC Integration:** Automatically loads the user's assigned scopes (or `["*"]` for admins) and injects them into the context (`c.set("user", ...)`).
- **Status Check:** Blocks access for users marked as `inactive`.

### 2. Storefront Authentication (`storeAuth.ts`)
Specialized security for the public `/store/*` endpoints.
- **Mechanism:** Validates the `X-Store-API-Key` header.
- **Security:** Uses **SHA-256 hashing** to compare the provided key against stored hashes, ensuring that raw keys are never stored in the database.
- **Context Injection:** Injects the `storeId` into the context for multi-tenant isolation.
- **Usage Tracking:** Updates `lastUsedAt` timestamps for the API key records.

### 3. Global Error Handler (`error.ts`)
Ensures that the API always returns a predictable, structured JSON response even during crashes.
- **Zod Support:** Automatically intercepts `ZodError` and formats validation failures into a detailed `details` array (path and message).
- **Generic Catch-all:** Converts unhandled exceptions into 500 Internal Server Error responses.

### 4. CORS Handler (`cors.ts`)
Manages Cross-Origin Resource Sharing to allow frontend applications (Dashboard and Storefront) to communicate with the API.
- **Headers:** Configures allowed origins, methods, and specific headers (`X-API-Key`, `X-Store-API-Key`).
- **Preflight:** Explicitly handles `OPTIONS` requests with 204 No Content responses.

## Usage in Routes

Middleware is typically applied at the router level:

```typescript
// Management API
const api = new Hono();
api.use("*", authMiddleware);

// Public Storefront API
const store = new Hono();
store.use("*", storeAuthMiddleware);
```

The error handler is registered globally in the main application entry point:
```typescript
app.onError(errorHandler);
```
