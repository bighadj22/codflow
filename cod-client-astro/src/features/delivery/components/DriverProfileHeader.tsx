import { Phone, Truck } from "lucide-react";
import { Badge } from "@/components/ui";
import { useT } from "@/i18n/react";
import { driverInitials } from "@/features/delivery/model";
import type { Driver } from "@/features/delivery/types";

export function DriverStatusBadge({ status }: { status: Driver["status"] }) {
  const t = useT("delivery");
  if (status === "available")
    return <Badge tone="success">{t("status.available")}</Badge>;
  if (status === "busy")
    return <Badge tone="warning">{t("status.busy")}</Badge>;
  return <Badge tone="neutral">{t("status.inactive")}</Badge>;
}

export function DriverProfileHeader({ driver }: { driver: Driver }) {
  const t = useT("delivery");

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <span className="grid size-20 shrink-0 place-items-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
        {driverInitials(driver)}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <DriverStatusBadge status={driver.status} />
          {driver.vehicleType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              <Truck size={12} />
              {t(`vehicle_type.${driver.vehicleType}`)}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground" dir="ltr">
          <Phone size={13} className="me-1 inline" />
          {driver.phone}
          {driver.phone2 && <span className="ms-3">{driver.phone2}</span>}
        </p>
        {driver.notes && (
          <p className="text-sm text-muted-foreground">{driver.notes}</p>
        )}
      </div>
    </div>
  );
}
