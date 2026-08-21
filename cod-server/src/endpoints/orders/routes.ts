/**
 * Orders Routes
 *
 * Order CRUD, lifecycle transitions, driver assignment, carrier dispatch
 * (single + bulk), and post-dispatch shipment operations. Handlers live in
 * focused modules: handlers.ts (CRUD/returns), status-transitions.ts,
 * dispatch.ts, shipment-operations.ts.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 *
 * ⚠️ Route order matters: "/bulk-dispatch" is registered before "/{id}"
 * routes so it never matches as an order ID.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import * as statusTransitions from "./status-transitions";
import * as dispatch from "./dispatch";
import * as shipmentOps from "./shipment-operations";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  assignDriverSchema,
  returnOrderProductSchema,
  orderFiltersSchema,
  bulkDispatchSchema,
} from "./validation";
import {
  OrderSchema,
  ErrorResponseSchema,
  ListResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Order ID" }),
});

const notFoundResponse = errorResponse("Order not found (ORDER_NOT_FOUND)");

const messageResponse = jsonContent(
  z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string(),
  })
);

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const listOrdersRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "List orders",
  operationId: "listOrders",
  request: {
    query: orderFiltersSchema,
  },
  responses: {
    200: {
      description:
        "List of orders (each item includes wilaya/commune/driverName joins plus hasReview and lastUpdatedBy)",
      content: jsonContent(ListResponseSchema(OrderSchema)),
    },
    400: errorResponse("Invalid query parameter — e.g. unknown status value (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getOrderRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "Get order",
  description: "Returns full order detail including products and status history.",
  operationId: "getOrder",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Order details",
      content: jsonContent(SuccessResponseSchema(OrderSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:read scope"),
    404: notFoundResponse,
  },
  security: [{ ApiKeyAuth: [] }],
});

const createOrderRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.ORDERS_CREATE)],
  tags: ["Orders"],
  summary: "Create order",
  description: `Creates a new order.

**Auto-customer creation:** If \`customerId\` is not found in the customers table (e.g. walk-in / manual entry), the customer is automatically created using \`customerName\`, \`phone\`, \`wilayaId\`, and \`address\`. Pass a client-generated UUID (e.g. \`crypto.randomUUID()\`) as \`customerId\` in this case.

**Inventory:** Products with \`trackInventory\` enabled will have their stock decremented automatically.

**Delivery fee:** auto-resolved from shipping profiles for online orders; offline/dashboard orders may pass an explicit \`deliveryFee\` override.

**companyId:** If provided, the delivery company must exist — returns 404 if not found.`,
  operationId: "createOrder",
  request: {
    body: {
      required: true,
      content: jsonContent(createOrderSchema),
    },
  },
  responses: {
    201: {
      description: "Order created successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            id: z.string().openapi({ description: "Newly created order ID" }),
            orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
            deliveryFee: z.number().openapi({
              description: "Calculated delivery fee (from shipping profile or admin override)",
              example: 600,
            }),
            price: z.number().openapi({
              description: "Product subtotal (excluding delivery fee)",
              example: 2500,
            }),
            codAmount: z.number().openapi({
              description: "Total amount to collect (price + deliveryFee)",
              example: 3100,
            }),
            customerId: z.string(),
            customerName: z.string(),
            phone: z.string(),
            wilayaId: z.number().int(),
            communeId: z.string().nullable(),
            deliveryType: z.enum(["home", "stop_desk"]),
            orderType: z.enum(["online", "offline"]),
            status: z.string().openapi({ description: "Initial order status", example: "new" }),
          }),
          message: z.string().openapi({ example: "Order created successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:create scope"),
    404: errorResponse("Delivery company not found when companyId provided"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteOrderRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.ORDERS_DELETE)],
  tags: ["Orders"],
  summary: "Delete order",
  description:
    "Permanently deletes the order and all child records (order products, shipments) from the database.",
  operationId: "deleteOrder",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Order deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Order deleted" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:delete scope"),
    404: notFoundResponse,
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const updateStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  middleware: [requireScope(SCOPES.ORDERS_UPDATE)],
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
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(updateOrderStatusSchema),
    },
  },
  responses: {
    200: {
      description: "Status updated",
      content: messageResponse,
    },
    400: errorResponse(
      "Unknown status value (VALIDATION_FAILED) or transition not allowed by the flow guard (INVALID_STATUS_TRANSITION with currentStatus/targetStatus/allowedTransitions context)"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:update scope"),
    404: notFoundResponse,
  },
  security: [{ ApiKeyAuth: [] }],
});

const assignDriverRoute = createRoute({
  method: "patch",
  path: "/{id}/assign-driver",
  middleware: [requireScope(SCOPES.ORDERS_ASSIGN)],
  tags: ["Orders"],
  summary: "Assign driver to order",
  description: `Assigns a driver for manual delivery.

**Business rules — returns 422 if:**
- The order already has a tracking number (dispatched to a company)
- The order's \`deliveryMethod\` is \`"company"\`
- The order status is \`out_for_delivery\`, \`delivered\`, \`returned\`, or \`cancelled\`
- The driver does not exist (404)`,
  operationId: "assignDriver",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(assignDriverSchema),
    },
  },
  responses: {
    200: {
      description: "Driver assigned",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Driver assigned successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:assign scope"),
    404: errorResponse("Order or driver not found"),
    422: errorResponse("Business rule violation — already dispatched / company-assigned / locked status"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const unassignDriverRoute = createRoute({
  method: "patch",
  path: "/{id}/unassign",
  middleware: [requireScope(SCOPES.ORDERS_ASSIGN)],
  tags: ["Orders"],
  summary: "Unassign driver from order",
  description: `Removes the driver currently assigned to an order. Clears driverId and driverFee, resets deliveryMethod to "unassigned", and rolls the status back from "assigned" → "ready" when applicable.

**Rejected when:**
- order has no driver assigned
- order has already progressed past dispatch (out_for_delivery, delivered, returned, cancelled) — at that point clearing the driver would erase payroll/handoff history.`,
  operationId: "unassignDriver",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Driver unassigned",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Driver unassigned" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:assign scope"),
    404: notFoundResponse,
    422: errorResponse("Order has no driver assigned, or status is locked"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const returnOrderProductRoute = createRoute({
  method: "patch",
  path: "/{id}/products/{productLineId}/return",
  middleware: [requireScope(SCOPES.ORDERS_UPDATE)],
  tags: ["Orders"],
  summary: "Record a product line return",
  description: `Records how many units on a single order line the customer refused at the door. Used for the Algerian "open the box at delivery" workflow where a customer may accept part of an order and return the rest.

The server computes the line status ("fulfilled" | "partially_returned" | "returned") from returnedQuantity vs. the line quantity, restocks the delta (repeated calls are idempotent), and logs an ORDER_RETURNED stock movement.

Rejected with 422 while the overall order is already \`returned\` or \`cancelled\` — stock was already reconciled.`,
  operationId: "returnOrderProduct",
  request: {
    params: idParams.extend({
      productLineId: z.string().openapi({ description: "Order product line ID" }),
    }),
    body: {
      required: true,
      content: jsonContent(returnOrderProductSchema),
    },
  },
  responses: {
    200: {
      description: "Return recorded",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            returnedQuantity: z.number().int(),
            status: z.enum(["fulfilled", "partially_returned", "returned"]),
          }),
          message: z.string().openapi({ example: "Return recorded" }),
        })
      ),
    },
    400: errorResponse("Validation error (VALIDATION_FAILED / VALUE_OUT_OF_RANGE)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:update scope"),
    404: notFoundResponse,
    422: errorResponse("Order is in a terminal state (returned/cancelled) — returns already reconciled"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Carrier dispatch ─────────────────────────────────────────────────────────

const bulkDispatchRoute = createRoute({
  method: "post",
  path: "/bulk-dispatch",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
  tags: ["Orders"],
  summary: "Bulk dispatch orders to a delivery company",
  description: `Dispatch multiple existing orders to a delivery company in one API call using the provider's bulk creation endpoint (up to 100 orders per request).

⚠️ Provider support: ecotrack adapter implemented (Packers' bulk endpoint currently returns 500 — confirmed server-side bug); others return OPERATION_NOT_SUPPORTED.

Per-order results are returned; partial success is possible (HTTP 201 when at least one order dispatched, 400 when none did).`,
  operationId: "bulkDispatch",
  request: {
    body: {
      required: true,
      content: jsonContent(bulkDispatchSchema),
    },
  },
  responses: {
    201: {
      description: "Bulk dispatch executed (at least one order dispatched)",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          message: z.string(),
          data: z.object({
            results: z.array(
              z.object({
                orderId: z.string(),
                orderNumber: z.string().optional(),
                trackingNumber: z.string().optional(),
                labelUrl: z.string().optional(),
                error: z.string().optional(),
              })
            ),
          }),
        })
      ),
    },
    400: {
      description:
        "Validation error, or no valid orders to dispatch (returns per-order results)",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          message: z.string(),
          results: z
            .array(
              z.object({
                orderId: z.string(),
                orderNumber: z.string().optional(),
                trackingNumber: z.string().optional(),
                labelUrl: z.string().optional(),
                error: z.string().optional(),
              })
            )
            .optional(),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Delivery company not found"),
    422: errorResponse("Provider does not support bulk creation (OPERATION_NOT_SUPPORTED)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const dispatchToCompanyRoute = createRoute({
  method: "post",
  path: "/{id}/dispatch",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
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
  request: {
    params: idParams,
    body: {
      required: false,
      content: jsonContent(
        z.object({
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
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Shipment created successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            shipmentId: z.string().openapi({ description: "Internal shipment record ID" }),
            trackingNumber: z.string().openapi({ example: "NE123456789DZ" }),
            labelUrl: z.string().nullable().openapi({
              description: "PDF label URL, if provided by the company",
            }),
          }),
          message: z.string().openapi({ example: "Shipment created successfully" }),
        })
      ),
    },
    400: errorResponse(
      "Validation error — no delivery company, missing wilaya/commune, or missing station code"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse(
      "Already dispatched (ORDER_ALREADY_DISPATCHED), driver assigned (DRIVER_ALREADY_ASSIGNED), inactive company, unsupported provider, or shipment creation failed (SHIPMENT_CREATION_FAILED)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const validateShipmentRoute = createRoute({
  method: "post",
  path: "/{id}/validate-shipment",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
  tags: ["Orders"],
  summary: "Manually validate a dispatched shipment",
  description: `Manually validate a dispatched order at the carrier API. Only meaningful when company.auto_validate=false (e.g. Packers). Advances status dispatched → out_for_delivery.`,
  operationId: "validateShipmentManually",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Shipment validated — order is now out for delivery",
      content: messageResponse,
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
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse(
      "Order not in dispatched state (INVALID_STATUS_TRANSITION), inactive company, unsupported provider, or external API error (502 EXTERNAL_API_ERROR)"
    ),
    500: errorResponse("External API error"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Shipment operations ──────────────────────────────────────────────────────

const updateShipmentRoute = createRoute({
  method: "patch",
  path: "/{id}/update-shipment",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
  tags: ["Orders"],
  summary: "Update shipment info at carrier",
  description: `Updates an existing shipment at the carrier API: customer info, COD amount, delivery preferences (fragile, weight, remarks). Changed fields sync back to the database.

All fields are optional — omitted fields use current order values. EcoTrack requires ALL fields on every update call, so the server pre-fills from the order record and applies overrides.

**Update restrictions:** EcoTrack-family orders can only be updated before validation (status \`dispatched\`). NOEST rejects after validation; Yalidine after label print. ZR Express addresses parcels by internal parcel UUID.

**Returns 422** when there is no tracking number, the provider doesn't support updates, or the EcoTrack pre-validation guard trips. External carrier failures surface as 502 EXTERNAL_API_ERROR.`,
  operationId: "updateShipmentInfo",
  request: {
    params: idParams,
    body: {
      required: false,
      content: jsonContent(
        z.object({
          customerName: z.string().optional().openapi({ description: "Customer full name" }),
          phone: z.string().optional().openapi({
            description: "Algerian mobile number",
            example: "0551234567",
          }),
          phone2: z.string().optional().openapi({ description: "Secondary phone number" }),
          address: z.string().optional().openapi({ description: "Delivery address" }),
          commune: z.string().optional().openapi({
            description: "Commune name in French (required by Packers on every call — server pre-fills)",
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
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Shipment updated successfully",
      content: messageResponse,
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse(
      "No tracking number, provider does not support updates, or EcoTrack pre-validation guard tripped"
    ),
    500: errorResponse("External API error (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const cancelShipmentRoute = createRoute({
  method: "post",
  path: "/{id}/cancel-shipment",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
  tags: ["Orders"],
  summary: "Cancel shipment at carrier",
  description: `Deletes/cancels a shipment at the carrier API (before validation only). On success: clears the tracking number from the order and resets status to "ready" so it can be re-dispatched.

Uses POST (not DELETE) to avoid routing ambiguity with DELETE /orders/{id}.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "cancelShipment",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Shipment cancelled — order reset to ready",
      content: messageResponse,
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse(
      "No tracking number (REQUIRED_FIELD_MISSING), or provider does not support cancelling (OPERATION_NOT_SUPPORTED)"
    ),
    500: errorResponse("External API error (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const addRemarkRoute = createRoute({
  method: "post",
  path: "/{id}/add-remark",
  middleware: [requireScope(SCOPES.DELIVERY_DISPATCH)],
  tags: ["Orders"],
  summary: "Add remark to shipment at carrier",
  description: `Adds a remark/note to the shipment at the carrier API. Works at any time after dispatch; visible to carrier and sender.

Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED.`,
  operationId: "addShipmentRemark",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          content: z.string().min(1).openapi({
            description: "Remark text shown to the carrier and courier",
            example: "Appeler le client 30 minutes avant",
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Remark added",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Remark added" }),
        })
      ),
    },
    400: errorResponse("Missing or empty remark content (REQUIRED_FIELD_MISSING)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:dispatch scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse("No tracking number, or provider does not support remarks"),
    500: errorResponse("External API error (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const openRecordsArray = () =>
  z.array(z.record(z.string(), z.unknown())).openapi({
    description: "Structure varies by carrier API.",
  });

const getRemarksRoute = createRoute({
  method: "get",
  path: "/{id}/remarks",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "Fetch shipment remarks from carrier",
  description: `Fetches the list of remarks/notes for a shipment from the carrier API — entries from both sender and courier/driver.

Provider support: ecotrack ✅ (GET /api/v1/get/maj) | NOEST ❌ | Yalidine ❌ | ZR Express ❌.`,
  operationId: "getShipmentRemarks",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Remarks fetched successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: openRecordsArray(),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:read scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse("No tracking number, or provider does not support fetching remarks"),
    500: errorResponse("External API error (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getTrackingRoute = createRoute({
  method: "get",
  path: "/{id}/tracking-events",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "Fetch tracking history from carrier",
  description: `Fetches the full chronological tracking history for a shipment from the carrier API (pickup, hub reception, transit, delivery attempts, delivered/returned).

Provider support: all four ✅ (ecotrack, noest, yalidine, zr_express).`,
  operationId: "getShipmentTracking",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Tracking events fetched successfully",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: openRecordsArray(),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:read scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse("No tracking number, or provider does not support live tracking"),
    500: errorResponse("External API error (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const proxyLabelRoute = createRoute({
  method: "get",
  path: "/{id}/label",
  middleware: [requireScope(SCOPES.ORDERS_READ)],
  tags: ["Orders"],
  summary: "Proxy shipment label PDF from carrier",
  description: `Proxies the shipment label PDF from the carrier API. Carrier label URLs require a Bearer token and are not publicly accessible — this endpoint fetches server-side (with the stored token, or a fresh SAS URL for ZR Express) and streams the PDF to the client.

Returns application/pdf with Content-Disposition: inline.`,
  operationId: "proxyShipmentLabel",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Label PDF stream",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary", type: "string" }),
        },
      },
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing orders:read scope"),
    404: errorResponse("Order or delivery company not found"),
    422: errorResponse(
      "No tracking number, no API token configured (MISSING_API_CREDENTIALS), or label not yet available"
    ),
    500: errorResponse("Failed to fetch label from carrier (EXTERNAL_API_ERROR)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listOrdersRoute, handlers.listOrders);
router.openapi(bulkDispatchRoute, dispatch.bulkDispatch);

router.openapi(getOrderRoute, handlers.getOrder);
router.openapi(createOrderRoute, handlers.createOrder);
router.openapi(updateStatusRoute, statusTransitions.updateStatus);
router.openapi(assignDriverRoute, statusTransitions.assignDriver);
router.openapi(unassignDriverRoute, statusTransitions.unassignDriver);
router.openapi(returnOrderProductRoute, handlers.returnOrderProduct);
router.openapi(dispatchToCompanyRoute, dispatch.dispatchToCompany);
router.openapi(validateShipmentRoute, dispatch.validateShipmentManually);
router.openapi(updateShipmentRoute, shipmentOps.updateShipmentInfo);
router.openapi(cancelShipmentRoute, shipmentOps.cancelShipment);
router.openapi(addRemarkRoute, shipmentOps.addShipmentRemark);
router.openapi(getRemarksRoute, shipmentOps.getShipmentRemarks);
router.openapi(getTrackingRoute, shipmentOps.getShipmentTracking);
router.openapi(proxyLabelRoute, shipmentOps.proxyShipmentLabel);
router.openapi(deleteOrderRoute, handlers.deleteOrder);

export default router;
