import type { InferSelectModel } from "drizzle-orm";
import type { users } from "@/db/schema";
import type { Env } from "./env";

/**
 * Authenticated user — schema row + resolved scopes.
 * Set on the Hono context by authMiddleware as "user".
 */
export type AuthUser = InferSelectModel<typeof users> & { scopes: string[] };

/** Typed Hono context variables (set/get on c) */
export interface AppVariables {
  /** Set by authMiddleware on /api/* routes */
  user: AuthUser;
  /** Set by storeAuthMiddleware on /store/* routes */
  storeId?: string;
}

/**
 * Full Hono app context — use this as the generic for all
 * Hono instances, routers, handlers, and middleware.
 *
 * @example
 * const router = new Hono<AppContext>();
 * async function handler(c: Context<AppContext>) { ... }
 */
export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};
