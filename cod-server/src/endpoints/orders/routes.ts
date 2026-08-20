/**
 * Orders Routes
 * 
 * Defines all order-related API endpoints with RBAC protection.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import * as statusTransitions from "./status-transitions";
import * as dispatch from "./dispatch";
import * as shipmentOps from "./shipment-operations";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const orders = new Hono<AppContext>();

// GET /orders - List all orders
orders.get("/", requireScope(SCOPES.ORDERS_READ), handlers.listOrders);

// POST /orders/bulk-dispatch - Dispatch multiple orders to a delivery company in one API call
// ⚠️ Must be registered BEFORE /:id routes to avoid "bulk-dispatch" matching as an order ID
// ⚠️ EcoTrack Packers: returns 500 server error (confirmed Packers bug) — other EcoTrack instances may work
// Provider support: ecotrack ⚠️ | others ❌
orders.post("/bulk-dispatch", requireScope(SCOPES.DELIVERY_DISPATCH), dispatch.bulkDispatch);

// GET /orders/:id - Get single order  
orders.get("/:id", requireScope(SCOPES.ORDERS_READ), handlers.getOrder);

// POST /orders - Create new order
orders.post("/", requireScope(SCOPES.ORDERS_CREATE), handlers.createOrder);

// PATCH /orders/:id/status - Update order status
orders.patch("/:id/status", requireScope(SCOPES.ORDERS_UPDATE), statusTransitions.updateStatus);

// PATCH /orders/:id/assign-driver - Assign driver
orders.patch("/:id/assign-driver", requireScope(SCOPES.ORDERS_ASSIGN), statusTransitions.assignDriver);

// PATCH /orders/:id/unassign - Remove the currently assigned driver
orders.patch("/:id/unassign", requireScope(SCOPES.ORDERS_ASSIGN), statusTransitions.unassignDriver);

// PATCH /orders/:id/products/:productLineId/return - Record partial/full return for one order line
// Used when customer opens the box and refuses some (or all) units at the door.
// Restocks the delta; server derives status ("fulfilled" | "partially_returned" | "returned").
orders.patch("/:id/products/:productLineId/return", requireScope(SCOPES.ORDERS_UPDATE), handlers.returnOrderProduct);

// POST /orders/:id/dispatch - Dispatch to delivery company API
orders.post("/:id/dispatch", requireScope(SCOPES.DELIVERY_DISPATCH), dispatch.dispatchToCompany);

// POST /orders/:id/validate-shipment - Manually validate a dispatched order at the carrier API
// Only meaningful when company.auto_validate=false (e.g. Packers). Advances status dispatched → out_for_delivery.
orders.post("/:id/validate-shipment", requireScope(SCOPES.DELIVERY_DISPATCH), dispatch.validateShipmentManually);

// PATCH /orders/:id/update-shipment - Update customer info / amount at carrier (before validation only)
// Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED
orders.patch("/:id/update-shipment", requireScope(SCOPES.DELIVERY_DISPATCH), shipmentOps.updateShipmentInfo);

// POST /orders/:id/cancel-shipment - Cancel/delete shipment at carrier (before validation only)
// On success: clears tracking number, resets order status to "ready".
// Provider support: ecotrack ✅ | others ❌ OPERATION_NOT_SUPPORTED
// Note: Uses POST not DELETE to avoid route ambiguity with DELETE /orders/:id
orders.post("/:id/cancel-shipment", requireScope(SCOPES.DELIVERY_DISPATCH), shipmentOps.cancelShipment);

// POST /orders/:id/add-remark - Add a remark/note to the shipment at the carrier
// Works at any time after dispatch. Provider support: ecotrack ✅ | others ❌
orders.post("/:id/add-remark", requireScope(SCOPES.DELIVERY_DISPATCH), shipmentOps.addShipmentRemark);

// GET /orders/:id/remarks - Fetch all remarks for a shipment from the carrier
// Provider support: ecotrack ✅ | others ❌
orders.get("/:id/remarks", requireScope(SCOPES.ORDERS_READ), shipmentOps.getShipmentRemarks);

// GET /orders/:id/tracking-events - Fetch full tracking history from the carrier
// Provider support: ecotrack ✅ | others ❌
orders.get("/:id/tracking-events", requireScope(SCOPES.ORDERS_READ), shipmentOps.getShipmentTracking);

// GET /orders/:id/label - Proxy the shipment label PDF from the carrier
// Carrier label URLs require a Bearer token and are not publicly accessible.
// This endpoint fetches with the stored API token and streams the PDF to the client.
// Provider support: ecotrack ✅ | others (if labelUrl stored in DB) ✅
orders.get("/:id/label", requireScope(SCOPES.ORDERS_READ), shipmentOps.proxyShipmentLabel);

// DELETE /orders/:id - Delete order
orders.delete("/:id", requireScope(SCOPES.ORDERS_DELETE), handlers.deleteOrder);

export default orders;
