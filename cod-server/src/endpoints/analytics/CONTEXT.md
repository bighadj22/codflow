# Analytics Context

Ready-computed answers for dashboards: today a single status breakdown of every order in the store, designed to grow one efficient read query at a time.

## Language

### Metrics

**Dashboard Stats**:
The one published metric set: order counts grouped by lifecycle status, powering the summary cards.
_Avoid_: KPIs, reports, insights

**Status Breakdown**:
The response shape — rows of `status` plus `count`, using the Orders context's lifecycle vocabulary verbatim.
_Avoid_: Status distribution chart labels

**Sparse Results**:
Only statuses holding at least one order appear in the response; missing keys mean zero, and filling the gaps is the caller's job.
_Avoid_: Zero-filled series

**Single-Round-Trip Aggregation**:
Every metric is one grouped database query — no stitching rows together in application code.
_Avoid_: Multi-pass computation

**Dashboard View Scope**:
The single `dashboard:view` permission that gates everything here; no finer granularity exists.

### Growth Rule

**Query Home**:
New reporting metrics belong as named functions beside this one in shared code — each self-contained, read-only, and individually testable.
_Avoid_: Inline SQL in handlers, cross-module metric mixing

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Status vocabulary and transitions**: Orders context — this module counts, never judges or moves
- **Money metrics**: none exist here yet; revenue belongs to Payments/Orders when added
- **Product and stock health**: Products / Stock contexts own their own summaries

## Edge Cases

**Lifetime totals only**: No date range parameters exist — counts span every order ever created, including ones placed moments ago.

**Deleted orders vanish from history**: Since order deletion is permanent, hard-deleted orders leave these counts with no trace.

**Zeros are absent, not displayed**: A brand-new store receives an empty array rather than eleven zero rows — clients must handle the gap.
