# Abandoned Orders Context

Rescuing checkouts that died halfway: capturing shoppers who typed their contact details but never paid, aging them into recoverable leads, and measuring whether the rescue worked.

## Language

### Capture

**Abandoned Checkout**:
A storefront visit where the customer entered contact details (at minimum name and phone) without placing an order — one record per browser session.
_Avoid_: Lost order, dead cart, incomplete order

**Session Upsert**:
The storefront reports progress silently as fields are typed; the record is created once per session ID and refreshed in place afterwards, keeping whatever recovery status it already earned.
_Avoid_: Re-creation, duplicate tracking

**Attribution Capture**:
Meta click identifiers plus client IP and user agent are stored alongside the checkout so any future recovery event can be attributed properly.
_Avoid_: Marketing pixels, tracking cookies

### Lifecycle

**Pending**:
Freshly captured and less than thirty minutes old — the shopper may still be typing.
_Avoid_: New, open

**Abandoned**:
Thirty minutes have passed since capture with no order placed; the record becomes a recovery lead via an automated sweep.
_Avoid_: Expired, lost

**Converted**:
An order was linked back to the session. The link stores both the internal order reference and the customer-facing order number, and the conversion cannot be recorded twice.
_Avoid_: Completed, recovered automatically

**Contacted**:
A merchant manually marked outreach as done. Purely bookkeeping — nothing automates it.
_Avoid_: In progress, follow-up

**Recovery Sweep**:
The cron that ages pending sessions into abandoned using the original capture time — continued typing never postpones the countdown.

### Measurement

**Recovery Stats**:
Three numbers computed live: how many checkouts sit abandoned, how many converted, and the recovered percentage across both.
_Avoid_: Success metrics, funnel report

**Estimated Lost Revenue**:
The sum of self-reported basket prices across currently-abandoned sessions — an approximation built from what shoppers typed, not a verified sales figure.
_Avoid_: Real revenue loss, exact figure

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Placement of the real order**: Orders context — conversion merely links back to it after the fact
- **Storefront auth**: the capture endpoints ride the Store API key, mounted under `/store`; merchant management lives behind dashboard scopes at `/api/abandoned-orders`
- **Product data on the record**: copied display strings from Products context — snapshots, never live references

## Edge Cases

**Conversion never fails loudly**: The convert endpoint answers success even for unknown sessions and swallows its own database errors — recovery tracking must never break checkout.

**Status moves are unguarded**: Merchants may set any status from any other, including pulling a converted record back to abandoned — no transition ranks exist here, unlike order webhooks.

**Upserts respect earned status**: Refreshing a session's details never resets its lifecycle; only explicit conversion or manual change moves it.

**The sweep counts from first capture**: A shopper who types slowly for an hour is swept to abandoned mid-session even though their record keeps updating — a later conversion still wins.

**Basket value is aspirational**: Estimated lost revenue inherits whatever price the shopper's browser reported, absent products, quantities, or fees.
