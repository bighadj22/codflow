# Drivers Context

The shop's own delivery workforce: who drives for the store, where each one rides, what they're paid per region, and when they can't be removed.

## Language

### Identity

**Driver**:
A person employed or contracted by the shop to deliver orders personally — the human half of Manual Delivery.
_Avoid_: Courier, rider, employee, staff

**Availability Status**:
The driver's operational state: `available`, `busy`, or `inactive`. Changed only through its own dedicated endpoint — never as a side effect of anything else.
_Avoid_: Active flag, online state, shift status

**Vehicle Type**:
What the driver rides: `motorcycle`, `car`, or `van`. Optional — unknown until declared.
_Avoid_: Transport mode, fleet class

**Phone Uniqueness**:
The primary phone uniquely identifies one driver across the whole shop; the secondary phone carries no such constraint.
_Avoid_: Duplicate contact, shared number

### Payroll

**Compensation Grid**:
The driver's per-wilaya pay table — one fee per (driver, wilaya) pair. Always presented as every wilaya in Algeria with unset rows shown as empty, never as a partial list.
_Avoid_: Rate card, salary table, coverage map

**Fee Per Delivery**:
DZD the shop pays this specific driver for one delivery in one wilaya. Completely independent of what the customer was charged for that same delivery.
_Avoid_: Commission, delivery charge, shipping rate

**Sparse Grid Rule**:
A missing pay row for a wilaya is not an error: assigning an order there succeeds and pays zero until a row is configured.
_Avoid_: Missing coverage error, unpriced region

**Coverage**:
How many wilayas have configured fees for this driver. Zero coverage is legal but silently unpaid work.
_Avoid_: Service area, territory

### Guards

**Active Orders**:
The driver's orders currently Assigned or Out for Delivery. Their existence blocks deleting the driver; finished history does not.
_Avoid_: Open orders, ongoing deliveries

**Cascade Erasure**:
Deleting a driver silently wipes their compensation grid AND their entire settlement history along with them.
_Avoid_: Cleanup on delete, dependent removal

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Driver Assignment / Unassignment / Frozen Driver Fee**: Orders context — this folder never assigns orders to drivers
- **Pending Cash, Total Earnings, Total Paid**: Payments context owns what those counters mean; their values merely live on the driver record
- **Customer delivery pricing**: shipping profiles — a driver's pay and the customer's charge never reference each other

## Edge Cases

**Status is purely manual**: Nothing in the system flips a driver between available, busy, or inactive — not assignment, not dispatch, not delivery. The dedicated endpoint is the only writer.

**Deletion destroys financial history**: Cascade Erasure removes payment records with no archive — settle outstanding COD before deleting a driver.

**Secondary phones can collide**: Two drivers may share the same secondary number; only the primary is unique.

**Search ignores secondary phones**: Driver search matches first name, last name, and primary phone only.

**Recent Orders is a snapshot, not a queue**: Driver detail embeds at most ten most-recently-touched orders for context — it is not a work list.
