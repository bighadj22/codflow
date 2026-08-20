# Database (`db/`)

This directory is a thin passthrough to **`cod-shared`** — the single source of
truth for the CodFlow database layer.

## What lives here

- `schema.ts` — re-exports `cod-shared/db/schema` (all Drizzle table definitions).
- `index.ts` — re-exports `cod-shared/db/client` (`getDb(d1)` / `AppDb`).

Import from `@/db` in app code:

```ts
import { getDb } from "@/db";
import { users } from "@/db/schema";
```

## The important rule: migrations live in `cod-server`

This Worker binds the same D1 database (`codflow-db`) as `cod-server`, but it
**owns no migrations**. The single migration set is
`cod-server/src/db/migrations` and is generated/applied from `cod-server` only.

```bash
# From cod-server — generate a migration after changing cod-shared/db/schema.ts
npm run db:generate

# Apply locally (shared state, same DB as the API in dev)
npm run db:migrate:local

# Seed demo store data
npm run db:seed:local
```

`cod-client` also exposes convenience wrappers that delegate to `cod-server`
(`npm run db:migrate:local`, `npm run db:seed:local`, `npm run db:migrate:remote`).

## Local dev shared state

In development, `cod-server` and `cod-client` point their local D1 state at the
same path (`<repo-root>/.wrangler-shared`), so both read the same SQLite file.

## Schema source of truth

Always edit tables in `cod-shared/db/schema.ts`. Re-export changes propagate to
both apps automatically.
