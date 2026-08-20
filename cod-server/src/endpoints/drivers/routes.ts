/**
 * Drivers Routes
 * 
 * Defines all driver management API endpoints with RBAC protection.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const drivers = new Hono<AppContext>();

// GET /drivers - List all drivers with filtering
drivers.get("/", requireScope(SCOPES.DELIVERY_READ), handlers.listDrivers);

// Compensation routes — must be declared before /:id to avoid being shadowed
drivers.get("/:id/compensations", requireScope(SCOPES.DELIVERY_READ), handlers.listCompensations);
drivers.put("/:id/compensations/:wilayaId", requireScope(SCOPES.DELIVERY_MANAGE), handlers.setCompensation);
drivers.delete("/:id/compensations/:wilayaId", requireScope(SCOPES.DELIVERY_MANAGE), handlers.deleteCompensation);

// GET /drivers/:id - Get single driver
drivers.get("/:id", requireScope(SCOPES.DELIVERY_READ), handlers.getDriver);

// POST /drivers - Create new driver
drivers.post("/", requireScope(SCOPES.DELIVERY_MANAGE), handlers.createDriver);

// PATCH /drivers/:id - Update driver information
drivers.patch("/:id", requireScope(SCOPES.DELIVERY_MANAGE), handlers.updateDriver);

// PATCH /drivers/:id/status - Update driver availability status
drivers.patch("/:id/status", requireScope(SCOPES.DELIVERY_MANAGE), handlers.updateDriverStatus);

// DELETE /drivers/:id - Delete driver
drivers.delete("/:id", requireScope(SCOPES.DELIVERY_MANAGE), handlers.deleteDriver);

export default drivers;