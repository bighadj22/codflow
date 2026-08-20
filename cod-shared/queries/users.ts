/**
 * Users Queries
 *
 * Read functions + API-key rotation. Cache-invalidating writes
 * (createUser, updateUser, grantScope, revokeScope) live in
 * cod-server so they can invoke the scope cache.
 */

import { eq, and, like, or } from "drizzle-orm";
import { users, userScopes } from "../db/schema";
import type { AppDb } from "../db/client";

export interface UserFilters {
  role?: "admin" | "staff";
  status?: "active" | "inactive";
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Strip the API key from a user record before returning it in any response.
 * The key is only ever returned by rotateApiKey(), which is the one-time reveal.
 */
function sanitize<T extends { apiKey: string | null }>(user: T): Omit<T, "apiKey"> {
  const { apiKey: _, ...safe } = user;
  return safe as Omit<T, "apiKey">;
}

export async function getAllUsers(db: AppDb, filters?: UserFilters) {
  const conditions = [];

  if (filters?.role) {
    conditions.push(eq(users.role, filters.role));
  }

  if (filters?.status) {
    conditions.push(eq(users.status, filters.status));
  }

  if (filters?.search) {
    conditions.push(
      or(
        like(users.name, `%${filters.search}%`),
        like(users.email, `%${filters.search}%`),
      ),
    );
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let allUsers;
  if (conditions.length > 0) {
    allUsers = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .all();
  } else {
    allUsers = await db
      .select()
      .from(users)
      .limit(limit)
      .offset(offset)
      .all();
  }

  const usersWithScopes = await Promise.all(
    allUsers.map(async (user) => {
      if (user.role === "admin") {
        return sanitize({ ...user, scopes: ["*"] });
      }

      const scopeRecords = await db
        .select({ scope: userScopes.scope })
        .from(userScopes)
        .where(eq(userScopes.userId, user.id));

      return sanitize({
        ...user,
        scopes: scopeRecords.map((r) => r.scope),
      });
    }),
  );

  return usersWithScopes;
}

export async function getUserById(db: AppDb, userId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return sanitize({ ...user, scopes: ["*"] });
  }

  const scopeRecords = await db
    .select({ scope: userScopes.scope })
    .from(userScopes)
    .where(eq(userScopes.userId, user.id));

  return sanitize({
    ...user,
    scopes: scopeRecords.map((r) => r.scope),
  });
}

/**
 * Rotate (regenerate) the API key for a user.
 * Returns the new raw key — store it securely, it will not be retrievable again.
 */
export async function rotateApiKey(
  db: AppDb,
  userId: string,
): Promise<{ apiKey: string }> {
  const apiKey = `cod_${crypto.randomUUID().replace(/-/g, "")}`;

  await db
    .update(users)
    .set({ apiKey, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { apiKey };
}
