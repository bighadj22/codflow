# Payments Context

How cash and fees actually move between the shop and its drivers: settling delivered orders, stamping them as paid, and keeping the driver ledger honest.

## Language

### Settlement Types

**Settlement**:
One payment event reconciling a batch of delivered orders between shop and driver. The only way money "moves" in the system — everything else is bookkeeping.
_Avoid_: Payout, payoff, transaction

**COD Remittance**:
Settlement type where the driver hands collected customer cash back to the shop (Driver → Shop). Stamps each order's COD as paid.
_Avoid_: Cash deposit, collection return

**Fee Payment**:
Settlement type where the shop pays the driver their earned delivery fees (Shop → Driver). Leaves COD balances untouched.
_Avoid_: Salary, wage payment, commission payout

**Net Settlement**:
Settlement type doing both at once: the driver remits the COD total minus their earned fees (still Driver → Shop). Marks both the COD and the fee sides of every order as settled.
_Avoid_: Combined payment, hybrid settlement

### Mechanics

**Payment Record**:
The permanent receipt of a settlement: type, amount, order count, audit attribution. Append-only — no endpoint edits or deletes one.
_Avoid_: Invoice, receipt log

**Server-Authoritative Amount**:
The rule that settlement amounts are never accepted from the caller. The server reads each order's frozen values and computes the total from them.
_Avoid_: Calculated total, auto amount

**Frozen Driver Fee**:
The per-order fee copied onto the order at driver assignment time; later pay-rate changes never touch it. All settlement math runs on these frozen values, so books stay deterministic.
_Avoid_: Current rate, retroactive fee

**Double-Settlement Guard**:
An order can settle once per money kind — once for COD, once for fees. A second attempt naming an already-stamped order is rejected.
_Avoid_: Duplicate check, replay protection

**Pending Settlement Orders**:
Delivered orders of a driver whose COD has not been remitted yet. The pre-settlement review list.
_Avoid_: Unsettled orders, open balance, outstanding deliveries

**Audit Attribution**:
Every Payment Record names who created it, taken from the authenticated user and impossible to override. AI-created settlements record a generic agent identity plus the declared agent name.
_Avoid_: Created by field, user stamp

### Ledger & Balances

**Pending Cash**:
Customer cash a driver has collected but not yet remitted. Held in trust — a liability of the driver. Grows on delivery, shrinks on any COD movement.
_Avoid_: Cash on hand, wallet balance

**Total Earnings**:
Cumulative frozen fees across the driver's delivered orders. A liability of the shop.
_Avoid_: Salary earned, payout balance

**Total Paid**:
Cumulative customer cash the driver has handed back to the shop.
_Avoid_: Payouts received, salary paid

**Fees-Paid Implicit**:
There is no counter for fees already paid; it is derived by subtracting Fee Payment amounts from Total Earnings.
_Avoid_: Fees balance, fees counter

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Driver identity, availability status, vehicle, compensation grid**: `drivers/` folder (a sparse compensation grid silently pays 0)
- **When Pending Cash / Total Earnings grow**: the delivered transition in the Orders context triggers those increments — manual or webhook-driven alike
- **COD Amount composition** (items + delivery fee − discounts): Orders context
- **What the customer pays for delivery**: shipping profiles — customer pricing and driver money are fully decoupled and never reconcile against each other

## Edge Cases

**Eligibility is strict and oddly named**: Every selected order must belong to the driver AND be delivered; anything else surfaces as `ORDER_NOT_FOUND` even when the order merely belongs to another driver.

**Overpayment is impossible by construction**: Since amounts are server-computed from frozen values, no balance-sufficiency check exists — none is needed.

**Net Settlement can land at zero or below**: If frozen fees meet or exceed the COD total, the computed amount goes ≤ 0 with no guard — legal today, worth watching.

**Counters move by COD total, never the net**: Even a Net Settlement adjusts Pending Cash and Total Paid using the full COD sum, not the netted amount.

**History forgives unknown drivers**: Listing payments or pending orders for a nonexistent driver returns an empty list, not an error.

**No currency column exists**: All money is DZD by convention; nothing stores or converts currency.
