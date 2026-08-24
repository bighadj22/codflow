# Reviews Context

Merchant-side moderation of product reviews shoppers submit after a COD purchase: decide what goes public, track the queue, and remember that every rating number on the storefront is recomputed from whatever survives here.

## Language

### Review Anatomy

**Review**:
A shopper's star rating plus optional title and body for one product, anchored to exactly one order — identity is inherited from the purchase, never from an account.
_Avoid_: Feedback, comment, testimonial

**Rating**:
Whole stars, one through five, enforced at validation and by a database check.
_Avoid_: Score, points

**Order Anchor**:
The single order every review is welded to — uniqueness is guaranteed twice, in application code and by a database index, so one order yields at most one review forever.
_Avoid_: Purchase link, receipt reference

**Snapshot Attribution**:
The customer name and order number are copied onto the review at submission time and displayed from then on, immune to later profile edits.
_Avoid_: Live customer lookup

**Helpful Count**:
A display counter carried on every review, always zero — no endpoint anywhere increments it yet.
_Avoid_: Likes, votes

### Moderation Lifecycle

**Pending Queue**:
Every submitted review starts as `pending`; the list endpoint reports a global count of these alongside any filtered results, purely to feed dashboard badges.
_Avoid_: Approval inbox, unmoderated pile

**Approval / Rejection**:
A merchant decision that flips a review's status. Both directions are logged to the audit trail with the reviewer's rating and order number attached.
_Avoid_: Publishing, hiding

**Re-Queuing**:
Status can move back to `pending` — no moderation state is terminal, so a rejected review may be resurrected and vice versa.
_Avoid_: Final decision, lock-in

**Hard Deletion**:
Removal is permanent and immediate; the audit trail records the act but the content is gone.
_Avoid_: Archive, soft delete

### Visibility & Aggregation

**Approved-Only Display**:
The storefront listing returns solely `approved` reviews; pending and rejected exist only behind merchant auth.
_Avoid_: Public preview

**Live Aggregates**:
Average rating and review counts are computed fresh from existing rows at every read — approving, rejecting, or deleting a review changes storefront numbers instantly, with no cached score to invalidate.
_Avoid__: Cached rating, periodic recalculation

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Storefront submission**: Store context receives shopper reviews via order-number intake; this module only moderates what arrives
- **Where aggregates appear**: Products and Store contexts embed average rating and count; they compute them independently from this table
- **Anchor ownership**: Orders context owns the anchoring order — deleting that order cascades the review away with it

## Edge Cases

**Product match goes unchecked**: Submission verifies the order number resolves, but nothing confirms the reviewed product belongs to that order — a valid order number can rate a different product.

**One review per order, enforced twice**: Application logic rejects duplicates, and a unique database index stands behind it even if a future caller bypasses the API.

**Deleting the anchor order deletes the review**: Order removal cascades to its reviews; storefront aggregates shift accordingly with no tombstone left behind.

**Badges ignore your filters**: The pending count travels with every list response regardless of status or product filters — filtering the list never shrinks the badge.

**Nothing ever increments Helpful Count**: It renders as a static zero everywhere until some future feature writes to it.
