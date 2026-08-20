"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Globe, ExternalLink, CheckCircle2, Circle, Zap, Package,
  TrendingUp, RefreshCw, MapPin, Settings, Lock, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { WebhookDialog } from "./webhook-dialog";
import { useDelivery } from "@/lib/translations";
import type { DeliveryCompany } from "@/types";
import { syncCompanyStopDesks, updateDeliveryCompany } from "@/actions/delivery-companies";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { getProviderConfig } from "@/lib/delivery/providers";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n-context";

interface Props {
  providerCode: string;
  company: DeliveryCompany | null;
  userScopes: string[];
}

export function CompanyProfilePage({ providerCode, company, userScopes }: Props) {
  const t = useDelivery();
  const locale = useErrorLocale();
  const router = useRouter();
  const { dir } = useLanguage();

  const [webhookOpen, setWebhookOpen] = useState(false);
  const [syncingDesks, startSyncDesks] = useTransition();
  const [autoValidate, setAutoValidate] = useState(company?.autoValidate ?? true);
  const [savingAutoValidate, startSaveAutoValidate] = useTransition();

  const config = getProviderConfig(providerCode)!;
  const isConnected = company?.isConnected ?? false;

  const hasWebhook = providerCode === "zr_express"
    ? !!company?.webhookEndpointId
    : providerCode === "yalidine"
      ? !!company?.webhookSecret
      : false;
  const supportsWebhook = providerCode === "zr_express" || providerCode === "yalidine";

  function handleSyncDesks() {
    if (!company) return;
    startSyncDesks(async () => {
      try {
        const result = await syncCompanyStopDesks(company.id);
        const baseMsg = t.companies?.sync_desks_success ?? "Stop desks synced";
        // Only mention the removed count when there was a cleanup — keeps the
        // common-case toast short ("Stop desks synced — 1359 desks").
        const detail = result.removed > 0
          ? `${result.total} ${t.companies?.desks ?? "desks"} · ${result.removed} ${t.companies?.removed ?? "removed"}`
          : `${result.total} ${t.companies?.desks ?? "desks"}`;
        showSuccessToast(`${baseMsg} — ${detail}`, locale);
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Error", locale);
      }
    });
  }

  function handleToggleAutoValidate(checked: boolean) {
    if (!company) return;
    // Optimistic: flip UI immediately, roll back on failure.
    const previous = autoValidate;
    setAutoValidate(checked);
    startSaveAutoValidate(async () => {
      try {
        await updateDeliveryCompany(company.id, { autoValidate: checked });
        showSuccessToast(
          checked
            ? (t.auto_validate?.enabled_toast ?? "Auto-validate enabled.")
            : (t.auto_validate?.disabled_toast ?? "Auto-validate disabled."),
          locale,
        );
      } catch (err) {
        setAutoValidate(previous);
        showErrorToast(err instanceof Error ? err.message : "Error", locale);
      }
    });
  }

  // EcoTrack-family carriers (Packers, etc.) lock orders at the carrier as soon as
  // validate/order is called. Flagging this in the UI makes the recommendation
  // ("keep auto-validate OFF") concrete for the user.
  const isEcotrackProvider = providerCode === "ecotrack" || providerCode.endsWith("_ecotrack");

  return (
    <>
      <div className="space-y-6 animate-fade-in">

        {/* Back */}
        <button
          onClick={() => router.push("/delivery/companies")}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors group"
        >
          <ArrowRight
            size={13}
            className={cn(
              "transition-transform shrink-0",
              dir === "rtl" ? "group-hover:translate-x-0.5" : "rotate-180 group-hover:-translate-x-0.5"
            )}
          />
          {t.tabs?.companies ?? "Companies"}
        </button>

        {/* ── Hero header ───────────────────────────────────── */}
        <div className={cn(
          "glass-card rounded-2xl border-border/30 overflow-hidden",
          isConnected && "border-primary/10"
        )}>
          {isConnected && <div className="h-[3px] bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />}
          <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Logo */}
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-black shadow-md",
              isConnected
                ? "bg-primary text-primary-foreground shadow-primary/20"
                : "bg-muted text-muted-foreground/30"
            )}>
              {config.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-foreground tracking-tight">{config.name}</h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground/50 border-border/30"
                )}>
                  {isConnected ? <CheckCircle2 size={9} /> : <Circle size={9} />}
                  {isConnected ? t.providers?.connected ?? "Connected" : t.providers?.not_connected ?? "Not connected"}
                </span>
              </div>

              <a
                href={config.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/40 hover:text-primary transition-colors mt-1"
              >
                <Globe size={10} />
                {new URL(config.website).hostname}
                <ExternalLink size={9} />
              </a>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {config.supportsHomeDelivery && (
                  <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Zap size={9} />{t.delivery_type?.home ?? "Home"}
                  </span>
                )}
                {config.supportsStopDesk && (
                  <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Package size={9} />{t.delivery_type?.stop_desk ?? "Stop Desk"}
                  </span>
                )}
                {config.supportsTracking && (
                  <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp size={9} />{t.companies?.tracking ?? "Tracking"}
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
              <Button
                size="lg"
                variant={isConnected ? "outline" : "default"}
                className="h-11 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] active:scale-95 shrink-0 w-full sm:w-auto"
                onClick={() => router.push(`/delivery/companies/${providerCode}/credentials`)}
              >
                <Settings size={14} className="me-2" />
                {isConnected ? t.providers?.configure ?? "Configure" : t.providers?.connect ?? "Connect"}
              </Button>
            </ProtectedAction>
          </div>
        </div>

        {/* ── Two-column grid on desktop ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left col — Webhook */}
          <div className="lg:col-span-2 space-y-5">
            {supportsWebhook && (
              <button
                onClick={() => isConnected && setWebhookOpen(true)}
                disabled={!isConnected}
                className={cn(
                  "w-full glass-card rounded-2xl border-border/30 p-5 text-start transition-all group",
                  isConnected ? "hover:border-primary/15 hover:shadow-sm active:scale-[0.995] cursor-pointer" : "opacity-50 cursor-default",
                  isConnected && hasWebhook && "border-emerald-500/15"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      hasWebhook ? "bg-emerald-500/10" : "bg-muted/30"
                    )}>
                      <Zap className={cn("w-4.5 h-4.5", hasWebhook ? "text-emerald-500" : "text-muted-foreground/30")} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground/80">{t.webhook?.title ?? "Real-time Updates"}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground/50 mt-0.5">
                        {!isConnected ? (t.providers?.connect_first ?? "Connect first")
                          : hasWebhook ? t.webhook?.active ?? "Active"
                          : t.webhook?.not_configured ?? "Not configured"}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    !isConnected ? "bg-muted-foreground/20" : hasWebhook ? "bg-emerald-500 shadow-sm shadow-emerald-500/40" : "bg-muted-foreground/20"
                  )} />
                </div>
              </button>
            )}
          </div>

          {/* Right col — Stop Desks (sync + manage) */}
          {config.supportsStopDesk && (
            <div className="lg:col-span-1">
              <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
                <div className={cn(
                  "glass-card rounded-2xl border-border/30 p-5 h-full transition-opacity",
                  !isConnected && "opacity-50 pointer-events-none"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                      {t.companies?.data_sync ?? "Data Sync"}
                    </h2>
                    {!isConnected && <Lock size={11} className="text-muted-foreground/30" />}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSyncDesks}
                      disabled={syncingDesks || !isConnected}
                      className="flex items-center gap-3 w-full h-11 px-4 rounded-xl border border-border/20 bg-muted/10 hover:bg-primary/5 hover:border-primary/15 text-muted-foreground hover:text-primary text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-start"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", syncingDesks && "animate-spin")} />
                      {t.companies?.sync_desks ?? "Sync Desks"}
                    </button>

                    <button
                      onClick={() => router.push(`/delivery/companies/${providerCode}/stop-desks`)}
                      disabled={!isConnected}
                      className="flex items-center gap-3 w-full h-11 px-4 rounded-xl border border-border/20 bg-muted/10 hover:bg-primary/5 hover:border-primary/15 text-muted-foreground hover:text-primary text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-start"
                    >
                      <MapPin size={14} className="shrink-0" />
                      {t.companies?.manage_desks ?? "Manage Desks"}
                    </button>
                  </div>
                </div>
              </ProtectedAction>
            </div>
          )}
        </div>

        {/* ── Dispatch behavior — Auto-validate toggle ─────────
           Critical carrier-contract setting. Copy is pulled from translations
           (en/fr/ar) so the English wording never gets baked in. */}
        {company && (
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
            <div className="glass-card rounded-2xl border-border/30 p-4 sm:p-5">
              {/* On mobile: label + paragraph stack over the switch on its own row.
                  From sm: header and switch sit side-by-side, paragraph below. */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0",
                    autoValidate ? "bg-amber-500/10" : "bg-emerald-500/10"
                  )}>
                    {autoValidate
                      ? <ShieldAlert className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-500" />
                      : <ShieldCheck className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-emerald-500" />}
                  </div>
                  <p className="text-[13px] sm:text-sm font-black text-foreground/80 truncate">
                    {t.auto_validate?.title ?? "Auto-Validate on Dispatch"}
                  </p>
                </div>
                <Switch
                  checked={autoValidate}
                  onCheckedChange={handleToggleAutoValidate}
                  disabled={savingAutoValidate}
                  className="scale-90 sm:scale-100 shrink-0"
                />
              </div>

              <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground/60 mt-3 leading-relaxed">
                {autoValidate
                  ? (t.auto_validate?.on_description  ?? "Orders lock at the carrier on dispatch.")
                  : (t.auto_validate?.off_description ?? "Orders stay editable until manually confirmed.")}
              </p>

              {isEcotrackProvider && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                    {t.auto_validate?.ecotrack_warning_prefix ?? "Recommended: keep"}{" "}
                    <span className="font-black">
                      {t.auto_validate?.ecotrack_warning_off ?? "OFF"}
                    </span>{" "}
                    {t.auto_validate?.ecotrack_warning_suffix ?? "for EcoTrack-family carriers."}
                  </p>
                </div>
              )}
            </div>
          </ProtectedAction>
        )}
      </div>

      {company && supportsWebhook && (
        <WebhookDialog
          open={webhookOpen}
          onClose={() => setWebhookOpen(false)}
          company={company}
        />
      )}
    </>
  );
}
