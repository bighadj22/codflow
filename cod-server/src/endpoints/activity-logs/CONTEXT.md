# Activity Logs Context

The store's memory of who did what: an append-only audit trail written as a side effect of every meaningful action, readable exclusively by admins, and never allowed to break the thing it is recording.

## Language

### The Trail

**Activity Log**:
One immutable row describing a single performed action — who, what action, on which entity, when. Rows are never updated or removed by any endpoint.
_Avoid_: Change history (that's order-specific), event stream

**Actor**:
The authenticated user behind the action, stored with ID, name, and role at write time so the trail survives the person's later deletion.
_Avoid_: Current user, session

**Action**:
A standardized dot-notation verb for what happened, drawn from a fixed catalog spanning orders, customers, groups, tags, drivers, products, stock, reviews, team management, and AI agent calls.
_Avoid_: Event type, message

**Entity Target**:
What the action touched: a category plus the entity's ID plus a human-readable label captured at that moment.
_Avoid_: Subject, object reference

**Action Metadata**:
Optional JSON context attached to specific actions — status transitions, amounts, role grants, or which driver was assigned.
_Avoid_: Extra fields, payload dump

### Writing

**Fire-and-Forget Logging**:
Audit writes swallow their own failures. A logging breakdown is logged to console and nothing else — business operations proceed untouched.
_Avoid__: Guaranteed audit, transactional trail

### Reading

**Admin-Only Access**:
Every read requires the admin role outright; staff are rejected before scopes are even considered.
_Avoid_: Team visibility, scoped reading

**Trail Filters**:
Listing supports narrowing by actor and entity category; a second endpoint isolates one person's deeds for profile review.
_Avoid_: Search, full-text query

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Who writes here**: every other context calls the shared logging helper at their action sites; this module itself writes nothing
- **Stock changes keep a separate ledger**: stock movements record inventory math; activity logs record the human decision
- **AI accountability**: MCP tool calls and declined confirmations land in this trail but are governed by the MCP integration
- **Order-level status history**: Orders context keeps its own per-order timeline; this trail is store-wide and actor-centric

## Edge Cases

**Audit can silently under-record**: Because logging never fails loudly, a database hiccup loses those trail rows forever while the business action still succeeds.

**Names outlive people**: Actor names are frozen at write time — deleting or renaming a user leaves every historical row unchanged.

**Filtering trusts free text**: The entity-type filter accepts any string rather than validating against known categories; typos simply return empty pages.

**Two 403 shapes exist in the platform**: Role denials here use the standard error envelope with `PERMISSION_DENIED`; scope denials elsewhere come from middleware as plain JSON without any code field at all.
