/**
 * Analytics Routes
 *
 * Read-only endpoints that serve aggregated stats for the dashboard and
 * any future reporting features. Protected by DASHBOARD_VIEW scope.
 *
 * All routes are mounted under /api/analytics in index.ts.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { getDashboardStats } from "./handlers";

const router = new Hono<AppContext>();

// GET /api/analytics/dashboard-stats
router.get("/dashboard-stats", requireScope(SCOPES.DASHBOARD_VIEW), getDashboardStats);

export default router;
