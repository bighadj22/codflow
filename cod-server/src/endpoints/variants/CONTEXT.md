# Variants Context

The concrete, sellable faces of a variable product — each with its own price, SKU, stock, and picture — plus the rules for how they live and die without corrupting order history.

## Language

### Shape

**Variant**:
One purchasable combination of a variant product's options (e.g. Red / XL), carrying independent price, SKU, inventory, barcode, weight, image, and display position.
_Avoid_: Option, variation (that's the field name), child product

**Variations**:
The key-value record naming the combination, e.g. `{"Color": "Red", "Size": "M"}`. Intended to mirror the parent's declared options, but creation accepts any record without checking the blueprint.
_Avoid_: Attributes object, option set

**Default Variant**:
The variant the storefront pre-selects when a shopper opens the product. The flag is not exclusive — several variants may claim it and the first one wins.
_Avoid_: Primary SKU, featured variant

**Active Variant**:
Visibility switch per variant; inactive ones vanish from storefront listings, stock alerts, and reward selection while their data remains stored.
_Avoid_: Deleted, disabled product

### Identity & Money

**Variant SKU**:
Globally unique across every variant in the store, enforced by the database alone — no friendly pre-check exists on create or update.
_Avoid_: Product SKU (a separate, simple-product-only field)

**Variant Price**:
Whole-number DZD pricing per variant, independent of the parent's base price; the parent price plays no role once variants exist.
_Avoid_: Parent price inheritance

**Barcode**:
Optional free-text scanning identifier with no format enforcement or uniqueness.
_Avoid_: EAN guarantee, UPC

### Lifecycle

**Hard Deletion with History Preservation**:
Deleting a variant permanently removes it after nulling the variant reference on any order lines that point at it — orders keep their labels, SKUs, and totals.
_Avoid__: Blocked deletion, soft delete

**Position**:
Merchant-controlled display order among siblings; listings always sort by it.
_Avoid_: Sort index, priority score

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Option blueprint**: Products context owns `variantOptions`; this module stores combinations but never validates against it
- **Stock accounting**: Stock context owns movements and alerts; variants merely hold an inventory number
- **Order line snapshots**: Orders context — lines copy label and SKU at purchase time and survive variant deletion
- **Routing home**: Variant endpoints are mounted inside the products router under `/api/products/:productId/variants/*`

## Edge Cases

**No blueprint police**: Creating `{"Material": "Gold"}` on a product whose declared options only list Color succeeds silently — drift between options and real variants is possible.

**SKU collisions crash late**: Duplicate SKUs surface as raw database constraint errors rather than friendly conflicts, because uniqueness is delegated entirely to the schema.

**Parent existence is assumed**: Creating a variant against a nonexistent product fails at the foreign-key level, not with a clean not-found message.

**Default is a popularity contest with no referee**: Multiple defaults are allowed; storefronts resolve ties by array order.

**Deletion keeps the receipt, loses the link**: After deletion, old order lines still show the variant's label and SKU text, but their variant pointer reads null forever.
