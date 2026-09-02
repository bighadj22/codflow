import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { NewOrderForm } from "@/features/orders/components/NewOrderForm";

export default function NewOrderPageApp() {
  return (
    <RequireAuth>
      <DashboardChrome currentPath="/orders/new">
        <NewOrderForm />
      </DashboardChrome>
    </RequireAuth>
  );
}
