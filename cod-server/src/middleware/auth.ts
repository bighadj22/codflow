/**
 * Authentication Middleware
 *
 * Validates API keys and loads user scopes for RBAC.
 */

import { Context, Next } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { users, userScopes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ERROR_CODES } from "../../../cod-shared/errors/codes";

export async function authMiddleware(c: Context<AppContext>, next: Next) {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ 
      error: "Missing API key",
      code: ERROR_CODES.MISSING_API_KEY,
      category: "AUTHENTICATION"
    }, 401);
  }

  try {
    const db = getDb(c.env.DB);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.apiKey, apiKey))
      .get();

    if (!user) {
      return c.json({ 
        error: "Invalid API key",
        code: ERROR_CODES.INVALID_API_KEY,
        category: "AUTHENTICATION"
      }, 401);
    }

    if (user.status !== "active") {
      return c.json({ 
        error: "User account is inactive",
        code: ERROR_CODES.USER_INACTIVE,
        category: "AUTHENTICATION"
      }, 403);
    }

    let scopes: string[];

    if (user.role === "admin") {
      scopes = ["*"];
    } else {
      try {
        const rows = await db
          .select({ scope: userScopes.scope })
          .from(userScopes)
          .where(eq(userScopes.userId, user.id));
        scopes = rows.map((r) => r.scope);
      } catch (err) {
        console.error("[auth] Failed to load scopes for user", user.id, err);
        return c.json({ 
          error: "Authentication failed",
          code: ERROR_CODES.AUTHENTICATION_FAILED,
          category: "AUTHENTICATION"
        }, 401);
      }
    }

    c.set("user", { ...user, scopes });
    await next();
  } catch (err) {
    console.error("[auth] Middleware error:", err);
    return c.json({ 
      error: "Authentication failed",
      code: ERROR_CODES.AUTHENTICATION_FAILED,
      category: "AUTHENTICATION"
    }, 500);
  }
}
