The Financial Journey of an Order: A Beginner’s Guide to Cash and Compensation

To the uninitiated, "delivery money" seems like a single figure. In reality, it is a sophisticated flow of data that ensures customers are charged correctly, drivers are paid fairly, and the business remains auditable. This guide explores how an order transforms from a digital request into a final physical payment.


--------------------------------------------------------------------------------


1. The Foundation: Distinguishing the Three Pillars of Delivery Finance

Understanding financial systems requires separating different "buckets" of money. In delivery logistics, we track three distinct perspectives that rarely share the same numbers. These perspectives are computed at different times from different data tables.

The Three Financial Perspectives

Perspective	Owner/Source	Key Question Answered
Customer Delivery Fee	Shop Owner (Shipping Rules)	"What does the customer pay for delivery?"
Driver Compensation	Shop Owner (Per Driver/Wilaya)	"What do I pay this specific driver for this region?"
Driver Payment Record	Settlement Event (Shop & Driver)	"What cash or fees changed hands for specific orders?"

The "So What?": The customer delivery fee and driver compensation are decoupled. For example, a shop might charge a customer 600 DZD for delivery but only pay the driver 350 DZD for that same route. This separation allows for business flexibility and independent margin management.

Now that we understand the separate buckets of money, let's follow a single order as it travels through the system.


--------------------------------------------------------------------------------


2. Phase One: Order Creation and the Initial Calculation

When an order is first created, it enters the new status. At this stage, the system focuses solely on the customer's obligations.

The system calculates the deliveryFee using a rigorous three-step hierarchy:

* Profile Check: The system looks for specific product overrides; if none exist, it reverts to the store default.
* Location Rules: It consults the Wilaya (province) rules and any specific Commune (district) overrides.
* Discounts: Finally, it applies any active "free shipping" offers to the calculated fee.

Once the delivery fee is set, the system calculates the Cash on Delivery (COD) Amount using the following formula:

Items + Delivery Fee - Discounts = COD Amount

At this stage, the order is "driver-agnostic"—no driver has been assigned, and no driver fee has yet been calculated.

The order is now ready, but the most critical financial "lock" hasn't happened yet.


--------------------------------------------------------------------------------


3. Phase Two: The Driver Assignment (The "Financial Freeze")

Once an order moves to the assigned status, the system triggers the assignDriver() query. This is a pivotal moment for the financial integrity of the system, establishing what we call Deterministic Settlement.

The system looks up the specific pay grid for the assigned driver and their location. This value is immediately recorded on the order record as the driverFee.

The Concept of the "Financial Freeze"

When a driver is assigned, their fee is frozen on that specific order. Even if the shop owner changes the driver's pay rate in the settings later that day, the current order retains the original fee. This is intentional: it prevents retroactive price tampering, protects the agreement the driver made when accepting the run, and ensures that the final settlement remains deterministic and auditable.

With the driver locked in and the fee frozen, the order moves to the field.


--------------------------------------------------------------------------------


4. Phase Three: The Moment of Delivery (Updating the Ledger)

When a driver successfully hands a package to a customer, the status flips to delivered. This change triggers Asynchronous Ledger Updates—side-effects that update the driver’s personal financial standing in the system.

To visualize this, imagine a driver named Mohamed who is delivering an order with a 2,000 DZD COD Amount and a 500 DZD Driver Fee.

Mohamed's Ledger: Before vs. After Delivery

Metric	Before Delivery	After Delivery
Total Delivered	0	1
Total Earnings	0 DZD	500 DZD
Pending Cash	0 DZD	2,000 DZD

The "So What?": At this stage, the driver acts as a Bailee, holding the shop's funds in trust. These are strictly ledger updates; no physical money has changed hands between the shop and the driver. The pendingCash represents a liability for the driver, while totalEarnings represents a liability for the shop.

These ledger numbers continue to grow until the reconciliation process, known as "Settling Up," occurs.


--------------------------------------------------------------------------------


5. Phase Four: Settlement (How Physical Money Moves)

Settlement is the process of reconciling the ledger. This is handled by the /api/driver-payments endpoint, which serves as the single source of truth for all money moving between the shop and the driver.

Comparison of Settlement Types

Type	Real-world Meaning	Money Direction	Database Impact
cod_remittance	Driver returns the collected customer cash.	Driver → Shop	Sets codPaymentId
fee_payment	Shop pays the driver their accumulated delivery fees.	Shop → Driver	Sets feePaymentId
net_settlement	Driver returns cash minus their earned fees.	Driver → Shop (Net)	Sets both IDs

The Settlement Sequence

1. Server-Side Validation:
  * The system verifies that every selected order is in the delivered status and belongs to the correct driver.
  * The Double-Settlement Guard: The system checks for existing payment IDs. For COD types, codPaymentId must be NULL. For fee types, feePaymentId must be NULL. This prevents the same order from being settled twice.
2. Execution and Stamping:
  * Amount Computation: The server calculates the total based on the "frozen" fees. For net_settlement, the math is: amount = sum(codAmount) - sum(driverFee).
  * Documentation: A driver_payments record is created.
  * Order Stamping: Orders are updated with the new Payment ID to "lock" them against future settlement attempts.
  * Total Adjustment: For COD movements, the driver's pendingCash is reduced and totalPaid is increased.

The "So What?": Amounts are server-authoritative. Users cannot manually override the amount during settlement. By relying on the frozen values established in Phase Two, the system ensures the books always balance and remain audit-proof.

Understanding how to settle is important, but knowing what is left to settle is the final piece of the puzzle.


--------------------------------------------------------------------------------


6. Phase Five: Monitoring the Balance (The "What's Left" View)

To maintain operational health, shop owners must monitor "unsettled" liability. The system identifies these orders by querying for any order where status = 'delivered' AND codPaymentId IS NULL.

Best Practices for Humans

* [ ] Monitor Coverage: Check the compensationWilayaCount on the driver detail page to ensure you have active pay rules for every region the driver enters.
* [ ] Onboarding: Always add compensation rules before a driver starts a new region. If forgotten, the system defaults the driverFee to 0.
* [ ] Hands-off Ledgers: Never edit "Pending Cash" or "Total Earnings" columns by hand. These are derived values; manual edits will desync the ledger from the auditable order history.
* [ ] Respect the Freeze: Remember that changing a driver's pay rate today will not retroactively change the pay for orders already in the assigned status.

By following this structured path, the complex flow of money becomes a transparent and auditable record.


--------------------------------------------------------------------------------


7. The System Architecture Map (Appendix)

For developers and technical auditors, the following table maps financial logic to the specific files within the system architecture.

Financial Action	Code File Location
Customer Fee Resolution	cod-server/src/endpoints/orders/resolve-fee.ts
Driver Assignment & Fee Freezing	cod-server/src/endpoints/orders/queries.ts (assignDriver)
Asynchronous Ledger Updates	cod-server/src/endpoints/orders/queries.ts (setStatus)
Settlement Logic (Money Movement)	cod-server/src/endpoints/driver-payments/queries.ts
Identifying Unsettled Orders	cod-server/src/endpoints/driver-payments/queries.ts (getPendingSettlementOrders)
End-to-End Test (The Receipts)	cod-server/test-scripts/test-drivers-payments-complete.sh
