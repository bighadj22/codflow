/**
 * Analytics Routes
 *
 * Read-only endpoints that serve aggregated stats for the dashboard and
 * any future reporting features. Protected by DASHBOARD_VIEW scope.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { getDashboardStats } from "./handlers";
import { OrderStatusEnum } from "@/openapi/schemas";

const dashboardStatsRoute = defineRoute({
  method: "get",
  path: "/dashboard-stats",
  auth: { scope: SCOPES.DASHBOARD_VIEW },
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
  },
  handler: getDashboardStats,
});

const router = new OpenAPIHono<AppContext>();

router.openapi(dashboardStatsRoute.route, dashboardStatsRoute.handler);

export default router;
