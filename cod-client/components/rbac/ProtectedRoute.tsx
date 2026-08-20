/**
 * ProtectedRoute Component
 * 
 * Server component that protects entire pages based on required scopes.
 * Redirects unauthorized users to 403 page.
 */

import { hasPermission, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { NoAccess } from "./NoAccess";

interface ProtectedRouteProps {
  /**
   * The scope required to access this page
   */
  requiredScope: string;
  
  /**
   * The page content to render if authorized
   */
  children: React.ReactNode;
}

/**
 * ProtectedRoute component for page-level access control
 * This is a server component that checks permissions before rendering
 * 
 * @example
 * ```tsx
 * <ProtectedRoute requiredScope={SCOPES.ORDERS_READ}>
 *   <OrdersPage />
 * </ProtectedRoute>
 * ```
 */
export async function ProtectedRoute({
  requiredScope,
  children,
}: ProtectedRouteProps) {
  try {
    // Check permission on server
    const hasAccess = await hasPermission(requiredScope);

    if (!hasAccess) {
      // Render NoAccess UI instead of redirecting
      return <NoAccess />;
    }

    // Render page content if authorized
    return <>{children}</>;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <NoAccess />;
    }
    
    // For other errors (like auth issues), we might want a different UI 
    // but for now NoAccess is a safe fallback for unauthorized states
    console.error("ProtectedRoute error:", error);
    return <NoAccess />;
  }
}
