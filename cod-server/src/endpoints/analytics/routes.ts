/**
 * Analytics Routes
 *
 * Read-only endpoints that serve aggregated stats for the dashboard and
 * any future reporting features. Protected by DASHBOARD_VIEW scope.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { getDashboardStats } from "./handlers";
import { OrderStatusEnum, ErrorResponseSchema } from "@/openapi/schemas";

const dashboardStatsRoute = createRoute({
  method: "get",
  path: "/dashboard-stats",
  middleware: [requireScope(SCOPES.DASHBOARD_VIEW)],
  tags: ["Analytics"],
  summary: "Order status statistics",
  description:
    "Returns order counts grouped by lifecycle status in a single optimized query — powers the dashboard summary cards.",
  operationId: "getDashboardStats",
  responses: {
    200: {
      description: "Order counts per status",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.array(
              z.object({
                status: OrderStatusEnum,
                count: z.number().int().openapi({ example: 12 }),
              })
            ),
          }),
        },
      },
    },
    401: {
      description: "Missing or invalid API key",
      content: {
        "application/json": { schema: ErrorResponseSchema },
      },
    },
    403: {
      description: "Missing dashboard:view scope",
      content: {
        "application/json": { schema: ErrorResponseSchema },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(dashboardStatsRoute, getDashboardStats);

export default router;
