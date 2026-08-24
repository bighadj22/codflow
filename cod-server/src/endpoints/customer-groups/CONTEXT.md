# Customer Groups Context

Curated customer segments with a purpose statement — "Wholesale", "Blacklisted" — where membership is hand-picked, counted live, and must be emptied before the segment can die.

## Language

### Group Anatomy

**Customer Group**:
A named segment collecting customers for a workflow or policy. Names may repeat freely — nothing enforces uniqueness, unlike tags.
_Avoid_: Tag (the sibling mechanism), tier, list

**Group Description**:
An optional free-text note up to 500 characters for internal policy or context. Never shown to shoppers.
_Avoid_: Public blurb, terms

**Group Color**:
A six-digit hex color for dashboard identification, defaulting to indigo when not chosen.
_Avoid_: Branding, theme token

**Member Count**:
A denormalized counter on the group refreshed from real rows after every membership change — and serving as the deletion guard's source of truth.
_Avoid_: Audience size, popularity

### Membership

**Member**:
A customer explicitly placed into the group, stamped with when it happened. Uniqueness is enforced twice: application logic and a database index on the pair.
_Avoid_: Subscriber, follower

**Idempotent Addition**:
Adding a customer who is already a member succeeds without error and changes nothing but the refresh timestamp.
_Avoid_: Duplicate rejection

**Silent Removal**:
Removing a pairing that doesn't exist also succeeds quietly — the customer's existence is never verified on this path.
_Avoid_: Not-found error

**Membership Guard**:
A group holding even one member refuses deletion until it is emptied; empty groups delete freely.
_Avoid_: Cascade cleanup, forced removal

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Free-form labels**: `customer-tags/` is the sibling mechanism — tags are lightweight labels, groups carry descriptions and policy intent
- **Customer identity and purchase stats**: Customers context — members reference customers, never own them
- **Audit trail**: every group action lands in Activity Logs with actor attribution
- **AI moderation surface**: MCP registry exposes these tools under `customer_groups:read` / `customer_groups:manage`

## Edge Cases

**Duplicate names are legal**: Two groups may share a name exactly — distinguishing them is the merchant's job via color or description.

**Cascade deletions desync the counter**: Removing a customer erases their memberships at the database level without touching stored counts — phantom-member lockouts are possible until some later add/remove recounts the group.

**Removal never checks the customer**: Only the group is validated first; unknown customer IDs return success like any other removal.

**Counts self-heal on activity**: The recount-before-write pattern corrects drift whenever a group sees new membership traffic — dormant groups stay stale indefinitely.
