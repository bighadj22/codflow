import { MapPin, Phone, UserRound } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { OrderDetail } from "@/features/orders/types";

interface OrderCustomerCardProps {
  order: Pick<OrderDetail, "customerName" | "phone" | "wilaya" | "commune" | "address">;
}

export function OrderCustomerCard({ order }: OrderCustomerCardProps) {
  const t = useT("orders");

  return (
    <Card title={t("detail.customer_info")}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <UserRound size={18} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("detail.name")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {order.customerName}
            </p>
            <a
              href={`tel:${order.phone}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-link"
              dir="ltr"
            >
              <Phone size={13} />
              {order.phone}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin size={18} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("detail.destination")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {order.wilaya ?? "-"}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.commune ?? "-"}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {order.address ?? "-"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
