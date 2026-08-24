# Offers Context

Buy X Get Y promotions: what the shopper must buy, what they get free, and how the server picks and applies an offer at checkout without any coupon code.

## Language

### Offer Anatomy

**Offer**:
A promotion applied automatically at storefront checkout — the Algerian COD market has no coupon-code input anywhere.
_Avoid_: Coupon, discount code, promo code

**Trigger**:
The qualifying condition: a product (optionally pinned to one variant) plus a minimum quantity the shopper must order.
_Avoid_: Condition, requirement

**Reward**:
The free goods granted when triggered — a product and quantity appended to the order as zero-price lines. Required for Buy X Get Y offers; absent for Free Shipping Offers.
_Avoid_: Gift, bonus, prize

**Free Shipping Offer**:
An offer whose reward is delivery itself — the resolved delivery fee drops to zero instead of any product being added.
_Avoid_: Shipping discount, delivery deal

**Schedule**:
Optional start and end timestamps. A missing start means active immediately; a missing end means it never expires.
_Avoid_: Run dates, campaign window

**Offer Status**:
A manual `active` / `inactive` switch. Only active offers within their schedule can ever qualify.
_Avoid_: Enabled flag, published state

### Application

**Auto-Application**:
The server detects and applies offers during store order creation. Merchants configure; shoppers never trigger anything.
_Avoid_: Manual apply, redemption

**Highest-Tier Wins**:
When several offers qualify for one order, the one demanding the largest quantity is chosen — not the oldest or first listed.
_Avoid_: First-match wins, priority order

**Explicit Selection Fallback**:
The storefront may name a specific offer; if it no longer qualifies, the server silently falls back to auto-detection rather than erroring.
_Avoid_: Rejection, invalid coupon error

**Silent Stock Skip**:
If the reward item lacks stock, the offer vanishes from the order with no warning — checkout still succeeds.
_Avoid_: Out-of-stock error, backorder

**Reward Deduction**:
Reward units leave inventory exactly like paid units when the reward product tracks stock.
_Avoid_: Virtual items, non-counted freebies

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Where application happens**: Store context checkout — this module owns offer data and rules, the storefront order flow executes them
- **Delivery fee mechanics**: Shipping Profiles context — Free Shipping Offers override the resolved fee to zero but never compute fees themselves
- **Trigger / reward product existence**: Products context — deleting those products cascades these offers away
- **Order line rendering**: Orders context — rewards appear there as ordinary zero-price lines with gift labeling

## Edge Cases

**One offer per order, period**: No matter how many qualify, a single order receives at most one offer's benefits.

**Same-product rewards inherit the shopper's variant**: An unspecified reward variant resolves to the exact variant ordered when reward equals trigger product; cross-product rewards take the first active variant by position.

**Tier conflict is decided by demand, not age**: Older documentation claimed first-created wins; selection actually orders by highest satisfied trigger quantity.

**Deleting products deletes offers**: Trigger and reward product rows cascade their offers away — no orphaned promotions linger.

**Inactive is invisible everywhere**: An inactive offer neither appears on product pages nor qualifies at checkout, regardless of schedule.
