import {
  Lock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/react";
import { cn } from "@/lib/utils";
import type { DeliveryCompany, ProviderConfig } from "@/features/delivery/types";

export function CompanySettingsSection({
  config,
  company,
  providerCode,
  canManage,
  autoValidate,
  savingAutoValidate,
  onToggleAutoValidate,
  syncingDesks,
  onSyncDesks,
}: {
  config: ProviderConfig;
  company: DeliveryCompany | null;
  providerCode: string;
  canManage: boolean;
  autoValidate: boolean;
  savingAutoValidate: boolean;
  onToggleAutoValidate: () => void;
  syncingDesks: boolean;
  onSyncDesks: () => void;
}) {
  const t = useT("delivery_companies");
  const isConnected = company?.isConnected ?? false;
  const hasWebhook =
    providerCode === "zr_express"
      ? !!company?.webhookEndpointId
      : providerCode === "yalidine"
        ? !!company?.webhookSecret
        : false;
  const supportsWebhook = providerCode === "zr_express" || providerCode === "yalidine";
  const isEcotrackProvider = providerCode === "ecotrack" || providerCode.endsWith("_ecotrack");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {supportsWebhook && (
          <a
            href={`/delivery/companies/${providerCode}/credentials`}
            aria-disabled={!isConnected}
            className={cn(
              "block rounded-xl border bg-card p-5 transition-colors",
              isConnected
                ? "border-border hover:bg-muted/30"
                : "pointer-events-none border-border opacity-50",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    hasWebhook ? "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Zap size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">
                    {t("webhook_title")}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-muted-foreground/60">
                    {!isConnected
                      ? t("connect_first")
                      : hasWebhook
                        ? t("webhook_active")
                        : t("webhook_not_configured")}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  hasWebhook ? "bg-violet-500 shadow-xs shadow-violet-500/40" : "bg-muted-foreground/20",
                )}
              />
            </div>
          </a>
        )}

        {company && canManage && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    autoValidate ? "bg-amber-500/10 text-amber-500" : "bg-violet-500/10 text-violet-500",
                  )}
                >
                  {autoValidate ? (
                    <ShieldAlert size={17} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={17} aria-hidden="true" />
                  )}
                </span>
                <span className="truncate text-sm font-bold text-foreground">
                  {t("auto_validate_title")}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoValidate}
                onClick={onToggleAutoValidate}
                disabled={savingAutoValidate}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  autoValidate ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                    autoValidate ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground/60">
              {autoValidate ? t("auto_validate_on") : t("auto_validate_off")}
            </p>

            {isEcotrackProvider && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="text-xs font-semibold leading-relaxed text-amber-600">
                  {t("ecotrack_warning")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {config.supportsStopDesk && canManage && (
        <div
          className={cn(
            "h-fit rounded-xl border border-border bg-card p-5",
            !isConnected && "pointer-events-none opacity-50",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t("data_sync")}
            </h2>
            {!isConnected && <Lock size={11} className="text-muted-foreground/30" aria-hidden="true" />}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onSyncDesks}
              disabled={syncingDesks || !isConnected}
              className="justify-start"
            >
              <RefreshCw size={14} className={cn(syncingDesks && "animate-spin")} />
              {t("sync_desks")}
            </Button>
            <a
              href={`/delivery/companies/${providerCode}/stop-desks`}
              className={cn(
                "inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted",
                !isConnected && "pointer-events-none",
              )}
            >
              <MapPin size={14} />
              {t("manage_desks")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
