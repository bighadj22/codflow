# Products Context

The merchant's catalog: what is for sale, in which sellable combinations, what each costs, and how stock is counted. Storefront exposure and review scores hang off this context but are governed elsewhere.

## Language

### Catalog Shape

**Product**:
A sellable catalog entry — either a Simple Product carrying its own stock, or a Variant Product acting as a parent that defines options while variants hold the real sellables.
_Avoid_: Item, SKU (that's a field), listing

**Simple Product**:
A product with `hasVariants=false` — it must carry its own SKU and inventory directly.
_Avoid_: Standalone product, basic product

**Variant Product**:
A product with `hasVariants=true` — declares a blueprint of option axes; all stock and pricing live on its variants, never on the parent.
_Avoid_: Configurable product, parent item

**Variant Options**:
The blueprint declared on a Variant Product: named axes (e.g. Color, Size) with allowed values, optionally a hex color per value. Variants are created against this blueprint.
_Avoid_: Attributes, properties

**Variant**:
One concrete sellable combination (e.g. Red / XL) with its own price, required SKU, inventory, barcode, weight, and image reference.
_Avoid_: Variation, option, child SKU

**Handle**:
The unique URL slug. Auto-generated from the name plus an ID suffix when not supplied.
_Avoid_: Slug, URL path, SEO name

### Lifecycle & Exposure

**Product Status**:
`DRAFT`, `ACTIVE`, or `ARCHIVED`. Changing to ACTIVE re-stamps the publish timestamp every time — it records the latest activation, not the first.
_Avoid_: State, stage, enabled flag

**Published At**:
Timestamp of the product's most recent activation. Cleared products carry null until first activated.
_Avoid_: Creation date, launch date

**Visibility**:
The master internal switch. Off means hidden from everything — dashboard listings and storefront alike.
_Avoid_: Hidden flag, private mode

**Show In Store**:
The storefront-only switch. A product can be fully visible to the merchant yet absent from the public store.
_Avoid_: Visible, published

**Store Featured**:
A merchandising highlight flag; the public catalog can filter to featured products only.
_Avoid_: Pinned, promoted, bestseller

**Soft Delete**:
Deletion sets a timestamp rather than removing the row — soft-deleted products vanish from every read but keep order history intact. Products with any order line cannot be deleted at all.
_Avoid_: Remove, permanent delete

### Inventory & Money

**Track Inventory Master Toggle**:
A product-level gate. When off, the product is excluded from stock tracking entirely — simple stock is ignored, and ALL of its variants stop deducting and disappear from stock alerts.
_Avoid_: Stock enabled, counting switch

**Low Stock Threshold**:
The alert line per product or variant; zero disables alerting.
_Avoid_: Minimum stock, reorder point

**Total Inventory**:
The computed rollup shown on listings and details: sum of variant stock for Variant Products, the product's own number for Simple Products.
_Avoid_: Stock level, available quantity

**Compare-At Price**:
The strike-through anchor price shown next to the real price. Cost Price is the merchant's own acquisition cost — never shown to customers.
_Avoid_: Old price, list price

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Order lines** snapshot name/SKU/price at purchase time: Orders context — later catalog edits never rewrite history
- **Return outcomes per line**: Orders context (fulfilled / partially returned / returned)
- **Review counts and average ratings**: Reviews context — this module merely embeds aggregates from approved reviews
- **Delivery fee profile link**: Shipping Profiles context — one nullable pointer, resolved there
- **Image uploads**: the images endpoint folder handles R2 storage; this context only associates records

## Edge Cases

**SKU uniqueness has two layers**: Creation checks duplicates among live products only (friendly 409), but the database's unique index spans soft-deleted rows too — reusing a deleted product's SKU collides at the DB level instead of the friendly path.

**Any historical line blocks deletion forever**: One order line referencing the product — regardless of order status — permanently prevents Soft Delete. Archive via status instead.

**Variant deletion is the opposite of product deletion**: Variants hard-delete immediately; referencing order lines survive with their variant reference nulled.

**Parent stock is ignored for variant products**: Once `hasVariants=true`, the parent's own inventory field plays no part in Total Inventory.

**Storefront requires four green lights**: status ACTIVE + visibility + show-in-store + not soft-deleted — any single one fails and the storefront hides the product.

**Currency exists but is frozen**: Every product and variant row stores DZD; nothing reads or converts it.
