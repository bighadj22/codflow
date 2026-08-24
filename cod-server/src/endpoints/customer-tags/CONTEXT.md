# Customer Tags Context

Free-form labels merchants stick on customers — "VIP", "Frequent Returner", "New Lead" — with a live count that doubles as the deletion guard.

## Language

### Tag Anatomy

**Customer Tag**:
A named label applied to customers for segmentation. Names are unique across the whole store, enforced by the database.
_Avoid_: Label record, category, badge

**Tag Color**:
A six-digit hex color shown in dashboards; every tag has one, defaulting to slate when not chosen.
_Avoid_: Theme setting, styling rule

**Assignment Count**:
A denormalized counter on the tag tracking how many customers currently carry it, refreshed after every assignment change.
_Avoid_: Popularity score, usage stat

**Assignment**:
The link between one tag and one customer, stamped with when it happened. Uniqueness is guaranteed twice — application logic and a database index.
_Avoid_: Membership (that's groups), relation

### Assignment Rules

**Idempotent Assignment**:
Assigning a tag a customer already carries succeeds without error or side effect.
_Avoid_: Duplicate rejection

**Silent Unassign**:
Removing a tag pairing that doesn't exist also succeeds without error — including for customer IDs that never existed.
_Avoid_: Not-found error

**Assignment Guard**:
A tag with even one assignment refuses deletion until it is fully cleared; empty tags delete freely.
_Avoid_: Cascade warning, forced cleanup

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Customer identity and purchase stats**: Customers context — tags reference customers, never own them
- **Curated segments with descriptions**: `customer-groups/` — the sibling segmentation mechanism
- **Audit trail**: every tag action lands in Activity Logs with actor attribution
- **AI moderation surface**: the MCP registry exposes these tools under `customer_tags:read` / `customer_tags:manage`

## Edge Cases

**Duplicate names crash late**: Name uniqueness is database-enforced only — create and update have no friendly pre-check, so collisions surface as raw constraint errors rather than the documented 409.

**Unassign never validates the customer**: Only the tag is checked first; an unknown customer ID still returns success.

**Cascade deletions desync the counter**: Deleting a customer removes their assignments at the database level without touching the tag's stored count — a tag can then become undeletable (guard sees phantom assignments) until some later operation recounts it.

**Counts are rebuilt, not incremented blindly**: Every assignment change re-counts actual rows before updating the stored number, which self-heals drift over time — but only on tags that see new activity.
