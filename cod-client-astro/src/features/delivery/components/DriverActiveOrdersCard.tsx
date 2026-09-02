import { Card } from "@/components/ui";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { useT } from "@/i18n/react";
import type { DriverOrder } from "@/features/delivery/types";

export function DriverActiveOrdersCard({
  orders,
}: {
  orders: DriverOrder[];
}) {
  const t = useT("delivery");
  if (orders.length === 0) return null;

  return (
    <Card title={t("driver_card.active_orders")}>
      <div className="divide-y divide-border rounded-lg border border-border">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3"
          >
            <div className="min-w-0">
              <a
                href={`/orders/${encodeURIComponent(order.id)}`}
                className="text-sm font-semibold text-link hover:underline"
              >
                {order.orderNumber}
              </a>
              <p className="truncate text-xs text-muted-foreground">
                {order.customerName} · {order.wilaya || "-"}
              </p>
            </div>
            <OrderStatusBadge status={order.status as never} />
          </div>
        ))}
      </div>
    </Card>
  );
}
