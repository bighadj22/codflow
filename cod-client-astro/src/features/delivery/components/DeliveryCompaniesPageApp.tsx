import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Package,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { listAllDeliveryCompanies } from "@/features/delivery/api";
import type { DeliveryCompany, ProviderConfig } from "@/features/delivery/types";
import { PROVIDER_CONFIGS } from "@/features/delivery/types";
import { Alert, EmptyState, PageHeader, SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils";

function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}

function matchesQuery(provider: ProviderConfig, query: string): boolean {
  if (!query) return true;
  const haystack = `${provider.name} ${provider.nameAr} ${provider.code}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function DeliveryCompaniesList() {
  const t = useT("delivery_companies");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const [companies, setCompanies] = useState<DeliveryCompany[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoadError(null);
    try {
      setCompanies(await listAllDeliveryCompanies());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.DELIVERY_READ)) {
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("error_load")}</p>
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
  }

  if (companies === null) return <Loading />;

  const providers = Object.values(PROVIDER_CONFIGS);
  const connectedCount = companies.filter((company) => company.isConnected).length;
  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);
  const visibleProviders = providers.filter((provider) => matchesQuery(provider, search));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/10 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
          <CheckCircle2 size={12} aria-hidden="true" />
          {connectedCount} / {providers.length} {t("connected")}
        </span>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("search_placeholder")}
          className="sm:max-w-sm"
        />
      </div>

      {visibleProviders.length === 0 ? (
        <EmptyState
          icon={<Package size={20} />}
          title={common("no_results_found")}
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visibleProviders.map((provider) => {
        const company = companies.find((item) => item.code === provider.code);
        const isConnected = company?.isConnected ?? false;
        const hasWebhook =
          provider.code === "zr_express"
            ? !!company?.webhookEndpointId
            : provider.code === "yalidine"
              ? !!company?.webhookSecret
              : false;

        return (
          <a
            key={provider.code}
            href={`/delivery/companies/${provider.code}`}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30",
              isConnected ? "border-primary/30" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold",
                    isConnected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {provider.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-foreground">
                    {provider.name}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      isConnected
                        ? "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {isConnected ? <CheckCircle2 size={9} /> : <Circle size={9} />}
                    {isConnected ? t("connected") : t("not_connected")}
                  </span>
                </span>
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {provider.supportsHomeDelivery && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Zap size={9} />
                  {t("capability_home")}
                </span>
              )}
              {provider.supportsStopDesk && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Package size={9} />
                  {t("capability_desk")}
                </span>
              )}
              {provider.supportsTracking && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <TrendingUp size={9} />
                  {t("capability_tracking")}
                </span>
              )}
              {hasWebhook && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--status-confirmed-text)]">
                  <Zap size={9} />
                  {t("capability_webhook")}
                </span>
              )}
            </div>

            {!isConnected && canManage && (
              <div className="mt-4 flex flex-1 items-end border-t border-border pt-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary/70">
                  {t("tap_to_connect")}
                </span>
              </div>
            )}
          </a>
        );
      })}
        </div>
      )}
    </div>
  );
}

function Gated() {
  const t = useT("delivery_companies");
  return (
    <DashboardChrome currentPath="/delivery/companies">
      <PageHeader title={t("page_title")} />
      <DeliveryCompaniesList />
    </DashboardChrome>
  );
}

export default function DeliveryCompaniesPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
