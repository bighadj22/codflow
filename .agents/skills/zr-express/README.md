# ZR Express — Delivery Platform API

Machine-extracted reference for the **ZRExpress.Api (Public)** OpenAPI spec.

| Item | What it is |
|---|---|
| `swagger.json` | The **raw, unaltered** spec from `https://api.zrexpress.app/swagger/public-v1/swagger.json` (the source of truth) |
| `endpoints-index.md` | Master index — all **129 endpoints** across all domains + auth notes |
| `references/` | One Markdown file per domain, every endpoint verbatim (method, path, operationId, summary, description, params, request/response schema refs) |
| `schemas/` | The subset of `components.schemas` referenced by each domain (exact JSON, unaltered) |

## How files are organized

| Domain | `references/` file | Endpoints |
|---|---|---|
| catalog | `catalog.md` | 17 |
| claims | `claims.md` | 11 |
| customers | `customers.md` | 15 |
| orders | `orders.md` | 50 |
| delivery-pricing | `delivery-pricing.md` | 5 |
| hubs | `hubs.md` | 2 |
| supplier | `supplier.md` | 3 |
| treasury | `treasury.md` | 15 |
| users | `users.md` | 4 |
| webhooks | `webhooks.md` | 7 |

## Rules

- **These files are generated.** Never hand-edit `swagger.json`, `references/*.md`
  or `schemas/*.json` to "fix" an endpoint — re-run the generator instead.
- Endpoint paths, methods, summaries, descriptions, parameters, and schema refs are
  reproduced verbatim from the upstream spec.

## Authentication

Every endpoint accepts `Authorization: Bearer {token}` or `X-Api-Key: {apiKey}`; most
endpoints also require the `X-Tenant` header. The `version` path parameter defaults to `1`.

## Regenerating

The generator lives at `generate.py` in this folder (reads `swagger.json`, rewrites
`endpoints-index.md`, `references/*.md` and `schemas/*.json`):

```sh
curl -sL 'https://api.zrexpress.app/swagger/public-v1/swagger.json' -o .agents/skills/zr-express/swagger.json
python3 .agents/skills/zr-express/generate.py
```