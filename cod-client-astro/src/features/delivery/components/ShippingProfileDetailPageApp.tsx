import { useEffect, useState } from "react";
import { AlertCircle, DollarSign, Edit, MapPin, Package, Package2, Star } from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Alert, Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { getShippingProfile } from "@/features/delivery/api";
import type { ShippingProfileWithRules } from "@/features/delivery/types";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function ShippingProfileDetail({ profileId }: { profileId: string }) {
  const t = useT("settings");
  const delivery = useT("delivery");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const [profile, setProfile] = useState<ShippingProfileWithRules | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  async function load() {
    setLoadError(null);
    try {
      setProfile(await getShippingProfile(profileId));
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);
  if (!canScope(identity, SCOPES.DELIVERY_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{delivery("error_load")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  if (profile === null) return <Loading />;

  const sortedRules = [...profile.rules].sort(
    (left, right) => left.wilayaId - right.wilayaId,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={profile.name}
        backHref="/delivery/shipping-profiles"
        backLabel={common("cancel")}
        actions={
          canManage ? (
            <LinkButton
              href={`/delivery/shipping-profiles/${encodeURIComponent(profile.id)}/edit`}
            >
              <Edit size={15} />
              {t("shipping.edit_action")}
            </LinkButton>
          ) : undefined
        }
      />
      <div
        className={`flex flex-col gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center ${
          profile.isDefault ? "border-primary/30" : "border-border"
        }`}
      >
        <span
          className={`grid size-14 shrink-0 place-items-center rounded-xl ${
            profile.isDefault
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Package size={26} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{profile.name}</h1>
            {profile.isDefault && (
              <Badge tone="success">
                <Star size={11} fill="currentColor" aria-hidden="true" />
                <span className="ms-1">{t("shipping.default_badge")}</span>
              </Badge>
            )}
          </div>
          {profile.notes && (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {profile.notes}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-primary/50" aria-hidden="true" />
              <span className="font-bold tabular-nums text-foreground">
                {profile.rules.length}
              </span>
              {t("shipping.card_wilayas")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Package2 size={12} className="text-primary/50" aria-hidden="true" />
              <span className="font-bold tabular-nums text-foreground">
                {profile.productCount ?? 0}
              </span>
              {t("shipping.card_products")}
            </span>
          </div>
        </div>
      </div>

      <Card title={t("shipping.pricing_matrix")}>
        {sortedRules.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground/50">
            <DollarSign size={24} aria-hidden="true" />
            <p className="text-sm font-semibold">
              {t("shipping.no_rates_configured")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[1fr_140px_140px] gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                <span>{t("shipping.wilaya")}</span>
                <span className="text-center">{t("shipping.home_delivery")}</span>
                <span className="text-center">{t("shipping.stop_desk")}</span>
              </div>
              <div className="divide-y divide-border">
                {sortedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid grid-cols-[1fr_140px_140px] items-center gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {rule.wilayaNameAr}
                      </p>
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                        {rule.wilayaName}
                      </p>
                    </div>
                    <div className="text-center">
                      {rule.homeEnabled ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-primary/10 bg-primary/5 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                          {rule.homePrice}
                          <span className="text-[9px] font-semibold uppercase opacity-60">
                            DA
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground/30">
                          —
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      {rule.stopDeskEnabled ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-sm font-bold tabular-nums text-foreground">
                          {rule.stopDeskPrice}
                          <span className="text-[9px] font-semibold uppercase opacity-50">
                            DA
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground/30">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Gated({ profileId }: { profileId: string }) {
  return (
    <DashboardChrome
      currentPath={`/delivery/shipping-profiles/${profileId}`}
    >
      <ShippingProfileDetail profileId={profileId} />
    </DashboardChrome>
  );
}

export default function ShippingProfileDetailPageApp({
  profileId,
}: {
  profileId: string;
}) {
  return (
    <RequireAuth>
      <Gated profileId={profileId} />
    </RequireAuth>
  );
}
