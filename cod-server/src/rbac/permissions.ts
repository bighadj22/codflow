/**
 * Permission Checker Service
 * 
 * Database-backed permission validation service with caching.
 */

import { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { userScopes } from "@/db/schema";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../../../cod-shared/rbac/utils";

// In-memory cache for user scopes
const scopeCache = new Map<string, { scopes: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all scopes for a user from database
 * 
 * @param db - Drizzle database instance
 * @param userId - User ID to fetch scopes for
 * @returns Array of scope strings
 */
export async function getUserScopes(
  db: DrizzleD1Database,
  userId: string
): Promise<string[]> {
  // Check cache first
  const cached = scopeCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.scopes;
  }

  try {
    const scopeRecords = await db
      .select({ scope: userScopes.scope })
      .from(userScopes)
      .where(eq(userScopes.userId, userId));

    const scopes = scopeRecords.map(r => r.scope);

    // Update cache
    scopeCache.set(userId, {
      scopes,
      timestamp: Date.now(),
    });

    return scopes;
  } catch (error) {
    console.error("Error fetching user scopes:", error);
    // Fail closed - return empty array on error
    return [];
  }
}

/**
 * Check if user has a specific permission
 * 
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @param userRole - User role (admin or staff)
 * @param requiredScope - Scope required for the action
 * @returns true if user has permission
 */
export async function checkPermission(
  db: DrizzleD1Database,
  userId: string,
  userRole: "admin" | "staff",
  requiredScope: string
): Promise<boolean> {
  // Admin bypass - no database query needed
  if (userRole === "admin") {
    return true;
  }

  try {
    const userScopesList = await getUserScopes(db, userId);
    return hasPermission(userScopesList, requiredScope);
  } catch (error) {
    console.error("Error checking permission:", error);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Check if user has at least one of the required permissions
 * 
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @param userRole - User role (admin or staff)
 * @param requiredScopes - Array of scopes, user needs at least one
 * @returns true if user has any of the required permissions
 */
export async function checkAnyPermission(
  db: DrizzleD1Database,
  userId: string,
  userRole: "admin" | "staff",
  requiredScopes: string[]
): Promise<boolean> {
  // Admin bypass
  if (userRole === "admin") {
    return true;
  }

  try {
    const userScopesList = await getUserScopes(db, userId);
    return hasAnyPermission(userScopesList, requiredScopes);
  } catch (error) {
    console.error("Error checking any permission:", error);
    // Fail closed
    return false;
  }
}

/**
 * Check if user has all of the required permissions
 * 
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @param userRole - User role (admin or staff)
 * @param requiredScopes - Array of scopes, user needs all of them
 * @returns true if user has all required permissions
 */
export async function checkAllPermissions(
  db: DrizzleD1Database,
  userId: string,
  userRole: "admin" | "staff",
  requiredScopes: string[]
): Promise<boolean> {
  // Admin bypass
  if (userRole === "admin") {
    return true;
  }

  try {
    const userScopesList = await getUserScopes(db, userId);
    return hasAllPermissions(userScopesList, requiredScopes);
  } catch (error) {
    console.error("Error checking all permissions:", error);
    // Fail closed
    return false;
  }
}

/**
 * Clear scope cache for a specific user
 * Useful after scope assignments change
 * 
 * @param userId - User ID to clear cache for
 */
export function clearScopeCache(userId: string): void {
  scopeCache.delete(userId);
}

/**
 * Clear all scope caches
 * Useful for testing or manual cache invalidation
 */
export function clearAllScopeCaches(): void {
  scopeCache.clear();
}
