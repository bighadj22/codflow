/**
 * Orders Routes
 *
 * CRUD, lifecycle transitions, carrier dispatch, and shipment operations.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

import * as handlers from "./handlers";
import * as statusTransitions from "./status-transitions";
import * as dispatch from "./dispatch";
import * as shipmentOps from "./shipment-operations";

import {
  createOrderSchema,
  updateOrderStatusSchema,
  assignDriverSchema,
  returnOrderProductSchema,
  orderFiltersSchema,
  bulkDispatchSchema,
} from "./validation";

import {
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  ListResponseSchema,
  IdParamSchema,
  OrderListItemSchema,
  OrderDetailSchema,
  OrderCreatedDataSchema,
  ShipmentCreatedDataSchema,
  BulkDispatchDataSchema,
  BulkDispatchResultItemSchema,
  ReturnProductDataSchema,
  CarrierRecordsArraySchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const listOrdersRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "List orders",
  operationId: "listOrders",
  query: orderFiltersSchema,
  responses: {
    200: {
      description:
        "List of orders (each item includes wilaya/commune/driverName joins plus hasReview and lastUpdatedBy)",
      content: jsonContent(ListResponseSchema(OrderListItemSchema)),
    },
  },
  handler: handlers.listOrders,
});

const getOrderRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "Get order",
  description: "Returns full order detail including products and status history.",
  operationId: "getOrder",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Order details",
      content: jsonContent(SuccessResponseSchema(OrderDetailSchema)),
    },
  },
  handler: handlers.getOrder,
});

const createOrderRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.ORDERS_CREATE },
  tags: ["Orders"],
  summary: "Create order",
  description: `Creates a new order.

**Auto-customer creation:** If \`customerId\` is not found in the customers table (e.g. walk-in / manual entry), the customer is automatically created using \`customerName\`, \`phone\`, \`wilayaId\`, and \`address\`. Pass a client-generated UUID (e.g. \`crypto.randomUUID()\`) as \`customerId\` in this case.

**Inventory:** Products with \`trackInventory\` enabled will have their stock decremented automatically.

**Delivery fee:** auto-resolved from shipping profiles for online orders; offline/dashboard orders may pass an explicit \`deliveryFee\` override.

**companyId:** If provided, the delivery company must exist — returns 404 if not found.`,
  operationId: "createOrder",
  body: createOrderSchema,
  responses: {
    201: {
      description: "Order created successfully",
      content: jsonContent(SuccessWithMessageSchema(OrderCreatedDataSchema)),
    },
    404: {
      description: "Delivery company not found when companyId provided",
    },
  },
  handler: handlers.createOrder,
});

const deleteOrderRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.ORDERS_DELETE },
  tags: ["Orders"],
  summary: "Delete order",
  description:
    "Permanently deletes the order and all child records (order products, shipments) from the database.",
  operationId: "deleteOrder",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Order deleted",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: handlers.deleteOrder,
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const updateStatusRoute = defineRoute({
  method: "patch",
  path: "/{id}/status",
  auth: { scope: SCOPES.ORDERS_UPDATE },
  tags: ["Orders"],
  summary: "Update order status",
  description: `Updates the order status and appends a record to status history.

**Main flow:** \`new\` → \`confirmed\` → \`preparing\` → \`ready\` → (\`assigned\` | \`dispatched\`) → \`out_for_delivery\` → \`delivered\` / \`returned\`

**Branching statuses:**
- \`unreachable\`: customer didn't answer — parks the order. Can retry back to \`confirmed\` or cancel

**Transition guard:** Only forward moves in the flow are accepted. Invalid moves (e.g. \`delivered → new\`, \`cancelled → preparing\`) return \`400 INVALID_STATUS_TRANSITION\` with the list of allowed next statuses.

**Side effects:**
- **delivered**: sets \`deliveryTime\`; increments driver's \`totalDelivered\` and \`totalEarnings\` if assigned
- **cancelled / returned**: restores inventory for products with \`trackInventory\` enabled (double-cancel/return is safe)
- **delivered**: fires the Meta CAPI Purchase workflow when the store has tracking enabled`,
  operationId: "updateOrderStatus",
  params: IdParamSchema,
  body: updateOrderStatusSchema,
  responses: {
    200: {
      description: "Status updated",
      content: jsonContent(MessageResponseSchema),
    },
    400: {
      description:
        "Unknown status value (VALIDATION_FAILED) or transition not allowed by the flow guard (INVALID_STATUS_TRANSITION with currentStatus/targetStatus/allowedTransitions context)",
    },
  },
  handler: statusTransitions.updateStatus,
});

const assignDriverRoute = defineRoute({
  method: "patch",
  path: "/{id}/assign-driver",
  auth: { scope: SCOPES.ORDERS_ASSIGN },
  tags: ["Orders"],
  summary: "Assign driver to order",
  description: `Assigns a driver for manual delivery.

**Business rules — returns 422 if:**
- The order already has a tracking number (dispatched to a company)
- The order's \`deliveryMethod\` is \`"company"\`
- The order status is \`out_for_delivery\`, \`delivered\`, \`returned\`, or \`cancelled\`
- The driver does not exist (404)`,
  operationId: "assignDriver",
  params: IdParamSchema,
  body: assignDriverSchema,
  responses: {
    200: {
      description: "Driver assigned",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "Business rule violation — already dispatched / company-assigned / locked status",
    },
  },
  handler: statusTransitions.assignDriver,
});

const unassignDriverRoute = defineRoute({
  method: "patch",
  path: "/{id}/unassign",
  auth: { scope: SCOPES.ORDERS_ASSIGN },
  tags: ["Orders"],
  summary: "Unassign driver from order",
  description: `Removes the driver currently assigned to an order. Clears driverId and driverFee, resets deliveryMethod to "unassigned", and rolls the status back from "assigned" → "ready" when applicable.

**Rejected when:**
- order has no driver assigned
- order has already progressed past dispatch (out_for_delivery, delivered, returned, cancelled) — at that point clearing the driver would erase payroll/handoff history.`,
  operationId: "unassignDriver",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Driver unassigned",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description: "Order has no driver assigned, or status is locked",
    },
  },
  handler: statusTransitions.unassignDriver,
});

const returnOrderProductRoute = defineRoute({
  method: "patch",
  path: "/{id}/products/{productLineId}/return",
  auth: { scope: SCOPES.ORDERS_UPDATE },
  tags: ["Orders"],
  summary: "Record a product line return",
  description: `Records how many units on a single order line the customer refused at the door. Used for the Algerian "open the box at delivery" workflow where a customer may accept part of an order and return the rest.

The server computes the line status ("fulfilled" | "partially_returned" | "returned") from returnedQuantity vs. the line quantity, restocks the delta (repeated calls are idempotent), and logs an ORDER_RETURNED stock movement.

Rejected with 422 while the overall order is already \`returned\` or \`cancelled\` — stock was already reconciled.`,
  operationId: "returnOrderProduct",
  params: IdParamSchema.extend({
    productLineId: z.string().openapi({ description: "Order product line ID" }),
  }),
  body: returnOrderProductSchema,
  responses: {
    200: {
      description: "Return recorded",
      content: jsonContent(SuccessWithMessageSchema(ReturnProductDataSchema)),
    },
    400: {
      description: "Validation error (VALIDATION_FAILED / VALUE_OUT_OF_RANGE)",
    },
    422: {
      description:
        "Order is in a terminal state (returned/cancelled) — returns already reconciled",
    },
  },
  handler: handlers.returnOrderProduct,
});

// ─── Carrier dispatch ─────────────────────────────────────────────────────────

const bulkDispatchRoute = defineRoute({
  method: "post",
  path: "/bulk-dispatch",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Bulk dispatch orders to a delivery company",
  description: `Dispatch multiple existing orders to a delivery company in one API call using the provider's bulk creation endpoint (up to 100 orders per request).

⚠️ Provider support: ecotrack adapter implemented (Packers' bulk endpoint currently returns 500 — confirmed server-side bug); others return OPERATION_NOT_SUPPORTED.

Per-order results are returned; partial success is possible (HTTP 201 when at least one order dispatched, 400 when none did).`,
  operationId: "bulkDispatch",
  body: bulkDispatchSchema,
  responses: {
    201: {
      description: "Bulk dispatch executed (at least one order dispatched)",
      content: jsonContent(SuccessWithMessageSchema(BulkDispatchDataSchema)),
    },
    400: {
      description:
        "Validation error, or no valid orders to dispatch (returns per-order results)",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          message: z.string(),
          results: z.array(BulkDispatchResultItemSchema).optional(),
        })
      ),
    },
    422: {
      description: "Provider does not support bulk creation (OPERATION_NOT_SUPPORTED)",
    },
  },
  handler: dispatch.bulkDispatch,
});

const dispatchToCompanyRoute = defineRoute({
  method: "post",
  path: "/{id}/dispatch",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Dispatch order to delivery company",
  description: `Creates a shipment via the assigned delivery company's API (NOEST, ZR Express, Yalidine, Packers/EcoTrack).

**What happens:**
1. Validates business rules (not already dispatched, wilaya + commune set, station code for stop-desk)
2. Calls the provider adapter to create the shipment
3. Records the tracking number on the order
4. Auto-validates where supported (NOEST) — advances status to out_for_delivery; otherwise status becomes dispatched
5. Logs the API call for audit

**Body fields are all optional** — they override values stored on the order.`,
  operationId: "dispatchToCompany",
  params: IdParamSchema,
  body: z.object({
    companyId: z.string().optional().openapi({
      description: "Override the order's assigned company",
    }),
    stationCode: z.string().optional().openapi({
      description: "Stop-desk station code. Required when deliveryType is stop_desk",
    }),
    remarks: z.string().optional().openapi({
      description: "Delivery remarks passed to the provider",
    }),
    weight: z.number().optional().openapi({
      description: "Parcel weight in kg override",
    }),
    fragile: z.boolean().optional().openapi({
      description: "Fragile parcel flag override",
    }),
  }),
  responses: {
    201: {
      description: "Shipment created successfully",
      content: jsonContent(SuccessWithMessageSchema(ShipmentCreatedDataSchema)),
    },
    400: {
      description:
        "Validation error — no delivery company, missing wilaya/commune, or missing station code",
    },
    422: {
      description:
        "Already dispatched (ORDER_ALREADY_DISPATCHED), driver assigned (DRIVER_ALREADY_ASSIGNED), inactive company, unsupported provider, or shipment creation failed (SHIPMENT_CREATION_FAILED)",
    },
  },
  handler: dispatch.dispatchToCompany,
});

const validateShipmentRoute = defineRoute({
  method: "post",
  path: "/{id}/validate-shipment",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Manually validate a dispatched shipment",
  description: `Manually validate a dispatched order at the carrier API. Only meaningful when company.auto_validate=false (e.g. Packers). Advances status dispatched → out_for_delivery.`,
  operationId: "validateShipmentManually",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Shipment validated — order is now out for delivery",
      content: jsonContent(MessageResponseSchema),
    },
    400: {
      description: "Carrier validation returned false",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: false }),
          message: z.string(),
        })
      ),
    },
    422: {
      description:
        "Order not in dispatched state (INVALID_STATUS_TRANSITION), inactive company, unsupported provider, or external API error (502 EXTERNAL_API_ERROR)",
    },
    500: {
      description: "External API error",
    },
  },
  handler: dispatch.validateShipmentManually,
});

// ─── Shipment operations ──────────────────────────────────────────────────────

const updateShipmentRoute = defineRoute({
  method: "patch",
  path: "/{id}/update-shipment",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Update shipment info at carrier",
  description: `Updates an existing shipment at the carrier API: customer info, COD amount, delivery preferences (fragile, weight, remarks). Changed fields sync back to the database.

All fields are optional — omitted fields use current order values. EcoTrack requires ALL fields on every update call, so the server pre-fills from the order record and applies overrides. The COD amount sent to the carrier defaults to the order's COD total (price + delivery fee); an explicit \`amount\` overrides it and syncs back onto the order's price.

**Update restrictions:** EcoTrack-family orders can only be updated before validation (status \`dispatched\`). NOEST rejects after validation; Yalidine after label print. ZR Express addresses parcels by internal parcel UUID.

**Returns 422** when there is no tracking number, the provider doesn't support updates, or the EcoTrack pre-validation guard trips. External carrier failures surface as 502 EXTERNAL_API_ERROR.`,
  operationId: "updateShipmentInfo",
  params: IdParamSchema,
  body: z.object({
    customerName: z.string().optional().openapi({ description: "Customer full name" }),
    phone: z.string().optional().openapi({
      description: "Algerian mobile number",
      example: "0551234567",
    }),
    phone2: z.string().optional().openapi({ description: "Secondary phone number" }),
    address: z.string().optional().openapi({ description: "Delivery address" }),
    commune: z.string().optional().openapi({
      description:
        "Commune name in French (required by Packers on every call — server pre-fills)",
    }),
    wilayaId: z.number().int().min(1).max(58).optional(),
    amount: z.number().positive().optional().openapi({
      description: "COD amount to collect",
    }),
    remarks: z.string().optional().openapi({ description: "Delivery remarks/notes" }),
    fragile: z.boolean().optional(),
    weight: z.number().min(0).optional().openapi({
      description: "Package weight in kg",
    }),
  }),
  responses: {
    200: {
      description: "Shipment updated successfully",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "No tracking number, provider does not support updates, or EcoTrack pre-validation guard tripped",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.updateShipmentInfo,
});

const cancelShipmentRoute = defineRoute({
  method: "post",
  path: "/{id}/cancel-shipment",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Cancel shipment at carrier",
  description: `Deletes/cancels a shipment at the carrier API (before validation only). On success: clears the tracking number from the order and resets status to "ready" so it can be re-dispatched.

Uses POST (not DELETE) to avoid routing ambiguity with DELETE /orders/{id}.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "cancelShipment",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Shipment cancelled — order reset to ready",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "No tracking number (REQUIRED_FIELD_MISSING), or provider does not support cancelling (OPERATION_NOT_SUPPORTED)",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.cancelShipment,
});

const addRemarkRoute = defineRoute({
  method: "post",
  path: "/{id}/add-remark",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Add remark to shipment at carrier",
  description: `Adds a remark/note to the shipment at the carrier API. Works at any time after dispatch; visible to carrier and sender.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "addShipmentRemark",
  params: IdParamSchema,
  body: z.object({
    content: z.string().min(1).openapi({
      description: "Remark text shown to the carrier and courier",
      example: "Appeler le client 30 minutes avant",
    }),
  }),
  responses: {
    200: {
      description: "Remark added",
      content: jsonContent(MessageResponseSchema),
    },
    400: {
      description: "Missing or empty remark content (REQUIRED_FIELD_MISSING)",
    },
    422: {
      description: "No tracking number, or provider does not support remarks",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.addShipmentRemark,
});

const getRemarksRoute = defineRoute({
  method: "get",
  path: "/{id}/remarks",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "Fetch shipment remarks from carrier",
  description: `Fetches the list of remarks/notes for a shipment from the carrier API — entries from both sender and courier/driver.

Provider support: ecotrack ✅ (GET /api/v1/get/maj) | NOEST ❌ | Yalidine ❌ | ZR Express ❌.`,
  operationId: "getShipmentRemarks",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Remarks fetched successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CarrierRecordsArraySchema,
        })
      ),
    },
    422: {
      description: "No tracking number, or provider does not support fetching remarks",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.getShipmentRemarks,
});

const getTrackingRoute = defineRoute({
  method: "get",
  path: "/{id}/tracking-events",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "Fetch tracking history from carrier",
  description: `Fetches the full chronological tracking history for a shipment from the carrier API (pickup, hub reception, transit, delivery attempts, delivered/returned).

Provider support: all four ✅ (ecotrack, noest, yalidine, zr_express).`,
  operationId: "getShipmentTracking",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Tracking events fetched successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CarrierRecordsArraySchema,
        })
      ),
    },
    422: {
      description: "No tracking number, or provider does not support live tracking",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.getShipmentTracking,
});

const proxyLabelRoute = defineRoute({
  method: "get",
  path: "/{id}/label",
  auth: { scope: SCOPES.ORDERS_READ },
  tags: ["Orders"],
  summary: "Proxy shipment label PDF from carrier",
  description: `Proxies the shipment label PDF from the carrier API. Carrier label URLs require a Bearer token and are not publicly accessible — this endpoint fetches server-side (with the stored token, or a fresh SAS URL for ZR Express) and streams the PDF to the client.

Returns application/pdf with Content-Disposition: inline.`,
  operationId: "proxyShipmentLabel",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Label PDF stream",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary", type: "string" }),
        },
      },
    },
    422: {
      description:
        "No tracking number, no API token configured (MISSING_API_CREDENTIALS), or label not yet available",
    },
    500: {
      description: "Failed to fetch label from carrier (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.proxyShipmentLabel,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const askReturnRoute = defineRoute({
  method: "post",
  path: "/{id}/ask-return",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Ask carrier to return the parcel",
  description: `Requests a parcel return at the carrier API (EcoTrack: POST /api/v1/ask/for/order/return). This is a REQUEST, not a state change — the courier may take up to a day to action it and can decline (platform-documented), so the order stays out_for_delivery until the return is confirmed.

Only callable while the order is out_for_delivery. Carrier error 10003 (not returnable) surfaces as 502 EXTERNAL_API_ERROR.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "askShipmentReturn",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Return requested at the carrier",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "No tracking number, order not out_for_delivery, or provider does not support return requests",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.askShipmentReturn,
});

const confirmReturnReceptionRoute = defineRoute({
  method: "post",
  path: "/{id}/confirm-return-reception",
  auth: { scope: SCOPES.DELIVERY_DISPATCH },
  tags: ["Orders"],
  summary: "Confirm return reception at carrier",
  description: `Confirms at the carrier that the merchant physically received the returned parcel (EcoTrack: POST /api/v1/valid/returns), then moves the order to "returned" through the normal status path (inventory restore, customer stats, history).

Forward-only: only callable from out_for_delivery. If the carrier reports nothing eligible (already confirmed, or parcel not in a return state), returns 422 without touching the order.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "confirmReturnReception",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Return reception confirmed — order marked returned",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "No tracking number, order not out_for_delivery, provider unsupported, or carrier reports nothing eligible for confirmation",
    },
    500: {
      description: "External API error (EXTERNAL_API_ERROR)",
    },
  },
  handler: shipmentOps.confirmReturnReception,
});

// IMPORTANT: /bulk-dispatch must come before /{id} routes — otherwise
// "bulk-dispatch" would be captured as an id param.
const router = new OpenAPIHono<AppContext>();

router.openapi(listOrdersRoute.route, listOrdersRoute.handler);
router.openapi(bulkDispatchRoute.route, bulkDispatchRoute.handler);

router.openapi(getOrderRoute.route, getOrderRoute.handler);
router.openapi(createOrderRoute.route, createOrderRoute.handler);
router.openapi(deleteOrderRoute.route, deleteOrderRoute.handler);
router.openapi(updateStatusRoute.route, updateStatusRoute.handler);
router.openapi(assignDriverRoute.route, assignDriverRoute.handler);
router.openapi(unassignDriverRoute.route, unassignDriverRoute.handler);
router.openapi(returnOrderProductRoute.route, returnOrderProductRoute.handler);
router.openapi(dispatchToCompanyRoute.route, dispatchToCompanyRoute.handler);
router.openapi(validateShipmentRoute.route, validateShipmentRoute.handler);
router.openapi(updateShipmentRoute.route, updateShipmentRoute.handler);
router.openapi(cancelShipmentRoute.route, cancelShipmentRoute.handler);
router.openapi(askReturnRoute.route, askReturnRoute.handler);
router.openapi(confirmReturnReceptionRoute.route, confirmReturnReceptionRoute.handler);
router.openapi(addRemarkRoute.route, addRemarkRoute.handler);
router.openapi(getRemarksRoute.route, getRemarksRoute.handler);
router.openapi(getTrackingRoute.route, getTrackingRoute.handler);
router.openapi(proxyLabelRoute.route, proxyLabelRoute.handler);

export default router;
