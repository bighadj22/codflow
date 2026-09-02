# CodFlow Dashboard (LEGACY)

> ⚠️ **This package is LEGACY and slated for removal.**
>
> The merchant dashboard now lives in **[`cod-client-astro/`](../cod-client-astro/)**
> (Astro 7 — prerendered static app + auth worker). All new dashboard work goes
> there; do not add features, fix bugs, or deploy this package for new
> installations. It is kept in the tree only as a historical behavior reference
> and will be deleted in a future release.
>
> Everything below documents the legacy implementation as it was.

CodFlow's admin dashboard for Algerian e-commerce businesses — orders, customers, products, drivers, delivery-carrier integration, and MCP agent access. Built with Next.js 16, OpenNext on Cloudflare Workers, and D1.

## Reads vs writes

- **Reads** → server actions in `actions/*.ts` read D1 directly via `cod-shared/queries/*`. Pattern:
  ```ts
  await requirePermission(SCOPES.X_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllX(db, filters);
  ```
- **Writes** → still POST/PATCH/DELETE to the cod-server REST API via `apiClient`. Writes rely on server-side error classes and cache invalidation.
- **Exceptions (reads that stay on apiClient):**
  - `fetchCompanyStopDesks` (`delivery-companies.ts`) — carrier stop-desk lookup
  - `getShipmentTracking` (`orders.ts`) — carrier tracking events
  - `getPixelConfig` (`stores.ts`) — Meta Pixel config (admin settings)

No new `apiClient.get` calls may be added to `actions/*.ts` outside these three.

## 🚀 Quick Start

```bash
# Install dependencies (at the repo root — npm workspaces)
npm ci

# Copy environment file (fill in BETTER_AUTH_SECRET — see below)
cp .dev.vars.example .dev.vars

# Run development server
npm run dev

# Build for production
opennextjs-cloudflare build
```

**Note:** The client connects to the server backend using the `NEXT_PUBLIC_WORKER_URL` environment variable. Make sure the server is running and the environment variable is set correctly.

### Prerequisites

1. **Server Setup:** The client requires the CodFlow server to be running
   ```bash
   cd ../cod-server
   npm run db:setup:local  # Migrate + seed demo store data
   npm run dev            # Start server on port 8787
   ```

2. **Admin User:** Seed an admin account to sign in to the dashboard (email/password sign-up is enabled, but the first account defaults to role `staff`):
   ```bash
   cd ../cod-client
   ADMIN_EMAIL=you@example.com ADMIN_NAME=You node scripts/seed-admin.mjs
   ```
   The script prints the generated password and API key — save them, they won't be shown again.

## 📁 Project Structure

```
cod-client/
├── app/              # Next.js 16 App Router (routes and pages)
├── components/       # React components (UI and features)
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and helpers (auth, api, email, rbac)
├── types/            # TypeScript type definitions
├── locales/          # i18n translations (Arabic, English, French)
├── db/               # Drizzle re-exports from cod-shared (schema + connection)
├── actions/          # Server actions (reads via cod-shared queries)
└── public/           # Static assets
```

## 📚 Documentation

Each major directory has its own README with detailed documentation:

- **[app/README.md](./app/README.md)** - Next.js routes and pages structure
- **[components/README.md](./components/README.md)** - UI components and patterns
- **[hooks/README.md](./hooks/README.md)** - Custom React hooks
- **[lib/README.md](./lib/README.md)** - Utility functions and helpers
- **[types/README.md](./types/README.md)** - TypeScript types system
- **[locales/README.md](./locales/README.md)** - Internationalization (i18n)
- **[db/README.md](./db/README.md)** - Database schema and migrations

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **next-themes** - Dark/light mode
- **@/lib/translations** - Custom i18n system (Arabic RTL, English, French)
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Backend
- **Cloudflare Workers** (via OpenNext) - hosting and edge functions
- **Cloudflare D1** - SQLite database at the edge
- **Drizzle ORM** - Type-safe database queries
- **Better Auth** - Authentication provider (email + password, magic links, OAuth)

### Development
- **Wrangler** - Cloudflare CLI
- **Vitest** - Unit, integration, property, and e2e testing

## 🎨 Features

### Core Features
- ✅ Analytics dashboard (orders, revenue, conversion)
- ✅ Order management: status lifecycle, carrier dispatch, shipment tracking, shipping labels
- 🚧 Abandoned-order recovery — backend collection exists; dashboard UI coming soon
- ✅ Customer management with groups and tags
- ✅ Product catalog: variants, stock, offers, reviews
- ✅ Delivery system (in-house drivers + carrier integrations: Yalidine, ZR Express, NOEST, EcoTrack)
- ✅ Meta Conversions API (CAPI) — Purchase events fired on real deliveries
- ✅ MCP agent access — scoped OAuth tokens for AI tools
- ✅ Team management and settings (staff roles, RBAC scopes)

