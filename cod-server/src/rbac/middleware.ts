/**
 * RBAC Middleware
 *
 * Hono middleware factories that guard endpoints with scope requirements.
 */

import { Context, Next, MiddlewareHandler } from "hono";
import type { AppContext } from "@/types";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../../../cod-shared/rbac/utils";

function denyLog(c: Context<AppContext>, detail: string) {
  const user = c.get("user");
  console.warn(
    `[rbac] denied user=${user.id} email=${user.email} ` +
    `${detail} path=${c.req.path} method=${c.req.method}`
  );
}

/** Require the caller to be an admin. Rejects all staff regardless of scopes. */
export function requireAdmin(): MiddlewareHandler<AppContext> {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role !== "admin") {
      denyLog(c, "required=admin");
      return c.json({ error: "Admin access required" }, 403);
    }
    return next();
  };
}

/** Require a single scope. */
export function requireScope(scope: string): MiddlewareHandler<AppContext> {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role === "admin") return next();

    if (!hasPermission(user.scopes, scope)) {
      denyLog(c, `required=${scope}`);
      return c.json({ error: "Insufficient permissions", required: scope }, 403);
    }
    return next();
  };
}

/** Require at least one of the given scopes. */
export function requireAnyScope(scopes: string[]): MiddlewareHandler<AppContext> {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role === "admin") return next();

    if (!hasAnyPermission(user.scopes, scopes)) {
      denyLog(c, `requiredAny=${scopes.join(",")}`);
      return c.json({ error: "Insufficient permissions", requiredAny: scopes }, 403);
    }
    return next();
  };
}

/** Require all of the given scopes. */
export function requireAllScopes(scopes: string[]): MiddlewareHandler<AppContext> {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role === "admin") return next();

    if (!hasAllPermissions(user.scopes, scopes)) {
      const missing = scopes.filter((s) => !user.scopes.includes(s));
      denyLog(c, `requiredAll=${scopes.join(",")} missing=${missing.join(",")}`);
      return c.json({ error: "Insufficient permissions", requiredAll: scopes, missing }, 403);
    }
    return next();
  };
}
