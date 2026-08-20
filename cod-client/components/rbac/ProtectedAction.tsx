/**
 * ProtectedAction Component
 * 
 * Controls UI element visibility based on required scopes.
 * Hides buttons/forms user cannot use.
 */

"use client";

import { hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/rbac/permissions";

interface ProtectedActionProps {
  /**
   * User's scopes (passed from server component)
   */
  userScopes: string[];
  
  /**
   * Single scope required to display the children
   */
  requiredScope?: string;
  
  /**
   * Array of scopes - user needs at least one
   */
  requireAny?: string[];
  
  /**
   * Array of scopes - user needs all of them
   */
  requireAll?: string[];
  
  /**
   * Optional fallback UI to display when user lacks permission
   */
  fallback?: React.ReactNode;
  
  /**
   * The UI elements to render if authorized
   */
  children: React.ReactNode;
}

/**
 * ProtectedAction component for UI element-level access control
 * 
 * @example
 * ```tsx
 * // In server component, get user scopes
 * const userScopes = await getUserScopes();
 * 
 * // Pass to client component
 * <ClientComponent userScopes={userScopes} />
 * 
 * // In client component
 * <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.ORDERS_CREATE}>
 *   <Button>Create Order</Button>
 * </ProtectedAction>
 * 
 * // Any of multiple scopes
 * <ProtectedAction 
 *   userScopes={userScopes}
 *   requireAny={[SCOPES.ORDERS_UPDATE, SCOPES.ORDERS_DELETE]}
 * >
 *   <Button>Manage Order</Button>
 * </ProtectedAction>
 * 
 * // All of multiple scopes
 * <ProtectedAction 
 *   userScopes={userScopes}
 *   requireAll={[SCOPES.ORDERS_READ, SCOPES.ORDERS_UPDATE]}
 * >
 *   <Button>Edit Order</Button>
 * </ProtectedAction>
 * 
 * // With fallback
 * <ProtectedAction 
 *   userScopes={userScopes}
 *   requiredScope={SCOPES.ORDERS_CREATE}
 *   fallback={<span className="text-muted-foreground">No permission</span>}
 * >
 *   <Button>Create Order</Button>
 * </ProtectedAction>
 * ```
 */
export function ProtectedAction({
  userScopes,
  requiredScope,
  requireAny,
  requireAll,
  fallback,
  children,
}: ProtectedActionProps) {
  // Calculate if user has permission based on props provided
  let hasAccess = false;
  
  if (requiredScope) {
    hasAccess = hasPermission(userScopes, requiredScope);
  } else if (requireAny && requireAny.length > 0) {
    hasAccess = hasAnyPermission(userScopes, requireAny);
  } else if (requireAll && requireAll.length > 0) {
    hasAccess = hasAllPermissions(userScopes, requireAll);
  }

  // Render fallback or nothing if user lacks permission
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  // Render children if authorized
  return <>{children}</>;
}
