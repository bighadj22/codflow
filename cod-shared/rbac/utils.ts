/**
 * RBAC Utility Functions
 * 
 * Reusable permission checking functions used by both frontend and backend.
 */

/**
 * Check if user has a specific permission
 * 
 * @param userScopes - Array of scopes assigned to the user
 * @param requiredScope - The scope required to perform the action
 * @returns true if user has the required scope or wildcard permission
 */
export function hasPermission(userScopes: string[], requiredScope: string): boolean {
  // Admin wildcard grants all permissions
  if (userScopes.includes("*")) {
    return true;
  }
  
  return userScopes.includes(requiredScope);
}

/**
 * Check if user has at least one of the required permissions
 * 
 * @param userScopes - Array of scopes assigned to the user
 * @param requiredScopes - Array of scopes, user needs at least one
 * @returns true if user has any of the required scopes or wildcard permission
 */
export function hasAnyPermission(userScopes: string[], requiredScopes: string[]): boolean {
  // Admin wildcard grants all permissions
  if (userScopes.includes("*")) {
    return true;
  }
  
  return requiredScopes.some(scope => userScopes.includes(scope));
}

/**
 * Check if user has all of the required permissions
 * 
 * @param userScopes - Array of scopes assigned to the user
 * @param requiredScopes - Array of scopes, user needs all of them
 * @returns true if user has all required scopes or wildcard permission
 */
export function hasAllPermissions(userScopes: string[], requiredScopes: string[]): boolean {
  // Admin wildcard grants all permissions
  if (userScopes.includes("*")) {
    return true;
  }
  
  return requiredScopes.every(scope => userScopes.includes(scope));
}
