import { CheckCircle2, Circle, ExternalLink, Globe, Package, Settings, TrendingUp, Zap } from "lucide-react";
import { useT } from "@/i18n/react";
import { cn } from "@/lib/utils";
import type { DeliveryCompany, ProviderConfig } from "@/features/delivery/types";

export function CompanyHeroCard({
  config,
  company,
  providerCode,
  canManage,
}: {
  config: ProviderConfig;
  company: DeliveryCompany | null;
  providerCode: string;
  canManage: boolean;
}) {
  const t = useT("delivery_companies");
  const isConnected = company?.isConnected ?? false;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 sm:p-6",
        isConnected ? "border-primary/30" : "border-border",
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          className={cn(
            "grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold shadow-xs",
            isConnected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {config.name.charAt(0)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{config.name}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                isConnected
                  ? "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {isConnected ? <CheckCircle2 size={9} /> : <Circle size={9} />}
              {isConnected ? t("connected") : t("not_connected")}
            </span>
          </div>

          <a
            href={config.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <Globe size={11} aria-hidden="true" />
            {new URL(config.website).hostname}
            <ExternalLink size={9} aria-hidden="true" />
          </a>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {config.supportsHomeDelivery && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Zap size={9} />
                {t("capability_home")}
              </span>
            )}
            {config.supportsStopDesk && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Package size={9} />
                {t("capability_desk")}
              </span>
            )}
            {config.supportsTracking && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <TrendingUp size={9} />
                {t("capability_tracking")}
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <a
            href={`/delivery/companies/${providerCode}/credentials`}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted sm:w-auto"
          >
            <Settings size={14} />
            {isConnected ? t("configure") : t("connect")}
          </a>
        )}
      </div>
    </div>
  );
}