### UI/UX
- ✅ Fully responsive (mobile-first)
- ✅ RTL support (Arabic)
- ✅ Dark/light mode
- ✅ Clean, modern design
- ✅ Accessible components
- ✅ Loading and error states

### Developer Experience
- ✅ Type-safe with TypeScript
- ✅ Modular component structure
- ✅ Reusable custom hooks
- ✅ Centralized utilities
- ✅ Comprehensive documentation
- ✅ Clean code patterns

## 🔧 Development

### Environment Variables

Create `.dev.vars` (copy `.dev.vars.example`):

```env
# Dashboard URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Worker Backend (Server) - REQUIRED
NEXT_PUBLIC_WORKER_URL="http://localhost:8787"

# Secret for Better Auth (generate: openssl rand -base64 32)
BETTER_AUTH_SECRET=""
```

**Important:** 
- The `NEXT_PUBLIC_WORKER_URL` must point to your running server (default: http://localhost:8787 for local development)
- For production, set this to your deployed server URL (e.g., https://api.yourdomain.com)
- `BETTER_AUTH_SECRET` is a secret — set it via `wrangler secret put BETTER_AUTH_SECRET` in production, never commit it

### Database Commands

**Note:** Database schema + migrations are single-sourced in `cod-server`. The
client binds the same D1 database but owns no migrations — all `db:*` commands
below delegate to `cod-server`.

```bash
# Setup local database (migrate + seed demo store — delegates to cod-server)
npm run db:migrate:local && npm run db:seed:local

# Individual commands (also delegate to cod-server)
npm run db:migrate:local
npm run db:seed:local
npm run db:migrate:remote
```

To create or edit migrations, work in `cod-server` (`npm run db:generate`
there) — see `cod-server/README.md`.

### Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database (delegates to cod-server — the single migration owner)
npm run db:migrate:local # Apply migrations locally
npm run db:seed:local    # Seed demo store data

# Deployment (Workers via OpenNext)
npm run deploy           # Build worker + deploy to Cloudflare Workers
```

## 📦 Project Organization

### Components
- **ui/** - Reusable UI primitives (buttons, inputs, etc.)
- **layout/** - Layout components (sidebar, navbar)
- **[feature]/** - Feature-specific components

### Hooks
- **useDialog** - Dialog state management
- **useDebounce** - Debounced values
- **useLocalStorage** - Persistent state
- **useMediaQuery** - Responsive breakpoints

### Lib
- **constants.ts** - Centralized constants
- **config.ts** - App configuration
- **format.ts** - Formatting utilities
- **avatar.ts** - Avatar generation
- **translations.ts** - i18n hooks

### Types
- **customer.types.ts** - Customer types
- **order.types.ts** - Order types
- **product.types.ts** - Product types
- **delivery.types.ts** - Delivery types
- **[feature].types.ts** - Feature-specific types

## 🎯 Code Patterns

### Component Structure
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/lib/translations";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/constants";

interface MyComponentProps {
  data: Data;
}

export function MyComponent({ data }: MyComponentProps) {
  const t = useCustomers();
  const [state, setState] = useState(false);

  return (
    <div>
      <h1>{t.page_title}</h1>
      <p>{formatPrice(data.price)}</p>
    </div>
  );
}
```

### Using Hooks
```tsx
import { useDialog } from "@/hooks/useDialog";
import { useDebounce } from "@/hooks/useDebounce";

const { open, data, openDialog, closeDialog } = useDialog<Customer>();
const debouncedSearch = useDebounce(search, 300);
```

### Using Constants
```tsx
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from "@/lib/constants";
import { formatPrice, formatDate } from "@/lib/format";
```

## 🚀 Deployment

This app runs as a Cloudflare Worker via OpenNext (it is not a static Pages site).

1. Configure `cod-client/wrangler.toml` (D1 database id, KV namespace id, public URLs) and set the `BETTER_AUTH_SECRET` secret:
   ```bash
   wrangler d1 create codflow-db
   wrangler kv namespace create RATE_LIMIT_KV
   wrangler secret put BETTER_AUTH_SECRET
   ```
2. Build + deploy:
   ```bash
   npm run deploy
   ```
3. Run migrations against the remote database:
   ```bash
   npm run db:migrate:remote
   ```

## 🤝 Contributing

1. Follow existing code patterns
2. Use TypeScript for type safety
3. Add translations for all text
4. Document new components/hooks
5. Test on mobile and desktop
6. Ensure RTL support works

## 📄 License

Open source. See the [repository root](../README.md) for the license.

## 🔗 Links

- [Next.js Docs](https://nextjs.org/docs)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Built with ❤️ for Algerian e-commerce businesses**
