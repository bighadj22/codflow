/**
 * Drivers Routes
 *
 * Driver management CRUD, availability status toggle, and per-wilaya
 * compensation management. All routes require an API key with the
 * appropriate delivery scope.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import {
  DriverSchema,
  DriverCompensationRowSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const phoneRegex = /^0[5-7]\d{8}$/;

const phoneField = () =>
  z.string().regex(phoneRegex, "Invalid Algerian phone number (0[5-7]XXXXXXXX)").openapi({
    pattern: phoneRegex.source,
    description: "Algerian mobile number starting with 05, 06, or 07",
    example: "0551234567",
  });

const idParams = z.object({
  id: z.string().openapi({ description: "Driver ID", example: "drv_123" }),
});

const compensationParams = z.object({
  ...idParams.shape,
  wilayaId: z.coerce.number().int().min(1).max(58).openapi({
    description: "Wilaya ID (1–58)",
    example: 16,
  }),
});

const listDriversRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Drivers"],
  summary: "List drivers",
  description:
    "Returns a paginated list of drivers. Each item includes `compensationWilayaCount` — the number of wilayas with a configured per-delivery fee for this driver.",
  operationId: "listDrivers",
  request: {
    query: z.object({
      wilayaId: z.coerce.number().int().min(1).max(58).optional().openapi({
        description: "Filter to drivers with a configured compensation row for this wilaya (1–58)",
      }),
      status: z.enum(["available", "busy", "inactive"]).optional().openapi({
        description: "Filter by availability status",
      }),
      vehicleType: z.enum(["motorcycle", "car", "van"]).optional().openapi({
        description: "Filter by vehicle type",
      }),
      search: z.string().optional().openapi({
        description: "Search by first name, last name, or phone",
      }),
      limit: z.coerce.number().int().positive().max(100).default(50).openapi({
        description: "Maximum number of results to return",
      }),
      offset: z.coerce.number().int().min(0).default(0).openapi({
        description: "Number of results to skip for pagination",
      }),
    }),
  },
  responses: {
    200: {
      description: "List of drivers",
      content: jsonContent(ListResponseSchema(DriverSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createDriverRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Create driver",
  description: "Register a new delivery driver.",
  operationId: "createDriver",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          firstName: z.string().min(1, "First name is required").openapi({ example: "Mohamed" }),
          lastName: z.string().min(1, "Last name is required").openapi({ example: "Amiri" }),
          phone: phoneField(),
          phone2: z.preprocess(
            (v) => (v === "" || v == null ? undefined : v),
            z.string().regex(phoneRegex, "Invalid Algerian phone number").optional()
          ).openapi({ description: "Optional secondary phone number" }),
          vehicleType: z.enum(["motorcycle", "car", "van"]).nullable().optional().openapi({
            description: "Type of vehicle. Omit or null if unknown.",
          }),
          status: z.enum(["available", "busy", "inactive"]).default("available").openapi({
            description: "Availability status. Defaults to `available`.",
          }),
          notes: z.preprocess(
            (v) => (v === "" || v == null ? undefined : v),
            z.string().optional().nullable()
          ).openapi({
            description: "Internal notes about the driver (not visible to customers)",
          }),
        })
      ),
    },
  },
  responses: {
    201: {
      description:
        "Driver created. Returns full driver record including `compensationWilayaCount` and `recentOrders`.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: DriverSchema,
          message: z.string().openapi({ example: "Driver created successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid phone format, missing required fields)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    409: errorResponse("Duplicate phone number - a driver with this phone already exists (code: DUPLICATE_PHONE)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getDriverRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Drivers"],
  summary: "Get driver",
  description:
    "Returns full driver detail including `compensationWilayaCount` and `recentOrders` (up to 10 most recent orders assigned to this driver). Use `GET /{id}/compensations` for the per-wilaya pay grid.",
  operationId: "getDriver",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Driver detail",
      content: jsonContent(SuccessResponseSchema(DriverSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateDriverRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Update driver",
  description:
    "Partial update — only include fields you want to change. Use `PATCH /{id}/status` to change availability status. Set `phone2`, `vehicleType`, or `notes` to null to clear them.",
  operationId: "updateDriver",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          firstName: z.string().min(1, "First name is required").optional(),
          lastName: z.string().min(1, "Last name is required").optional(),
          phone: phoneField().optional(),
          phone2: z.preprocess(
            (v) => (v === "" ? null : v),
            z.string().regex(phoneRegex, "Invalid Algerian phone number").nullable().optional()
          ).openapi({ description: "Updated secondary phone. Send `null` to clear it." }),
          vehicleType: z.enum(["motorcycle", "car", "van"]).nullable().optional().openapi({
            description: "Updated vehicle type. Send `null` to clear it.",
          }),
          notes: z.preprocess(
            (v) => (v === "" ? null : v),
            z.string().nullable().optional()
          ).openapi({ description: "Updated internal notes. Send `null` to clear." }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Driver updated. Returns full updated driver record.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: DriverSchema,
          message: z.string().openapi({ example: "Driver updated successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid phone format)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
    409: errorResponse("Duplicate phone number - a driver with this phone already exists (code: DUPLICATE_PHONE)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateDriverStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Update driver status",
  description: "Updates driver availability status. Returns the full updated driver record.",
  operationId: "updateDriverStatus",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          status: z.enum(["available", "busy", "inactive"]).openapi({
            description: "New availability status for the driver",
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Status updated",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: DriverSchema,
          message: z.string().openapi({ example: "Driver status updated" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid status value)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteDriverRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Delete driver",
  description:
    "Permanently deletes the driver. **Returns 409 if the driver has orders in `assigned` or `out_for_delivery` status** — resolve those orders first.",
  operationId: "deleteDriver",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Driver deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Driver deleted successfully" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
    409: errorResponse(
      "Cannot delete driver with active orders (code: DRIVER_HAS_ACTIVE_ORDERS)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCompensationsRoute = createRoute({
  method: "get",
  path: "/{id}/compensations",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Drivers"],
  summary: "List driver compensations",
  description:
    "Returns all 58 wilayas with the driver's configured per-delivery fee. `feePerDelivery` is `null` when no row has been configured for that wilaya (in which case the assigned order's driver fee defaults to 0).",
  operationId: "listDriverCompensations",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Per-wilaya compensation grid for this driver.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(DriverCompensationRowSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const setCompensationRoute = createRoute({
  method: "put",
  path: "/{id}/compensations/{wilayaId}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Upsert driver compensation for one wilaya",
  description:
    "Sets (or updates) the per-delivery fee this driver is paid for the given wilaya. Idempotent.",
  operationId: "setDriverCompensation",
  request: {
    params: compensationParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          feePerDelivery: z.number().min(0).openapi({
            description: "DZD per delivery in this wilaya.",
            example: 350,
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Compensation saved.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            id: z.string(),
            driverId: z.string(),
            wilayaId: z.number().int(),
            feePerDelivery: z.number(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }),
          message: z.string().openapi({ example: "Compensation saved" }),
        })
      ),
    },
    400: errorResponse("Validation error (negative fee, invalid wilayaId)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Driver not found (DRIVER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteCompensationRoute = createRoute({
  method: "delete",
  path: "/{id}/compensations/{wilayaId}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Drivers"],
  summary: "Remove driver compensation for one wilaya",
  description:
    "Removes the per-delivery fee row for this driver/wilaya pair. Future assignments in that wilaya will compute driverFee = 0 until a new row is set.",
  operationId: "deleteDriverCompensation",
  request: {
    params: compensationParams,
  },
  responses: {
    200: {
      description: "Compensation removed.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Compensation removed" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse(
      "Driver not found (`DRIVER_NOT_FOUND`) **or** no compensation row exists for this (driver, wilaya) pair (`DRIVER_COMPENSATION_NOT_FOUND`). Distinguish via the `code` field."
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listDriversRoute, handlers.listDrivers);
router.openapi(createDriverRoute, handlers.createDriver);
router.openapi(getDriverRoute, handlers.getDriver);
router.openapi(updateDriverRoute, handlers.updateDriver);
router.openapi(updateDriverStatusRoute, handlers.updateDriverStatus);
router.openapi(deleteDriverRoute, handlers.deleteDriver);
router.openapi(listCompensationsRoute, handlers.listCompensations);
router.openapi(setCompensationRoute, handlers.setCompensation);
router.openapi(deleteCompensationRoute, handlers.deleteCompensation);

export default router;
