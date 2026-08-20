/**
 * Users Database Queries
 *
 * Pure reads + API-key rotation are re-exported from cod-shared.
 * Writes that invoke the scope cache (createUser, updateUser, grantScope,
 * revokeScope) stay here because `clearScopeCache` is server-only.
 */

import { eq, and, sql } from "drizzle-orm";
import { users, userScopes } from "@/db/schema";
import { clearScopeCache } from "@/rbac/permissions";
import { getDb } from "@/db";

import {
  getAllUsers,
  getUserById,
  rotateApiKey,
} from "../../../../cod-shared/queries/users";

export { getAllUsers, getUserById, rotateApiKey };

type Database = ReturnType<typeof getDb>;

/**
 * Create new user with credential account + initial scope assignment.
 * D1 does not support transactions — sequential awaits.
 */
export async function createUser(
  db: Database,
  userData: {
    id: string;
    email: string;
    name: string;
    role: "admin" | "staff";
    status: "active" | "inactive";
    apiKey: string;
    passwordHash: string;
  },
  initialScopes: string[],
  grantedBy: string,
) {
  const nowDate = new Date();
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();

  await db.insert(users).values({
    id: userData.id,
    name: userData.name,
    email: userData.email,
    emailVerified: true,
    role: userData.role,
    status: userData.status,
    apiKey: userData.apiKey,
    createdAt: nowDate,
    updatedAt: nowDate,
  });

  // Insert credential account (password hash) into the better-auth accounts table.
  // We use raw SQL to avoid declaring the accounts table in this schema.
  await db.run(sql`
    INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${userData.id}, ${userData.email}, 'credential', ${userData.passwordHash}, ${nowMs}, ${nowMs})
  `);

  if (userData.role !== "admin" && initialScopes.length > 0) {
    await db.insert(userScopes).values(
      initialScopes.map(scope => ({
        id: crypto.randomUUID(),
        userId: userData.id,
        scope,
        grantedBy,
        grantedAt: nowIso,
      }))
    );
  }

  return getUserById(db, userData.id);
}

/**
 * Update user information
 */
export async function updateUser(
  db: Database,
  userId: string,
  updates: {
    email?: string;
    name?: string;
    role?: "admin" | "staff";
    status?: "active" | "inactive";
  }
) {
  await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (updates.role) {
    clearScopeCache(userId);
  }

  return getUserById(db, userId);
}

/**
 * Grant scope to user
 */
export async function grantScope(
  db: Database,
  userId: string,
  scope: string,
  grantedBy: string
) {
  const existing = await db
    .select()
    .from(userScopes)
    .where(and(eq(userScopes.userId, userId), eq(userScopes.scope, scope)))
    .get();

  if (existing) {
    throw new Error("Scope already granted to user");
  }

  await db.insert(userScopes).values({
    id: crypto.randomUUID(),
    userId,
    scope,
    grantedBy,
    grantedAt: new Date(Date.now()).toISOString(),
  });

  clearScopeCache(userId);
  return getUserById(db, userId);
}

/**
 * Revoke scope from user
 */
export async function revokeScope(
  db: Database,
  userId: string,
  scope: string
) {
  await db
    .delete(userScopes)
    .where(and(eq(userScopes.userId, userId), eq(userScopes.scope, scope)));

  clearScopeCache(userId);
  return getUserById(db, userId);
}
