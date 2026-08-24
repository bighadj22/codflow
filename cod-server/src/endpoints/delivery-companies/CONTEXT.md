# Delivery Context

How CodFlow hands orders to third-party carriers in Algeria: company connections, shipment creation and validation, tracking, and stop-desk pickup.

## Language

### Carrier Setup

**Delivery Company**:
A third-party carrier connected via API (Yalidine, NOEST, ZR Express, Packers/EcoTrack). Stores API credentials and capabilities only — never prices. What the customer pays comes from shipping rules; what the carrier invoices is settled out-of-band.
_Avoid_: Shipper, logistics partner, courier account

**Company Code**:
Short lowercase unique identifier selecting the integration adapter (`yalidine`, `noest`, `zr_express`, `ecotrack`).
_Avoid_: Provider slug, brand name, company slug

**EcoTrack Family**:
Companies running on the EcoTrack platform — code is `ecotrack` or ends in `_ecotrack` (e.g. `packers_ecotrack`). One shared adapter; defaults to manual validation.
_Avoid_: Packers (that is one member of the family), ecotrack carriers

**Connection**:
API credentials stored for a company. Credentials are write-only — responses expose `isConnected`, never the tokens themselves.
_Avoid_: Linked, paired, activated

**Auto-Validate**:
Company setting deciding what happens immediately after Dispatch: `true` = Validation runs at once (order advances Out for Delivery, parcel becomes Locked at Carrier); `false` = parcel waits as Dispatched until someone performs Manual Validation.
_Avoid_: Auto-confirm, auto-approve, instant validation

**Locked at Carrier**:
Carrier-side state after Validation where edits and deletes are refused. Refusal style varies: EcoTrack silently ignores late updates, NOEST and Yalidine reject them outright.
_Avoid_: Frozen, immutable, read-only

### Stop Desks

**Stop Desk Sync**:
Explicit admin action pulling desks from the carrier API into the local cache. Reads never call the carrier live; desks that disappeared at the carrier are deleted on the next sync.
_Avoid_: Import, refresh, live lookup

**Station Code**:
Carrier-specific identifier of a pickup desk, required on every stop-desk dispatch (postal code for EcoTrack, station code for NOEST, center id for Yalidine, territory UUID for ZR Express).
_Avoid_: Desk ID, branch code, office number

### Shipment Lifecycle

**Shipment Record**:
The carrier-side handle persisted at dispatch: tracking number, label URL, validated flag. Carries deliberately no status — the Order owns the lifecycle.
_Avoid_: Parcel record, delivery record

**Manual Validation**:
A team member confirming a dispatched parcel at the carrier. Only meaningful when Auto-Validate is false; moves the order Dispatched → Out for Delivery.
_Avoid_: Approve shipment, confirm dispatch

**Update at Carrier**:
Editing shipment details (customer info, COD amount) before Validation; changed fields sync back onto the order record.
_Avoid_: Edit shipment, modify parcel

**Cancel Shipment**:
Deleting the parcel at the carrier before Validation. Clears the tracking number and resets the order to Ready so it can be dispatched again. Not the same as cancelling the Order.
_Avoid_: Cancel order, void shipment

**Deferred Label**:
Placeholder stored when the carrier returns no label URL at creation (ZR Express exposes labels later via short-lived signed URLs); the real PDF is resolved through the label proxy on demand.
_Avoid_: Missing label, pending label

**Remark**:
Note attached to the shipment at the carrier, visible to carrier and sender, permitted any time after dispatch. Only EcoTrack truly supports remarks; Yalidine and ZR Express adapters are documented no-op stubs.
_Avoid_: Note, comment

### Tracking

**Tracking Events**:
Chronological carrier history (pickup, hub reception, transit, attempts, terminal state) pulled on demand. All four providers support pulls; only Yalidine and ZR Express push inbound webhooks.
_Avoid_: Live tracking, tracking feed

**Delivery Attempts**:
Count of failed doorstep attempts (Yalidine's failed-attempt event). The order stays Out for Delivery; only the counter moves.
_Avoid_: Failed deliveries, retries

**Status Mapping**:
Translation of carrier state names into CodFlow order statuses. Yalidine uses a fixed system-wide French enum; ZR Express state names are free text, so admins layer custom mappings over a small default set.
_Avoid_: Translation table, sync rules

**Regression Guard**:
Webhook-driven status changes can only advance an order forward through ranked statuses — never backward. Delivered, Returned, Cancelled are terminal ranks.
_Avoid_: Rollback protection

**Return Signal**:
ZR Express's `isReturn` flag — that carrier's only fully reliable terminal signal, hardcoded to Returned and bypassing all Status Mapping.
_Avoid_: Return event, RMA

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Dispatch, Tracking Number, Bulk Dispatch, order statuses** (Ready, Dispatched, Out for Delivery, …): Orders context (`orders/`)
- **Driver Assignment, Manual Delivery**: Orders context; driver records themselves live in `drivers/`
- **Settlement, COD Remittance, Pending Cash**: Payments context (`driver-payments/`)
- **Delivery Fee resolution, Shipping Profile, Wilaya/Commune reference data**: `shipping-profiles/` and `wilayas/` — carriers never price a delivery

## Edge Cases

**Mutual exclusion**: Company dispatch and driver assignment are exclusive; each side blocks the other.

**Re-dispatch guard**: Dispatching again is blocked while a tracking number exists; Cancel Shipment clears it and reopens the order.

**Validation failure ≠ dispatch failure**: If auto-validation errors after the parcel was created, the dispatch still succeeded — the failure is logged and the order advances anyway.

**Bulk dispatch partial success**: Some parcels failing inside a bulk call is a normal outcome reported per order; only total failure is an error.

**Stop desk needs a station**: A stop-desk order without a Station Code is rejected before any carrier call.

**Deletion guards**: Companies with live (non-terminal) orders cannot be deleted; the same protection applies to drivers with active orders.

**Webhook contract**: Receivers always answer 200 and deduplicate per event id; unrecognized states are logged as unmapped — never guessed.
