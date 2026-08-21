/**
 * Activity Logs Routes
 *
 * All routes are admin-only — activity logs are never visible to staff.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import type { AppContext } from "@/types";
import {
  ActivityLogSchema,
  ErrorResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";
import { listActivityLogs, getUserActivityLogs } from "./handlers";
import { PermissionError } from "@/lib/errors/classes";

const jsonContent = (schema: z.ZodType) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

async function adminOnly(c: Context<AppContext>, next: Next) {
  if (c.get("user").role !== "admin") {
    throw new PermissionError("Admin access required", "admin");
  }
  await next();
}

const activityLogsQuerySchema = z.object({
  actorId: z.string().optional().openapi({
    description: "Filter by actor (user) ID",
  }),
  entityType: z
    .string()
    .optional()
    .openapi({
      description:
        "Filter by entity type. Valid values: `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `stock`, `user`, `review`",
    }),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .openapi({ description: "Maximum number of logs to return" }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({ description: "Number of logs to skip" }),
});

const userLogsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(30)
    .openapi({ description: "Maximum number of logs to return" }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({ description: "Number of logs to skip" }),
});

const listActivityLogsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Activity Logs"],
  summary: "List activity logs",
  description: "Get audit trail of all system actions (admin only)",
  operationId: "listActivityLogs",
  request: {
    query: activityLogsQuerySchema,
  },
  responses: {
    200: {
      description: "List of activity logs",
      content: jsonContent(ListResponseSchema(ActivityLogSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin access required"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getUserActivityLogsRoute = createRoute({
  method: "get",
  path: "/users/{userId}",
  tags: ["Activity Logs"],
  summary: "Get user activity logs",
  description: "Get activity logs for a specific user (admin only)",
  operationId: "getUserActivityLogs",
  request: {
    params: z.object({
      userId: z.string().openapi({ description: "User ID to filter logs for" }),
    }),
    query: userLogsQuerySchema,
  },
  responses: {
    200: {
      description: "User activity logs",
      content: jsonContent(ListResponseSchema(ActivityLogSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin access required"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.use("*", adminOnly);
router.openapi(listActivityLogsRoute, listActivityLogs);
router.openapi(getUserActivityLogsRoute, getUserActivityLogs);

export default router;
