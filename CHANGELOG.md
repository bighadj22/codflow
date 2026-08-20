# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-20

Initial public release of CodFlow — the open-source, COD-first e-commerce +
delivery platform for Algeria.

### Added

- **cod-server** — Cloudflare Workers API: merchant `/api/*` endpoints (Better
  Auth sessions + RBAC), public `/store/*` endpoints (per-store key auth),
  webhook receivers for Yalidine and ZR Express, image delivery from R2,
  OpenAPI spec, Meta CAPI purchase events, and an MCP remote server
- **cod-client** — Next.js merchant dashboard: analytics, orders, customers,
  products, delivery, returns, team (RBAC), settings, and reviews
- **cod-astro/theme01** — swappable storefront theme: COD order form with
  wilaya-based shipping calculator, variants, order-verified reviews, and
  abandoned-order tracking
- **cod-shared** — single D1 schema, shared queries, RBAC scope registry, and
  error codes consumed by both apps

### Security

- Inbound webhooks (Yalidine, ZR Express) verified with Svix HMAC signatures
- MCP remote server protected with OAuth + offline JWKS verification (RFC 9728)
- API keys hashed at rest (SHA-256); production secrets only via
  `wrangler secret put` — none committed to the repository
- Dependabot security & grouped version updates enabled; branch protection on
  `main`

### Changed

- Storefront upgraded to Astro 7 (Rust compiler, Vite 8); server & dashboard
  upgraded to TypeScript 7 and Vitest 4; Drizzle ORM → 0.45; Next.js → 16;
  Wrangler → 4
