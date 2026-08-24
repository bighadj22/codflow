# Shipping Profiles Context

What the CUSTOMER pays to have an order delivered: rate cards per wilaya, commune-level fine-tuning, and how a fee is picked at order creation. Driver pay and carrier costs are deliberately invisible here.

## Language

### Profiles

**Shipping Profile**:
A named rate card defining customer delivery prices across wilayas. Metadata only until populated with rules.
_Avoid_: Zone, pricing plan, delivery config

**Default Profile**:
The single profile always marked as default — the fallback for any order whose products don't name another profile, and the source the storefront and dashboard read for auto-fill.
_Avoid_: Active profile, global profile

**Product Override**:
A product's link to a specific profile. At fee resolution, only the FIRST product of an order gets to steer it — later products' overrides are ignored.
_Avoid_: Product pricing, product shipping rule

### Rules

**Shipping Rule**:
One wilaya's row inside a profile: home price, stop-desk price, and an enabled switch for each mode. A profile holds at most one rule per wilaya.
_Avoid_: Zone rule, region price

**Mode Disable**:
Turning off both switches for a wilaya — that profile simply cannot deliver there, and matching orders are rejected at creation.
_Avoid_: Closed zone, blackout area

**Rule Replacement**:
Rules are always replaced in bulk, never patched one by one. Replacement deletes prior rules first — and their Commune Overrides vanish with them.
_Avoid_: Rule update, partial edit

### Commune Overrides

**Commune Override**:
An optional per-commune refinement stacked on top of a wilaya rule: four nullable fields (both modes' enabled flags and prices).
_Avoid_: Sub-region rule, district pricing

**Inherit-on-Null**:
Any override field left null falls back to the wilaya rule's value at resolution time.
_Avoid_: Default merge, fallback chain

**Effective Values**:
The merged result — override where set, wilaya rule where null. Listings show them so merchants see exactly what fee resolution will use.
_Avoid_: Computed values, final price preview

**Empty Override Self-Destructs**:
Setting all four fields null deletes the override row outright — identical to deleting it explicitly.
_Avoid_: Clearing, zeroing out

### Fee Resolution

**Fee Resolution**:
The authoritative computation at online order creation: first-product override else Default Profile → wilaya rule → commune merge → mode check → pick the price for the chosen delivery type.
_Avoid_: Price lookup, fee calculation

**Delivery Not Available**:
The rejection when the chosen delivery mode has no rule or is disabled at the order's location. Blocks order creation for online orders.
_Avoid_: Out of range, unsupported region

**Free Shipping Offer**:
A promotion that zeroes the resolved fee when its trigger product reaches its trigger quantity in the order. The only cart-based way delivery becomes free.
_Avoid_: Shipping discount, free threshold

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Wilaya / Commune reference data** (names, IDs 1–58): `wilayas/`
- **COD Amount composition**: Orders context — this context supplies only the Delivery Fee slice
- **Driver pay**: `drivers/` Compensation Grid — what the shop charges customers and pays drivers never reconcile
- **Carrier capabilities and stop desks**: Delivery context — carriers are never priced by profiles

## Edge Cases

**Only the first product counts**: A mixed order resolves fees from its first product alone — if it has no profile override, the default profile applies even when later products carry one.

**Replacing rules wipes commune tuning**: Rule Replacement cascades away every Commune Override under the replaced rules; they must be re-entered.

**No config means free, not blocked**: With no Default Profile and no Product Override, orders pass with a zero delivery fee and no coverage checks. A missing rule inside an existing profile blocks instead.

**Offline orders play by different rules**: Dashboard-created orders may state their own fee and silently bypass coverage rejections; storefront orders never can.

**The last default is untouchable**: It cannot be unset nor deleted while it is the only default — another profile must take the crown first.

**Profiles in use cannot die**: A profile referenced by any product refuses deletion until those products move elsewhere.
