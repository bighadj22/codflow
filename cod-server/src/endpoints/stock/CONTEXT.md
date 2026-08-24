# Stock Context

How many sellable units exist and how that number earned its value: every unit arriving or leaving is one signed movement in an append-only ledger, and health alerts are just arithmetic over it.

## Language

### Inventory Model

**Tracked SKU**:
The unit of stock accounting — a simple product counts as one SKU carrying its own inventory; each active variant of a variant product counts separately. Untracked products are invisible to this entire context.
_Avoid_: Product, item, warehouse row

**Track Inventory Toggle**:
The product-level master switch (owned by Products context) that removes a product and all its variants from stock counting, deduction, and alerting.
_Avoid_: Stock enabled flag

**Inventory**:
A whole number that never goes negative — every write path refuses moves past zero.
_Avoid_: Quantity on hand, warehouse level

### Movements

**Stock Movement**:
One immutable ledger row recording a change: movement type, signed delta, inventory before and after, optional reason and reference, and who did it. Rows are never edited or removed.
_Avoid_: Log entry, transaction

**Movement Type**:
The seven kinds of change: `PURCHASE`, `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE` for manual work; `ORDER_DEDUCTED`, `ORDER_CANCELLED`, `ORDER_RETURNED` for order-driven automation; `OFFLINE_SALE` for walk-in sales.
_Avoid_: Category, event name

**Required Reason**:
Manual movement types (`ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, `OFFLINE_SALE`) demand a written reason; automated order types carry their own reference instead.
_Avoid_: Optional note

**Negative Guard**:
No adjustment may push inventory below zero — the attempt is refused with the available and required amounts spelled out.
_Avoid_: Backorder allowance

### Health & Alerting

**Stock Overview**:
A computed snapshot across all tracked SKUs: total SKU count, out-of-stock count, low-stock count, and inventory value priced at each SKU's selling price.
_Avoid_: Warehouse report, dashboard cache

**Low Stock Threshold**:
Per-SKU alert line between 0 and 9999. Zero disables low-stock alerting while zero-quantity items still surface as out-of-stock.
_Avoid_: Reorder point, minimum

**Alert Ordering**:
Attention lists always sort out-of-stock first, then by rising inventory — the most urgent rows lead.
_Avoid_: Random order, alphabetical triage

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Automatic deduction and restoration**: Orders context writes ORDER_* movements during creation, cancellation, return, and deletion — this module only performs deliberate manual adjustments
- **Where inventory lives**: Products context owns the fields; this context reads and updates them
- **Reward and offer stock checks**: Store context consults inventory before inserting free lines
- **Selling price used for valuation**: Products context pricing — never cost price

## Edge Cases

**Overview rebuilds from scratch every call**: There is no cached health snapshot; totals, segments, and valuation are recomputed from live tables on each request.

**Only tracked SKUs exist here**: Untracked products contribute nothing to SKU counts, value, or alerts — by design they are infinite.

**Variant alerts require an active variant**: Inactive variants drop out of overview and alerts even though their stock numbers remain stored.

**Deleted products leave the ledger standing**: Their historical movements stay queryable, but the products themselves vanish from overview and threshold updates.

**Adjustments answer in Arabic when malformed**: Validation failures on delta and reason carry Arabic-language messages — intentional for the merchant audience.
