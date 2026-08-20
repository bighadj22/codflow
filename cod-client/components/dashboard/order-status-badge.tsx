import { OrderStatus } from "@/types";
import { useOrders } from "@/lib/translations";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useOrders();
  
  const statusConfig: Record<OrderStatus, { varKey: string }> = {
    new:              { varKey: "new" },
    confirmed:        { varKey: "confirmed" },
    unreachable:      { varKey: "unreachable" },
    preparing:        { varKey: "preparing" },
    ready:            { varKey: "ready" },
    assigned:         { varKey: "assigned" },
    dispatched:       { varKey: "dispatched" },
    out_for_delivery: { varKey: "out" },
    delivered:        { varKey: "delivered" },
    returned:         { varKey: "returned" },
    cancelled:        { varKey: "cancelled" },
  };

  const config = statusConfig[status];
  const label = t.status[status];

  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border", className)}
      style={{
        background: `var(--status-${config.varKey}-bg)`,
        color: `var(--status-${config.varKey}-text)`,
        borderColor: `var(--status-${config.varKey}-border)`,
      }}
    >
      {label}
    </span>
  );
}
