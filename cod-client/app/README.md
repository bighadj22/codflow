# App Directory

This directory contains the Next.js 16 App Router structure with all application routes and layouts.

## Structure

```
app/
├── (dashboard)/          # Dashboard routes group (shared layout)
│   ├── layout.tsx        # Dashboard layout with sidebar and navbar
│   ├── dashboard/        # Main dashboard page
│   ├── orders/           # Order management
│   ├── customers/        # Customer management (incl. groups, tags)
│   ├── products/         # Product catalog (incl. groups, offers, reviews)
│   ├── delivery/         # Delivery and drivers
│   ├── team/             # Team and permissions
│   ├── mcp/              # MCP access management
│   ├── profile/          # User profile
│   └── settings/         # Application settings
├── api/                  # API routes (Better Auth, password reset, order labels)
├── (reference)/          # Reference/demo routes (not linked)
├── sign-in/              # Sign-in
├── sign-out/             # Sign-out
├── forgot-password/      # Password reset request
├── reset-password/       # Password reset
├── consent/              # OAuth consent page
├── layout.tsx            # Root layout (theme provider, fonts)
├── page.tsx              # Landing/login page
└── globals.css           # Global styles and Tailwind
```

## Route Groups

### (dashboard)
Routes inside parentheses `(dashboard)` share a common layout but don't add a URL segment.

**Layout Features:**
- Sidebar navigation (desktop)
- Mobile bottom navigation
- Top navbar with theme toggle
- Authentication required
- User profile display

**All dashboard routes:**
- `/dashboard` - Analytics and overview
- `/orders` - Order management
- `/customers` - Customer database (incl. groups and tags)
- `/products` - Product catalog (incl. product groups, offers, reviews)
- `/delivery` - Delivery management (drivers, carriers, settlements)
- `/team` - Team members and permissions
- `/settings` - App settings (incl. MCP access)
- `/mcp` - MCP token management
- `/profile` - User profile

## API Routes

- `/api/auth/[...all]` - Better Auth handlers (sign-in, sessions, OAuth callbacks)
- `/api/auth/request-password-reset` - Password reset request
- `/api/orders/[id]/label` - Order shipping label

## Special Files

### layout.tsx (Root)
- Sets up theme provider (next-themes)
- Configures fonts (Cairo for Arabic, Inter for Latin)
- Wraps entire app with providers
- Sets HTML lang="ar" and dir="rtl"

### page.tsx (Root)
- Landing page with sign-in
- Redirects to dashboard if authenticated

### globals.css
- Tailwind CSS imports
- CSS variables for theming
- Custom scrollbar styles
- RTL-specific adjustments

## Data Fetching

All dashboard pages use Server Components that read data through the shared
query layer (`@/db` → `cod-shared`) or the server API:

```typescript
// Example: app/(dashboard)/customers/page.tsx
export default async function CustomersPage() {
  const customers = await getCustomers();

  return <CustomersView customers={customers} />;
}
```

## Authentication

All dashboard routes require authentication via `requireUser()` in the layout:

```typescript
// app/(dashboard)/layout.tsx
const user = await requireUser();
```

If not authenticated, user is redirected to login page.

## Adding New Routes

1. Create folder in `(dashboard)/` for new feature
2. Add `page.tsx` with Server Component
3. Fetch data via the shared query layer (`@/db`) or the server API
4. Pass data to client component
5. Add route to sidebar navigation

Example:
```typescript
// app/(dashboard)/reports/page.tsx
export default async function ReportsPage() {
  const reports = await getReports();

  return <ReportsView reports={reports} />;
}
```

## Best Practices

1. **Server Components by default** - Use "use client" only when needed
2. **Data fetching in pages** - Keep components pure
3. **Read via `@/db`** - Direct reads go through `cod-shared` queries, not `fetch` to the API
4. **Type safety** - Import types from `@/types`
5. **Translations** - Use translation hooks for all text
6. **Loading states** - Add loading.tsx for better UX
7. **Error handling** - Add error.tsx for error boundaries

## Related Documentation

- [Components README](../components/README.md) - UI components
- [Types README](../types/README.md) - TypeScript types
- [Lib README](../lib/README.md) - Utility functions
- [Next.js App Router](https://nextjs.org/docs/app) - Official docs
