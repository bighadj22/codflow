/**
 * Frontend Permission Utilities
 * 
 * Client-side utilities for checking user permissions in the UI.
 * These work with client components and use the user data passed from server.
 */

"use client";

import { hasPermission as checkPermission, hasAnyPermission as checkAnyPermission, hasAllPermissions as checkAllPermissions } from "../../../cod-shared/rbac/utils";

/**
 * Client-side permission check
 * Requires user role and scopes to be passed as props
 */
export function hasPermission(userScopes: string[], requiredScope: string): boolean {
  return checkPermission(userScopes, requiredScope);
}

/**
 * Client-side check for any permission
 */
export function hasAnyPermission(userScopes: string[], requiredScopes: string[]): boolean {
  return checkAnyPermission(userScopes, requiredScopes);
}

/**
 * Client-side check for all permissions
 */
export function hasAllPermissions(userScopes: string[], requiredScopes: string[]): boolean {
  return checkAllPermissions(userScopes, requiredScopes);
}
