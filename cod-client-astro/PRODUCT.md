# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small and mid-size Algerian COD merchants who manage orders, customers, products,
and delivery operations from desktop and mobile.

## Product Purpose

CodFlow gives COD merchants one place to move an order from customer request to
delivery, with the information needed to make the next operational decision.

## Positioning

The dashboard connects COD order handling with Algerian delivery workflows,
including delivery-company dispatch and tracking, rather than treating orders
as a standalone sales list.

## Operating Context

Merchants process orders in batches at a desk and also check or advance orders
from mobile while coordinating delivery in the field. Order status, COD amount,
customer details, and delivery assignment are the core daily signals.

## Capabilities and Constraints

- The Astro dashboard is a prerendered static shell with browser-hydrated React islands.
- Authentication gates run in the browser; API authorization remains server-side.
- The dashboard supports Arabic, English, and French, including RTL Arabic layout.
- The dashboard supports persistent light and dark appearance modes.
- Data is fetched through the Astro API seam and may be unavailable while a user is offline or a provider is failing.
- The Astro dashboard is being migrated incrementally; the orders surface is the first operational proof surface.

## Brand Commitments

- The product name is CodFlow.
- The interface should feel like a serious commerce operations tool, not an AI demo or marketing site.
- The Astro dashboard should use Shopify Admin and Polaris as its interaction and density reference while retaining CodFlow terminology, branding, and COD-specific workflows.

## Evidence on Hand

- Legacy dashboard behavior and translations: `../cod-client`.
- Current Astro dashboard implementation: `src/`.
- Shared Arabic, English, and French locale resources: `locales/`.

## Product Principles

- Show the next operational decision clearly.
- Keep order-to-delivery state trustworthy and scannable.
- Preserve parity across desktop and mobile for daily work.
- Make localization and RTL behavior first-class.
- Keep failure and empty states useful without inventing data.

## Accessibility & Inclusion

Interactive controls need visible keyboard focus, labels, semantic states, and
touch-safe targets. Arabic must remain readable and correctly aligned in RTL;
English and French must preserve comfortable Latin text metrics.
