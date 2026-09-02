import { Building2, Truck } from "lucide-react";
import { useT } from "@/i18n/react";
import type { DeliveryCompany, OrderListItem } from "@/features/orders/types";

/** Delivery-method cell: the assigned company, driver, or "not assigned". */
export function OrderDelivery({
  order,
  companies,
}: {
  order: OrderListItem;
  companies: DeliveryCompany[];
}) {
  const t = useT("orders");
  if (order.trackingNumber) {
    const company = companies.find((item) => item.id === order.companyId);
    return (
      <span className="inline-flex max-w-36 items-center gap-1.5 truncate text-xs font-medium text-foreground">
        <Building2 size={14} className="shrink-0 text-success" />
        {company?.name ?? t("detail.company")}
      </span>
    );
  }
  if (order.driverName)
    return (
      <span className="inline-flex max-w-36 items-center gap-1.5 truncate text-xs font-medium text-foreground">
        <Truck size={14} className="shrink-0 text-muted-foreground" />
        {order.driverName}
      </span>
    );
  return (
    <span className="text-xs text-muted-foreground">
      {t("table.not_assigned")}
    </span>
  );
}
