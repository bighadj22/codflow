import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { OrderDetail } from "@/features/orders/components/OrderDetail";

export default function OrderDetailPageApp({ orderId }: { orderId: string }) {
  return (
    <RequireAuth>
      <DashboardChrome currentPath={`/orders/${orderId}`}>
        <OrderDetail orderId={orderId} />
      </DashboardChrome>
    </RequireAuth>
  );
}
