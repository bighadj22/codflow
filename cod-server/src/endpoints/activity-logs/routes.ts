/**
 * Activity Logs Routes
 *
 * All routes are admin-only — activity logs are never visible to staff.
 */

import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { AppContext } from "@/types";
import { listActivityLogs, getUserActivityLogs } from "./handlers";
import { PermissionError } from "@/lib/errors/classes";

async function adminOnly(c: Context<AppContext>, next: Next) {
  if (c.get("user").role !== "admin") {
    throw new PermissionError("Admin access required", "admin");
  }
  await next();
}

const router = new Hono<AppContext>();

router.use("*", adminOnly);
router.get("/",                 listActivityLogs);
router.get("/users/:userId",    getUserActivityLogs);

export default router;
