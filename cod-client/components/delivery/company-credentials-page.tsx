"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ShieldCheck, Zap, Trash2, Key, Globe, ExternalLink,
  CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeliveryCompany } from "@/types";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useDelivery, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { useLanguage } from "@/lib/i18n-context";
import { createDeliveryCompany, updateDeliveryCompany } from "@/actions/delivery-companies";
import { getProviderConfig } from "@/lib/delivery/providers";
import { cn } from "@/lib/utils";

interface Props {
  providerCode: string;
  existingCompany?: DeliveryCompany | null;
}

export function CompanyCredentialsPage({ providerCode, existingCompany }: Props) {
  const t = useDelivery();
  const common = useCommon();
  const locale = useErrorLocale();
  const router = useRouter();
  const { dir } = useLanguage();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const config = getProviderConfig(providerCode)!;
  const isConnected = existingCompany?.isConnected ?? false;

  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [apiUserGuid, setApiUserGuid] = useState("");
  const [fromWilayaName, setFromWilayaName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState(existingCompany?.apiEndpoint ?? config.endpointDefault ?? "");

  useEffect(() => {
    setApiToken("");
    setApiUserGuid("");
    setApiEndpoint(existingCompany?.apiEndpoint ?? config.endpointDefault ?? "");
    let parsedWilaya = "";
    if (existingCompany?.notes) {
      try {
        const n = JSON.parse(existingCompany.notes) as { from_wilaya_name?: string };
        parsedWilaya = n.from_wilaya_name ?? "";
      } catch { /* ignore */ }
    }
    setFromWilayaName(parsedWilaya);
  }, [existingCompany]);

  const busy = loading || disconnecting;

  async function handleSave() {
    if (!apiToken.trim()) {
      showErrorToast((config.tokenLabel ?? t.credentials_dialog.api_token_label) + " is required", locale);
      return;
    }
    if (config.requiresUserGuid && !apiUserGuid.trim()) {
      showErrorToast((config.guidLabel ?? t.credentials_dialog.user_guid_label) + " is required", locale);
      return;
    }

    setLoading(true);
    try {
      const credentials: Record<string, string | null | boolean> = {
        apiToken: apiToken.trim(),
        ...(config.requiresUserGuid ? { apiUserGuid: apiUserGuid.trim() } : {}),
        ...(config.requiresEndpoint
          ? { apiEndpoint: apiEndpoint.trim() || config.endpointDefault || config.apiEndpoint }
          : {}),
      };

      if (config.requiresFromWilaya) {
        const notesJson: Record<string, string> = {};
        const wilaya = fromWilayaName.trim();
        if (wilaya) notesJson.from_wilaya_name = wilaya;
        credentials.notes = Object.keys(notesJson).length > 0 ? JSON.stringify(notesJson) : null;
      }

      if (existingCompany) {
        await updateDeliveryCompany(existingCompany.id, { ...credentials, active: true });
        showSuccessToast(t.credentials_dialog.success_updated, locale);
      } else {
        await createDeliveryCompany({
          name: config.name,
          nameAr: config.nameAr,
          code: config.code,
          website: config.website,
          apiEndpoint: config.apiEndpoint,
          supportsHomeDelivery: config.supportsHomeDelivery,
          supportsStopDesk: config.supportsStopDesk,
          supportsTracking: config.supportsTracking,
          active: true,
          ...credentials,
        });
        showSuccessToast(t.credentials_dialog.success_connected, locale);
      }

      router.push(`/delivery/companies/${providerCode}`);
      router.refresh();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to save", locale);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!existingCompany) return;
    const ok = await confirmDialog({
      title: `${t.credentials_dialog.disconnect} ${config.name}?`,
      variant: "destructive",
      confirmLabel: common.disconnect,
    });
    if (!ok) return;

    setDisconnecting(true);
    try {
      await updateDeliveryCompany(existingCompany.id, { apiToken: null, apiUserGuid: null, active: false });
      showSuccessToast(t.credentials_dialog.success_disconnected, locale);
      router.push(`/delivery/companies/${providerCode}`);
      router.refresh();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to disconnect", locale);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">

        {/* Back */}
        <button
          onClick={() => router.push(`/delivery/companies/${providerCode}`)}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors group"
        >
          <ArrowRight
            size={13}
            className={cn(
              "transition-transform shrink-0",
              dir === "rtl" ? "group-hover:translate-x-0.5" : "rotate-180 group-hover:-translate-x-0.5"
            )}
          />
          {config.name}
        </button>

        {/* Hero header — matches profile page style */}
        <div className={cn(
          "glass-card rounded-2xl border-border/30 overflow-hidden",
          isConnected ? "border-emerald-500/10" : "border-primary/10"
        )}>
          <div className={cn(
            "h-[3px]",
            isConnected
              ? "bg-gradient-to-r from-emerald-500/60 via-emerald-500/20 to-transparent"
              : "bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
          )} />
          <div className="p-6 flex items-center gap-5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
              isConnected ? "bg-emerald-500/10" : "bg-primary/10"
            )}>
              {isConnected
                ? <ShieldCheck size={24} className="text-emerald-500" />
                : <Key size={24} className="text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-black text-foreground tracking-tight">
                  {isConnected ? t.credentials_dialog.title_configure : t.credentials_dialog.title_connect}
                </h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground/50 border-border/30"
                )}>
                  {isConnected ? <CheckCircle2 size={8} /> : <Circle size={8} />}
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
            </div>
          </div>
        </div>

        {/* Two-column: form left, help right on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Form */}
          <div className="lg:col-span-2 glass-card rounded-2xl border-border/30 p-6 space-y-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              {t.credentials_dialog.api_credentials ?? "API Credentials"}
            </h2>

            {/* API Token */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                {config.tokenLabel ?? (config.requiresEndpoint
                  ? t.credentials_dialog.ecotrack_token
                  : t.credentials_dialog.api_token_label)}
              </Label>
              <Input
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                type="password"
                placeholder={isConnected ? "••••••••••••••••" : (config.tokenLabel ?? "API Token")}
                className="h-12 bg-muted/20 border-border/30 rounded-xl px-4 text-sm font-bold font-mono tracking-widest focus:border-primary/30 transition-all"
                dir="ltr"
                disabled={busy}
                autoComplete="off"
              />
              {(config.tokenHint ?? (config.requiresEndpoint ? t.credentials_dialog.ecotrack_token_hint : null)) && (
                <p className="text-[10px] text-muted-foreground/40 font-medium leading-relaxed">
                  {config.tokenHint ?? t.credentials_dialog.ecotrack_token_hint}
                </p>
              )}
            </div>

            {/* User GUID */}
            {config.requiresUserGuid && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                  {config.guidLabel ?? (config.code === "zr_express"
                    ? t.credentials_dialog.tenant_id
                    : t.credentials_dialog.user_guid_label)}
                </Label>
                <Input
                  value={apiUserGuid}
                  onChange={(e) => setApiUserGuid(e.target.value)}
                  placeholder={config.guidLabel ?? "User ID / GUID"}
                  className="h-12 bg-muted/20 border-border/30 rounded-xl px-4 text-sm font-bold font-mono tracking-wider focus:border-primary/30 transition-all"
                  dir="ltr"
                  disabled={busy}
                  autoComplete="off"
                />
                {config.guidHint && (
                  <p className="text-[10px] text-muted-foreground/40 font-medium leading-relaxed">
                    {config.guidHint}
                  </p>
                )}
              </div>
            )}

            {/* From Wilaya */}
            {config.requiresFromWilaya && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                  {t.credentials_dialog.from_wilaya_label}
                </Label>
                <Input
                  value={fromWilayaName}
                  onChange={(e) => setFromWilayaName(e.target.value)}
                  placeholder={t.credentials_dialog.wilaya_placeholder}
                  className="h-12 bg-muted/20 border-border/30 rounded-xl px-4 text-sm font-bold focus:border-primary/30 transition-all"
                  dir="ltr"
                  disabled={busy}
                  autoComplete="off"
                />
                <p className="text-[10px] text-muted-foreground/40 font-medium leading-relaxed">
                  {t.credentials_dialog.from_wilaya_hint}
                </p>
              </div>
            )}

            {/* Endpoint */}
            {config.requiresEndpoint && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                  {config.endpointLabel ?? t.credentials_dialog.ecotrack_endpoint}
                </Label>
                <Input
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder={config.endpointDefault ?? "https://"}
                  className="h-12 bg-muted/20 border-border/30 rounded-xl px-4 text-sm font-bold font-mono tracking-wider focus:border-primary/30 transition-all"
                  dir="ltr"
                  disabled={busy}
                  autoComplete="off"
                />
                {config.endpointHint && (
                  <p className="text-[10px] text-muted-foreground/40 font-medium leading-relaxed">
                    {config.endpointHint}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: actions + security note */}
          <div className="lg:col-span-1 flex flex-col gap-4">

            {/* Save / Cancel */}
            <div className="glass-card rounded-2xl border-border/30 p-5 space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">
                {t.credentials_dialog.actions ?? "Actions"}
              </h2>
              <Button
                onClick={handleSave}
                disabled={busy}
                className="w-full h-12 rounded-xl font-black text-[11px] uppercase tracking-[0.2em]"
              >
                {loading
                  ? t.credentials_dialog.saving
                  : isConnected
                    ? t.credentials_dialog.save
                    : t.credentials_dialog.connect}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/delivery/companies/${providerCode}`)}
                disabled={busy}
                className="w-full h-12 rounded-xl border-border/30 font-black text-[11px] uppercase tracking-widest"
              >
                {t.credentials_dialog.cancel}
              </Button>

              {isConnected && (
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="w-full h-12 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-black text-[11px] uppercase tracking-widest"
                >
                  <Trash2 size={13} className="me-2" />
                  {disconnecting ? t.credentials_dialog.saving : t.credentials_dialog.disconnect}
                </Button>
              )}
            </div>

            {/* Security note */}
            <div className="glass-card rounded-2xl border-border/30 p-5 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-primary/50 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{t.credentials_dialog.security ?? "Security"}</p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground/50 leading-relaxed">
                {t.credentials_dialog.security_note ?? "Credentials are stored encrypted and never returned by the API. Re-enter them each time you update."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {ConfirmDialog}
    </>
  );
}
