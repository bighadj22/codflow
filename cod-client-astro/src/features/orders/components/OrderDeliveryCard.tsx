import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { DeliveryCompany, OrderDetail } from "@/features/orders/types";

interface OrderDeliveryCardProps {
  order: Pick<
    OrderDetail,
    | "deliveryType"
    | "stationCode"
    | "deliveryAttempts"
    | "trackingNumber"
    | "driverName"
    | "trackingUrl"
    | "notes"
  >;
  company?: DeliveryCompany;
}

export function OrderDeliveryCard({ order, company }: OrderDeliveryCardProps) {
  const t = useT("orders");

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Card title={t("detail.delivery_info")}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t("detail.delivery_type")}
            </span>
            <span className="font-semibold">
              {order.deliveryType === "home"
                ? t("detail.home_delivery")
                : t("detail.stop_desk")}
            </span>
          </div>
          {order.stationCode && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("dispatch_dialog.station_code_label")}
              </span>
              <span className="font-mono text-xs font-semibold">
                {order.stationCode}
              </span>
            </div>
          )}
          {order.deliveryAttempts != null && order.deliveryAttempts > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("detail.delivery_attempts")}
              </span>
              <span className="font-semibold">
                {order.deliveryAttempts}
              </span>
            </div>
          )}
          {order.trackingNumber && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("detail.tracking_number")}
              </span>
              <span dir="ltr" className="font-mono text-xs font-semibold">
                {order.trackingNumber}
              </span>
            </div>
          )}
          {company && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("detail.company")}
              </span>
              <span className="font-semibold">{company.name}</span>
            </div>
          )}
          {order.driverName && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("detail.driver")}
              </span>
              <span className="font-semibold">{order.driverName}</span>
            </div>
          )}
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-link"
            >
              {t("detail.track_on_provider")}
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </Card>
      <Card title={t("detail.notes")}>
        <p className="text-sm text-foreground">
          {order.notes || t("detail.no_notes")}
        </p>
      </Card>
    </div>
  );
}
