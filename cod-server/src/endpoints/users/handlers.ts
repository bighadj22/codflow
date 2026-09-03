/**
 * Users Route Handlers
 *
 * HTTP handlers for user management CRUD operations.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, ConflictError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { sendInviteEmail } from "./invite-email";

/**
 * GET /users
 * List all users with optional filters.
 */
export async function listUsers(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const query: any = (c.req as any).valid?.("query");
  const filters = query ?? validation.userFiltersSchema.parse({
    role: c.req.query("role"),
    status: c.req.query("status"),
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const users = await queries.getAllUsers(db, filters);
  return c.json({ success: true, data: users, count: users.length }, 200);
}

/**
 * GET /users/:id
 * Get single user by ID with scope details.
 */
export async function getUser(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const userId = c.req.param("id")!;
  const user = await queries.getUserById(db, userId);
  
  if (!user) {
    throw new NotFoundError("User", userId);
  }
  
  return c.json({ success: true, data: user }, 200);
}

// Same scrypt params as @better-auth/utils/password — must stay in sync.
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 } as const;

async function hashPassword(password: string): Promise<string> {
  const salt = bytesToHex(randomBytes(16));
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, dkLen: SCRYPT.dkLen,
    maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return `${salt}:${bytesToHex(key as Uint8Array)}`;
}

/**
 * POST /users
 * Create a new team member.
 *
 * Flow:
 *   1. Hash a generated temporary password (same scrypt as better-auth)
 *   2. Generate an API key
 *   3. Insert into D1: users + accounts (credential) + initial scopes
 *   4. Best-effort invite email via Sendili (never blocks or fails creation)
 *
 * Returns the temp password and API key once — they cannot be retrieved again.
 * `emailSent`/`emailError` report the invite outcome (stable codes only).
 * Admin-only — enforced at the route level via requireAdmin().
 */
export async function createUser(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? validation.createUserSchema.parse(await c.req.json());
  const actor = c.get("user");

  // 1. Generate a temporary password for the new staff member
  const tempPassword = bytesToHex(randomBytes(10)); // 20-char hex string
  const passwordHash = await hashPassword(tempPassword);

  // 2. Generate API key — returned once in this response
  const rawApiKey = `cod_${crypto.randomUUID().replace(/-/g, "")}`;

  // 3. Generate a user ID (same format as better-auth: 32-char hex)
  const userId = bytesToHex(randomBytes(16));

  // 4. Check for duplicate email
  const { users: usersTable } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, validated.email)).get();
  if (existing) {
    throw new ConflictError(
      "A user with this email already exists",
      ERROR_CODES.DUPLICATE_EMAIL,
      { email: validated.email }
    );
  }

  // 5. Insert user + credential account + scopes
  const user = await queries.createUser(
    db,
    {
      id: userId,
      email: validated.email,
      name: validated.name,
      role: validated.role,
      status: "active",
      apiKey: rawApiKey,
      passwordHash,
      language: validated.language,
    },
    validated.scopes,
    actor.id,
  );

  if (!user) {
    throw new SystemError("Failed to create user");
  }

  await logActivity(db, actor, ACTIONS.USER_CREATED, {
    type: "user", id: userId, label: validated.name,
  }, { role: validated.role });

  const invite = await sendInviteEmail(db, c.env, {
    userId,
    name: validated.name,
    email: validated.email,
    tempPassword,
    language: validated.language ?? "en",
  });

  return c.json({
    success: true,
    data: user,
    apiKey: rawApiKey,
    tempPassword,
    emailSent: invite.sent,
    emailError: invite.error,
    message: "User created. Share the tempPassword with the user — it will not be shown again.",
  }, 201);
}

/**
 * PATCH /users/:id
 * Update user information.
 */
export async function updateUser(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? validation.updateUserSchema.parse(await c.req.json());
  const user = await queries.updateUser(db, id, validated);
  
  if (!user) {
    throw new NotFoundError("User", id);
  }
  
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.USER_UPDATED, {
    type: "user", id, label: user.name ?? undefined,
  });
  return c.json({ success: true, data: user, message: "User updated successfully" }, 200);
}

/**
 * PATCH /users/:id/role
 * Update user role.
 */
export async function updateUserRole(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? validation.updateUserRoleSchema.parse(await c.req.json());
  const { role } = body;
  const user = await queries.updateUser(db, id, { role });
  
  if (!user) {
    throw new NotFoundError("User", id);
  }
  
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.USER_ROLE_CHANGED, {
    type: "user", id, label: user.name ?? undefined,
  }, { role });
  return c.json({ success: true, data: user, message: "User role updated successfully" }, 200);
}

/**
 * POST /users/:id/scopes
 * Grant scope to user.
 */
export async function grantScope(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? validation.grantScopeSchema.parse(await c.req.json());
  const currentUser = c.get("user");

  const existing = await queries.getUserById(db, id);
  if (!existing) {
    throw new NotFoundError("User", id);
  }

  try {
    const user = await queries.grantScope(db, id, validated.scope, currentUser?.id || "system");
    if (!user) {
      throw new SystemError("Failed to grant scope");
    }
    if (currentUser) {
      await logActivity(db, currentUser, ACTIONS.USER_SCOPE_GRANTED, {
        type: "user", id,
      }, { scope: validated.scope });
    }
    return c.json({ success: true, data: user, message: "Scope granted successfully" }, 200);
  } catch (err) {
    if (err instanceof Error && err.message === "Scope already granted to user") {
      throw new ConflictError(
        err.message,
        ERROR_CODES.DUPLICATE_ENTITY,
        { userId: id, scope: validated.scope }
      );
    }
    throw err;
  }
}

/**
 * DELETE /users/:id/scopes/:scope
 * Revoke scope from user.
 */
export async function revokeScope(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const scope = c.req.param("scope")!;

  // Validate scope parameter
  if (!scope || scope.trim() === "") {
    throw new Error("Scope parameter is required");
  }

  const existing = await queries.getUserById(db, id);
  if (!existing) {
    throw new NotFoundError("User", id);
  }

  const user = await queries.revokeScope(db, id, scope);
  if (!user) {
    throw new SystemError("Failed to revoke scope");
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.USER_SCOPE_REVOKED, { type: "user", id }, { scope });
  return c.json({ success: true, data: user, message: "Scope revoked successfully" }, 200);
}

/**
 * POST /users/:id/api-key/rotate
 * Rotate (regenerate) the API key for a user.
 * Admin only. The new raw key is returned once — it cannot be retrieved again.
 */
export async function rotateApiKey(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getUserById(db, id);
  if (!existing) {
    throw new NotFoundError("User", id);
  }

  const result = await queries.rotateApiKey(db, id);
  return c.json({ success: true, data: result, message: "API key rotated successfully" }, 200);
}

