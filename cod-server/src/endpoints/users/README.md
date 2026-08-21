# Users & Team Management API

Complete API for managing system users, their roles, permissions (scopes), and API keys. Uses **Better Auth** for authentication.

## Structure

```
users/
├── routes.ts       # OpenAPIHono route definitions (validation + spec), admin-only
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle; scope-cache writes stay server-side)
├── validation.ts   # Zod validation schemas (handler-level fallback)
├── users.test.ts   # Unit tests for validation and logic
├── routes.test.ts  # Route-level integration tests (OpenAPIHono router)
├── handlers.test.ts # Integration/error-scenario tests for handlers
└── README.md       # This file
```

Routes are defined with `@hono/zod-openapi` (`createRoute`), making `routes.ts`
the single source of truth for request validation and the OpenAPI spec.
Handlers read pre-validated data via `(c.req as any).valid?.(...)` and fall
back to the Zod schemas in `validation.ts` when mounted standalone.

## Core Concepts

### 1. Identity Management (Better Auth)
This system uses **Better Auth** for authentication with credential-based login.
- **Creation:** When a user is created via this API, a secure temporary password is generated and hashed using scrypt
- **Authentication:** Users sign in with their email and password through Better Auth's credential provider
- **Password Management:** Users receive a temporary password on creation and should change it on first login
- **User ID:** A unique 32-character hex ID is generated for each user

### 2. RBAC & Scopes
- **Admin Role:** Admins have the `*` wildcard scope and can access all endpoints. Individual scope assignments are ignored for admins.
- **Staff Role:** Staff members have no permissions by default. They must be explicitly granted "scopes" (e.g., `orders:read`, `products:manage`) to perform actions.
- **API Keys:** Every user is issued a secure API key (`cod_` prefix) upon creation. This key can be used for system-to-system integrations.

## API Endpoints

### GET /api/users
List all team members with their assigned scopes and status.

**Authorization:** Requires `settings:team` scope

**Query Parameters:**
- `role` - Filter by role (`admin`, `staff`)
- `status` - Filter by status (`active`, `inactive`)
- `search` - Search by name or email
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

### POST /api/users
Provision a new team member. 
- Creates the user account with a secure temporary password
- Generates and returns a one-time API key
- Assigns initial scopes

**Authorization:** **Admin only**

**Request Body:**
```json
{
  "email": "staff@example.com",
  "name": "Ahmed Benali",
  "role": "staff",
  "scopes": ["orders:read", "customers:read"]
}
```

**Response includes:**
- `tempPassword`: Temporary password for first login (returned once)
- `apiKey`: API key for programmatic access (returned once)

### PATCH /api/users/:id
Update user metadata (name, email, status).

**Authorization:** Requires `settings:team` scope

### PATCH /api/users/:id/role
Dedicated endpoint to change a user's role. Changing a user to `admin` effectively grants them all permissions.

**Authorization:** Requires `settings:team` scope

### POST /api/users/:id/scopes
Grant a specific permission scope to a user.

**Authorization:** Requires `settings:team` scope

**Request Body:**
```json
{
  "scope": "products:manage"
}
```

### DELETE /api/users/:id/scopes/:scope
Revoke a permission scope from a user.

**Authorization:** Requires `settings:team` scope

### POST /api/users/:id/api-key/rotate
Generate a new secure API key for the user, invalidating the old one. The new raw key is returned only once.

**Authorization:** **Admin only**

## Implementation Details

- **User Creation:** Creation involves generating a secure temporary password, hashing it with scrypt, creating the user record in D1, and inserting a credential account entry for Better Auth
- **Scope Caching:** Permissions are cached to ensure low-latency authorization. Modifying a user's role or scopes automatically clears their cache entry
- **Audit Logging:** Every management action (creation, role change, scope grant/revoke, key rotation) is logged in the activity logs with the actor's details
- **Security:** 
  - Passwords are hashed using scrypt with the same parameters as Better Auth
  - API keys are never stored in plain text (where applicable) and are returned only in "one-time" responses (creation or rotation)
  - Temporary passwords are generated securely and should be changed on first login
