/**
 * MCP Management Routes
 *
 * Every route requires SCOPES.MCP_VIEW (or admin role, which bypasses
 * scope checks). The /team and cross-user revoke routes additionally
 * require admin — regular users can only see + manage their own
 * connections.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope, requireAdmin } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import {
  listMyConnections,
  listTeamConnections,
  revokeMyConnection,
  revokeUserConnection,
} from "./handlers";

const router = new Hono<AppContext>();

// Everyone with MCP_VIEW (or admin) can read/manage their own connections.
router.use("*", requireScope(SCOPES.MCP_VIEW));

// Self-view / self-revoke
router.get("/me",                              listMyConnections);
router.delete("/connections/:clientId",        revokeMyConnection);

// Admin-only team visibility + cross-user revocation.
router.get("/team",                                          requireAdmin(), listTeamConnections);
router.delete("/connections/:clientId/users/:userId",        requireAdmin(), revokeUserConnection);

export default router;
