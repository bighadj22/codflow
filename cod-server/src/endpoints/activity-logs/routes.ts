/**
 * Activity Logs Routes
 *
 * All routes are admin-only — activity logs are never visible to staff.
 * Built with defineRoute() — the standard route-builder pattern.
 *
 * Admin enforcement stays on the router-level adminOnly middleware so
 * denials keep the standard error envelope (PERMISSION_DENIED) that the
 * README documents; the platform's requireAdmin() middleware returns a
 * plain-JSON 403 instead.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { ActivityLogSchema, ListResponseSchema } from "@/openapi/schemas";
import { listActivityLogs, getUserActivityLogs } from "./handlers";
import { PermissionError } from "@/lib/errors/classes";

async function adminOnly(c: Context<AppContext>, next: Next) {
  if (c.get("user").role !== "admin") {
    throw new PermissionError("Admin access required", "admin");
  }
  await next();
}

// ─── Request schemas ──────────────────────────────────────────────────────────

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

const userIdParams = z.object({
  userId: z.string().openapi({ description: "User ID to filter logs for" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listActivityLogsRoute = defineRoute({
  method: "get",
  path: "/",
  auth: "api-key",
  tags: ["Activity Logs"],
  summary: "List activity logs",
  description: "Get audit trail of all system actions (admin only)",
  operationId: "listActivityLogs",
  query: activityLogsQuerySchema,
  responses: {
    200: {
      description: "List of activity logs",
      content: {
        "application/json": { schema: ListResponseSchema(ActivityLogSchema) },
      },
    },
    403: { description: "Admin access required" },
  },
  handler: listActivityLogs,
});

const getUserActivityLogsRoute = defineRoute({
  method: "get",
  path: "/users/{userId}",
  auth: "api-key",
  tags: ["Activity Logs"],
  summary: "Get user activity logs",
  description: "Get activity logs for a specific user (admin only)",
  operationId: "getUserActivityLogs",
  params: userIdParams,
  query: userLogsQuerySchema,
  responses: {
    200: {
      description: "User activity logs",
      content: {
        "application/json": { schema: ListResponseSchema(ActivityLogSchema) },
      },
    },
    403: { description: "Admin access required" },
  },
  handler: getUserActivityLogs,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.use("*", adminOnly);
router.openapi(listActivityLogsRoute.route, listActivityLogsRoute.handler);
router.openapi(getUserActivityLogsRoute.route, getUserActivityLogsRoute.handler);

export default router;
