# Orders Context

The lifecycle and business rules for cash-on-delivery orders in Algeria.

## Language

### Core Entities

**Order**:
A customer's request to purchase products with payment collected at delivery.
_Avoid_: Purchase, transaction, sale

**Order Number**:
Human-readable identifier shown to customer and merchant (format: `ORD-20260824-0042`).
_Avoid_: Order ID (that's the UUID), reference number

**COD Amount**:
Total cash the courier collects from the customer = product price + delivery fee.
_Avoid_: Total, amount due, collection amount

**Customer**:
The person receiving and paying for the order at their address.
_Avoid_: Client, buyer, end user

### Lifecycle States

**New**:
Order just created, not yet confirmed by merchant.
_Avoid_: Pending, created, draft

**Confirmed**:
Merchant approved the order and will prepare it for delivery.
_Avoid_: Accepted, validated, approved

**Preparing**:
Order confirmed and being prepared by merchant (packing products, quality check).
_Avoid_: In preparation, processing, packing

**Ready**:
Order is prepared and available for assignment or dispatch.
_Avoid_: Prepared, available, staged

**Assigned**:
Order has a driver allocated for manual delivery. This is reached when a driver is assigned to a ready order.
_Avoid_: Allocated, booked

**Note:** Driver assignment sets the `driverId` property and can happen from `ready` status. The `assigned` status indicates the order is with the driver.

**Dispatched**:
Order handed to a delivery company and has a tracking number.
_Avoid_: Shipped, sent, transferred

**Out for Delivery**:
Courier is actively attempting delivery to the customer.
_Avoid_: In transit, en route, delivering

**Delivered**:
Customer received the order and paid the COD amount.
_Avoid_: Completed, fulfilled, closed

**Returned**:
Customer refused the order at the door; products returned to merchant.
_Avoid_: Rejected, cancelled by customer, refunded

**Cancelled**:
Order terminated before delivery (by merchant or system).
_Avoid_: Deleted, voided, rejected

**Unreachable**:
Customer didn't answer phone attempts; order parked for retry.
_Avoid_: No answer, failed contact, suspended

### Delivery Methods

**Manual Delivery**:
Merchant's own driver delivers the order.
_Avoid_: Self-delivery, internal delivery, direct delivery

**Company Delivery**:
Order dispatched to a third-party carrier (NOEST, Yalidine, ZR Express, EcoTrack).
_Avoid_: External delivery, carrier delivery, outsourced

**Stop Desk**:
Customer picks up from a carrier's collection point instead of home delivery.
_Avoid_: Pickup point, collection center, self-pickup

### Operations

**Dispatch**:
The act of creating a shipment with a delivery company via their API.
_Avoid_: Ship, send, transmit

**Tracking Number**:
The carrier's unique identifier for the shipment (e.g., `NE123456789DZ`).
_Avoid_: Waybill number, AWB, shipment ID

**Validation**:
Carrier confirmation that the shipment is accepted and ready for pickup.
_Avoid_: Approval, verification, acceptance

**Bulk Dispatch**:
Creating multiple shipments in one API call (up to 100 orders).
_Avoid_: Batch dispatch, mass dispatch, multi-dispatch

**Driver Assignment**:
Allocating a specific driver to an order for manual delivery.
_Avoid_: Driver allocation, assignment to driver

**Unassignment**:
Removing the driver from an order (allowed until out_for_delivery).
_Avoid_: Deallocation, removal, clearing driver

### Return Scenarios

**Full Return**:
All products in the order were refused by the customer.
_Avoid_: Complete return, total rejection

**Partial Return**:
Customer accepted some products and returned others at the door.
_Avoid_: Split delivery, selective acceptance

**Product Line Return**:
Recording how many units of a specific product were returned.
_Avoid_: Item return, SKU return

### Financial

**Delivery Fee**:
The cost charged to the customer for delivery service.
_Avoid_: Shipping fee, freight charge, transport cost

**Driver Fee**:
The amount paid to the driver for delivering the order.
_Avoid_: Driver commission, delivery payout, driver earnings

**Price**:
Product subtotal excluding the delivery fee.
_Avoid_: Product total, item cost, subtotal

### Algerian Specifics

**Wilaya**:
Algerian province (1-58); determines delivery zones and fees.
_Avoid_: State, region, province

**Commune**:
Municipality within a wilaya; precise delivery destination.
_Avoid_: City, municipality, district

**Home Delivery**:
Delivery to customer's residential address.
_Avoid_: Doorstep delivery, address delivery

**Open at Delivery**:
Cultural practice where customer inspects products before paying.
_Avoid_: COD inspection, delivery inspection

## Edge Cases

**Auto-customer creation**: If `customerId` doesn't exist (walk-in/manual), customer is created automatically using order data.

**Double return safety**: Cancelling or returning an order multiple times is idempotent - inventory restores only once.

**Transition guards**: Status can only move forward in the flow (no delivered → new). System returns allowed transitions on invalid moves.

**Dispatch vs Assignment mutual exclusion**: Orders can be dispatched to a company OR assigned to a driver, never both. Attempting both returns 422.

**Bulk dispatch partial success**: If 5/10 orders dispatch successfully, returns 201 with per-order results (not 400).

**Validation timing**: EcoTrack requires validation before the shipment can progress; NOEST auto-validates on creation.
