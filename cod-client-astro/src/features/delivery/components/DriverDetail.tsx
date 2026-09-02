import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Truck, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import {
  Alert,
  Button,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  getDriver,
  listPendingSettlementOrders,
} from "@/features/delivery/api";
import {
  driverErrorMessage,
  driverFullName,
  formatDeliveryMoney,
} from "@/features/delivery/model";
import type {
  Driver,
  DriverOrder,
} from "@/features/delivery/types";
import { DriverProfileHeader } from "@/features/delivery/components/DriverProfileHeader";
import { DriverActiveOrdersCard } from "@/features/delivery/components/DriverActiveOrdersCard";
import { DriverSettlementCard } from "@/features/delivery/components/DriverSettlementCard";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function DriverDetail({ driverId }: { driverId: string }) {
  const t = useT("delivery");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [deliveredOrders, setDeliveredOrders] = useState<DriverOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);

  async function load() {
    setError(null);
    try {
      const [nextDriver, pending] = await Promise.all([
        getDriver(driverId),
        listPendingSettlementOrders(driverId),
      ]);
      setDriver(nextDriver);
      setDeliveredOrders(pending);
    } catch (cause) {
      setError(driverErrorMessage(cause, t));
    }
  }
  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [driverId, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.DELIVERY_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (error && !driver)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  if (!driver) return <Loading />;

  const recentOrders = driver.recentOrders ?? [];
  const activeOrders = recentOrders.filter(
    (order) => !["delivered", "returned", "cancelled"].includes(order.status),
  );

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        title={driverFullName(driver)}
        subtitle={t("driver_profile.subtitle")}
        backHref="/delivery/drivers"
        backLabel={t("tabs.drivers")}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <LinkButton
                href={`/delivery/drivers/${encodeURIComponent(driver.id)}/edit`}
                variant="secondary"
              >
                <Pencil size={16} />
                {t("actions.edit")}
              </LinkButton>
            </div>
          ) : undefined
        }
      />
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <DriverProfileHeader driver={driver} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label={t("driver_card.active_orders")}
          value={activeOrders.length}
        />
        <StatCard
          label={t("driver_card.total_delivered")}
          value={driver.totalDelivered}
        />
        <StatCard
          label={t("driver_card.pending_cash")}
          value={formatDeliveryMoney(driver.pendingCash, locale)}
          tone={driver.pendingCash > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label={t("driver_card.earnings")}
          value={formatDeliveryMoney(driver.totalEarnings, locale)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton
          href={`/delivery/drivers/${encodeURIComponent(driver.id)}/compensations`}
          variant="secondary"
        >
          <Truck size={15} />
          {t("compensations.title")}
          {driver.compensationWilayaCount
            ? ` (${driver.compensationWilayaCount})`
            : ""}
        </LinkButton>
      </div>
      <DriverActiveOrdersCard orders={activeOrders} />
      <DriverSettlementCard
        driverId={driver.id}
        deliveredOrders={deliveredOrders}
      />
    </div>
  );
}
