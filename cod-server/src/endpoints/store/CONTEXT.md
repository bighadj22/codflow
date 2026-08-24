# Store Context

The public storefront surface under `/store/*`: everything a shopper touches without logging in — browsing the catalog, reading delivery rates, placing a COD order, and reviewing a purchase afterward.

## Language

### Access

**Store API Key**:
The single credential authenticating the entire storefront (`X-Store-API-Key`). A different secret from dashboard API keys; it determines which store's data every call sees.
_Avoid_: Admin key, session auth

### Catalog

**Storefront Catalog**:
The public product list. A product appears only with four green lights — ACTIVE status, visibility, show-in-store, and not soft-deleted — ordered featured-first then newest.
_Avoid_: Full catalog, product dump

**Handle Lookup**:
Product details are fetched by URL handle, never by internal ID.
_Avoid_: Product ID lookup

### Checkout

**Store Order**:
A COD order submitted from the storefront for one product per submission, in any quantity, with optional per-unit variant picks.
_Avoid_: Cart order, multi-item order

**Find-or-Create Customer**:
Checkout looks up the customer by phone; an existing customer is reused exactly as-is, otherwise a new one is created from the checkout fields.
_Avoid_: Registration, sign-up

**Client-Supplied Price**:
The unit price arrives from the storefront with the order, and the server computes totals from it rather than re-reading the catalog price.
_Avoid_: Server-priced total, catalog lookup price

**Variant Selections**:
One entry per ordered unit when different variants are mixed; identical units collapse into a single order line and stock deducts per variant.
_Avoid_: Variant array, options list

**Offer Selection**:
The shopper may pin an offer by ID; the server honors it only if still active and the quantity qualifies — otherwise it auto-picks the highest qualifying tier.
_Avoid_: Coupon choice, discount code

**Buy X Get Y Reward**:
The free reward product of a promotion, appended to the order as a zero-price line. If the reward is out of stock the offer is skipped silently — the order still succeeds.
_Avoid_: Gift item, bonus product

**Free Shipping Offer**:
A promotion that zeroes the resolved delivery fee, reflected in both the fee line and the total.
_Avoid_: Shipping coupon

**SKU Gate**:
An order is refused unless the product — or every selected variant — carries a SKU. Missing SKUs block selling before stock is ever checked.
_Avoid_: Catalog requirement, setup warning

**Lead Mirror**:
A server-side Meta "Lead" event fired alongside each order using the same event ID as the browser pixel, so Meta deduplicates instead of double-counting. Failure is logged and ignored — it can never block an order.
_Avoid_: Tracking pixel, analytics event

### Reviews

**Order Number Review**:
Review submission takes the customer-visible Order Number — the only identifier shoppers ever see — and resolves it internally; UUIDs stay hidden.
_Avoid_: Order ID review, account review

**One Review Per Order**:
Exactly one review per order, enforced against the internal order reference even though shoppers type the number.
_Avoid_: Duplicate check, rating cap

**Pending Moderation**:
Every submitted review starts unapproved; only merchant-approved reviews ever reach the public listing.
_Avoid_: Instant publish, auto-approve

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Abandoned checkouts**: captured by `abandoned-orders/` routes mounted under `/store` — visitors typing name + phone are recorded per browser session; a cron flips stale entries to abandoned after 30 minutes; placing the order marks them converted
- **Merchant store settings**: `stores/` folder owns configuration; `/store/config` merely reads it
- **Catalog truth, offers, review moderation**: products/, offers/, reviews/ contexts — the storefront renders, never governs
- **Delivery fee authority**: Shipping Profiles context — the storefront reads the default profile's rates only

## Edge Cases

**Prices arrive from the browser**: Totals run on the client-sent unit price. That is today's contract — treat any "hardening" as a code change, not a docs fix.

**Repeat buyers keep their record**: A returning phone reuses the stored customer untouched — the new checkout's name or wilaya never overwrites it.

**Rewards vanish quietly**: An out-of-stock Buy X Get Y reward disappears from the order without error or notice to the caller.

**Absent wilayas mean unsupported**: The shipping-rates map simply omits uncovered wilayas; clients must treat missing keys as no-delivery.

**Limits are capped twice**: Clients may ask for fewer results, but the server clamps page sizes regardless of what was requested.
