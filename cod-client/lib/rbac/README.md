# Frontend RBAC Implementation

This directory contains the frontend implementation of the Role-Based Access Control (RBAC) system.

## Overview

The frontend RBAC system provides server-side permission checking and client components for controlling UI element visibility based on assigned scopes.

## Files

- `permissions.ts` - Client-side permission utilities
- `../components/rbac/ProtectedRoute.tsx` - Server component for page-level protection
- `../components/rbac/ProtectedAction.tsx` - Client component for UI element protection
- `../../lib/auth.ts` - Server-side auth utilities with permission checking

## Server-Side Permission Checking

### getUserScopes()

Get the current user's scopes (server-side).

```tsx
import { getUserScopes } from "@/lib/auth";

export default async function OrdersPage() {
  const userScopes = await getUserScopes();
  
  return <OrdersView userScopes={userScopes} />;
}
```

### hasPermission(scope)

Check if user has a specific permission (server-side).

```tsx
import { hasPermission } from "@/lib/auth";

export default async function OrdersPage() {
  const canCreate = await hasPermission(SCOPES.ORDERS_CREATE);
  
  return (
    <div>
      {canCreate && <CreateOrderButton />}
    </div>
  );
}
```

### requirePermission(scope)

Require user to have permission, redirect to 403 if not (server-side).

```tsx
import { requirePermission } from "@/lib/auth";
import { SCOPES } from "../../cod-shared/rbac/scopes";

export default async function OrdersPage() {
  // Will redirect to /403 if user doesn't have permission
  await requirePermission(SCOPES.ORDERS_READ);
  
  return <div>Orders content...</div>;
}
```

## Protected Components

### ProtectedRoute (Server Component)

Protect entire pages based on required scopes.

```tsx
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../cod-shared/rbac/scopes";

export default async function OrdersPage() {
  return (
    <ProtectedRoute requiredScope={SCOPES.ORDERS_READ}>
      <div>Orders content...</div>
    </ProtectedRoute>
  );
}
```

### ProtectedAction (Client Component)

Control UI element visibility based on required scopes.

```tsx
"use client";

import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "../../cod-shared/rbac/scopes";

interface OrdersViewProps {
  userScopes: string[];
}

export function OrdersView({ userScopes }: OrdersViewProps) {
  return (
    <div>
      <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.ORDERS_CREATE}>
        <Button>Create Order</Button>
      </ProtectedAction>
      
      <ProtectedAction 
        userScopes={userScopes}
        requireAny={[SCOPES.ORDERS_UPDATE, SCOPES.ORDERS_DELETE]}
      >
        <Button>Manage</Button>
      </ProtectedAction>
      
      <ProtectedAction 
        userScopes={userScopes}
        requiredScope={SCOPES.ORDERS_DELETE}
        fallback={<span className="text-muted-foreground">No permission</span>}
      >
        <Button variant="destructive">Delete</Button>
      </ProtectedAction>
    </div>
  );
}
```

## Authentication Integration

The RBAC system integrates with Better Auth and reads permissions from the database.

### How It Works

1. **User Authentication**: User logs in via Better Auth
2. **Database Lookup**: Frontend uses the authenticated user's ID to query the database
3. **Role Check**: Gets user role from `users` table
4. **Scope Loading**: Gets user scopes from `user_scopes` table
5. **Permission Evaluation**: Admin users get wildcard `["*"]`, staff users get their explicit scopes

### Database as Source of Truth

User permissions are stored in the database, not in auth tokens:

- **users table**: Contains user role (`admin` or `staff`)
- **user_scopes table**: Contains scope assignments for staff users
- Admin users don't need entries in user_scopes (wildcard access)

### Managing User Scopes

Use the Users Management API to assign/revoke scopes (admin only):

```bash
# Grant a single scope to a user
POST /api/users/:id/scopes
{ "scope": "orders:read" }

# Revoke a scope from a user
DELETE /api/users/:id/scopes/:scope
```

Changes take effect immediately on the next page load.

## Usage Pattern

### Server Component (Page)

```tsx
// app/(dashboard)/orders/page.tsx
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../cod-shared/rbac/scopes";
import { OrdersView } from "@/components/orders/orders-view";

export default async function OrdersPage() {
  // Get user scopes on server
  const userScopes = await getUserScopes();
  
  return (
    <ProtectedRoute requiredScope={SCOPES.ORDERS_READ}>
      <OrdersView userScopes={userScopes} />
    </ProtectedRoute>
  );
}
```

### Client Component (UI)

```tsx
// components/orders/orders-view.tsx
"use client";

import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "../../cod-shared/rbac/scopes";

interface OrdersViewProps {
  userScopes: string[];
}

export function OrdersView({ userScopes }: OrdersViewProps) {
  return (
    <div>
      <h1>Orders</h1>
      
      <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.ORDERS_CREATE}>
        <Button>Create Order</Button>
      </ProtectedAction>
      
      {/* Rest of UI */}
    </div>
  );
}
```

## How It Works

1. **Authentication**: User logs in via Better Auth
2. **Permission Loading**: The user's role comes from the session; staff scopes are loaded from the `user_scopes` table
3. **Server-Side Check**: `ProtectedRoute` checks permissions on server
4. **Props Passing**: User scopes passed to client components as props
5. **Client-Side Rendering**: `ProtectedAction` conditionally renders based on scopes

### Admin Users

- Admin users have role `"admin"` and scopes `["*"]`
- The wildcard `*` grants access to everything
- All permission checks return `true` for admin users

### Staff Users

- Staff users have role `"staff"` and explicit scope arrays
- Permission checks verify the user has the required scope
- UI elements are hidden if user lacks permission

## Security Notes

- **Server-side checks are authoritative** - Page protection happens on server
- **Client-side checks are for UX** - They hide UI elements users can't use
- **Backend always validates** - API endpoints use RBAC middleware to enforce permissions
- **Never trust frontend** - Always validate permissions on the backend

## Adding New Scopes

1. Add the scope to `shared/rbac/scopes.ts`
2. Update the scope categories if needed
3. Use the new scope in ProtectedRoute or ProtectedAction components
4. Protect the corresponding API endpoint with the scope
5. Assign the new scope to staff users (admin gets `*` automatically)

## Troubleshooting

### Permission checks always return false

- Check that user is authenticated
- Verify the user's role is `admin`, or the scope is assigned in `user_scopes`
- Check scope string matches exactly (case-sensitive)
- Verify claims are being loaded correctly

### UI elements not hiding

- Ensure userScopes prop is passed to ProtectedAction
- Check that requiredScope prop is correct
- Verify user scopes are loaded on server

### Page redirects to 403 immediately

- Check that ProtectedRoute has correct requiredScope
- Verify user has the required scope in `user_scopes`
- Check for typos in scope strings
- Ensure role is set correctly ("admin" or "staff")
