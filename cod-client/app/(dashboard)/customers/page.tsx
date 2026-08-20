
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getCustomers } from "@/actions/customers";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { CustomersView } from "@/components/customers/customers-view";

export default async function CustomersPage() {
  // Get user scopes for client components
  const userScopes = await getUserScopes();
  
  // Fetch customers from backend API
  let allCustomers: any[] = [];
  try {
    allCustomers = await getCustomers();
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    // Continue with empty array - component will handle the error state
  }
  
  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMERS_READ}>
      <CustomersView customers={allCustomers} userScopes={userScopes} />
    </ProtectedRoute>
  );
}
