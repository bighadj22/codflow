# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

CodFlow is a pre-release monorepo with no tagged releases yet. This section
tracks work in progress toward the initial public release.

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

- No public releases yet; see `SECURITY.md` for the reporting process

## [0.1.0] - TBD

Placeholder for the initial tagged release. Version numbers and release dates
will be added here when the first tag is cut.