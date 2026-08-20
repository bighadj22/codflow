import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const driverPayments = new Hono<AppContext>();

// POST /driver-payments — create payment + settle orders
driverPayments.post("/", requireScope(SCOPES.DELIVERY_MANAGE), handlers.createPayment);

// GET /driver-payments/:driverId — list payment history for a driver
driverPayments.get("/:driverId", requireScope(SCOPES.DELIVERY_READ), handlers.listPayments);

// GET /driver-payments/:driverId/pending — list unsettled delivered orders for pre-settlement review
driverPayments.get("/:driverId/pending", requireScope(SCOPES.DELIVERY_READ), handlers.listPendingOrders);

export default driverPayments;
