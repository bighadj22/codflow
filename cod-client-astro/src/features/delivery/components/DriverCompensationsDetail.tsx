import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { Alert, Button } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  getDriver,
  listDriverCompensations,
  listWilayas,
} from "@/features/delivery/api";
import {
  driverErrorMessage,
  driverFullName,
  driverInitials,
} from "@/features/delivery/model";
import type {
  Driver,
  DriverCompensation,
  Wilaya,
} from "@/features/delivery/types";
import { DriverCompensationsSection } from "@/features/delivery/components/DriverCompensationsSection";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function DriverCompensationsDetail({ driverId }: { driverId: string }) {
  const t = useT("delivery");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [compensations, setCompensations] = useState<DriverCompensation[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [nextDriver, nextCompensations, nextWilayas] = await Promise.all([
        getDriver(driverId),
        listDriverCompensations(driverId),
        listWilayas(),
      ]);
      setDriver(nextDriver);
      setCompensations(nextCompensations);
      setWilayas(nextWilayas);
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <a
        href={`/delivery/drivers/${encodeURIComponent(driver.id)}`}
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <X size={14} className="rotate-45" />
        {t("actions.back_to_driver")}
      </a>
      <a
        href={`/delivery/drivers/${encodeURIComponent(driver.id)}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs transition-colors hover:bg-muted/10"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {driverInitials(driver)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {driverFullName(driver)}
          </p>
          <p
            className="truncate text-[11px] font-bold text-muted-foreground/60"
            dir="ltr"
          >
            {driver.phone}
          </p>
        </div>
      </a>
      <DriverCompensationsSection
        driver={driver}
        compensations={compensations}
        wilayas={wilayas}
      />
    </div>
  );
}
