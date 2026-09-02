import { Zap } from "lucide-react";
import { useT } from "@/i18n/react";
import type { OrderStatus } from "@/features/orders/types";
import { Badge } from "@/components/ui";

const STATUS_TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "critical" | "info"> = {
  new: "neutral",
  confirmed: "success",
  unreachable: "warning",
  preparing: "warning",
  ready: "info",
  assigned: "info",
  dispatched: "info",
  out_for_delivery: "warning",
  delivered: "success",
  returned: "critical",
  cancelled: "neutral",
};

export function OrderStatusBadge({ status, webhook = false }: { status: OrderStatus; webhook?: boolean }) {
  const t = useT("orders");
  return (
    <Badge tone={STATUS_TONE[status]}>
      {t(`status.${status}`)}
      {webhook && <Zap size={11} className="ms-1 text-primary" />}
    </Badge>
  );
}
