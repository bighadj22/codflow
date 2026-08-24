# Customers Context

Who buys from the store: people identified by their phone number, their running purchase ledger, and the segments merchants sort them into.

## Language

### Identity

**Customer**:
A person who places COD orders, keyed by phone number. Not a login — dashboard users live in a different system entirely.
_Avoid_: User, account, buyer, client

**Primary Phone**:
The customer's identity anchor: Algerian mobile format and unique across every customer. Duplicate attempts are refused, not merged.
_Avoid_: Contact number, mobile

**Secondary Phone**:
An optional extra number with no uniqueness rule — two customers may share one.
_Avoid_: Alternate contact ID

**Place Snapshot**:
The Arabic display names for wilaya and commune stored directly on the customer alongside their IDs. The IDs are authoritative; the names are refreshed only when this customer is written.
_Avoid_: Live lookup, resolved location

### Purchase Ledger

**Total Orders**:
How many orders this customer has ever placed, minus deleted ones. Returned orders still count here.
_Avoid_: Order count today, active orders

**Total Spent**:
Running value of kept orders. Cancelled and returned orders subtract back out (never below zero); deleted orders remove their value entirely.
_Avoid_: Lifetime value, revenue

**Last Order At**:
Creation timestamp of the most recent order.
_Avoid_: Last activity, last login

These three counters are maintained automatically by the Orders context at creation, cancellation, return, and deletion — this module never writes them by hand.

### Segmentation & History

**Group Membership**:
Belonging to a named segment (e.g. VIP) recorded with an assignment timestamp. Groups are owned by `customer-groups/`.
_Avoid_: Category, tier

**Tag Assignment**:
A free-form label attached with an assignment timestamp. Tags are owned by `customer-tags/`.
_Avoid_: Note, flag

**Order History**:
The customer's complete order list, newest first, each carrying its full status history and joined Arabic place names.
_Avoid_: Purchase log, receipts

**Recent Orders**:
At most ten newest orders embedded in the profile detail — a convenience snapshot, not the full history.
_Avoid_: Order queue

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Creating customers from walk-in orders**: Orders context auto-creates a Customer when checkout names an unknown phone
- **Group / Tag management**: `customer-groups/` and `customer-tags/` own those lifecycles
- **Geography IDs and formats**: Wilayas context
- **Ledger writes**: Orders context owns when Total Orders / Total Spent move; this module only initializes them at zero

## Edge Cases

**Customers with history are immortal**: One order — any status — permanently blocks deletion; there is no soft-delete escape hatch for customers.

**Returned orders split the ledger**: They stay counted in Total Orders while their value exits Total Spent — the two numbers intentionally diverge.

**Place Snapshots age independently**: Renaming or re-mapping reference geography never rewrites existing customers; snapshots refresh only when that customer is edited.

**Phone uniqueness stops at the app layer**: Enforced on create and on phone changes with a friendly conflict; the database itself imposes no unique constraint on it.
