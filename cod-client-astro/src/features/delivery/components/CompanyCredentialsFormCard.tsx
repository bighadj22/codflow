import { CheckCircle2, Circle, ExternalLink, Globe, Key, ShieldCheck } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { cn } from "@/lib/utils";
import type { DeliveryCompany, ProviderConfig } from "@/features/delivery/types";

export function CompanyCredentialsFormCard({
  config,
  company,
  apiToken,
  onApiTokenChange,
  apiUserGuid,
  onApiUserGuidChange,
  fromWilayaName,
  onFromWilayaNameChange,
  apiEndpoint,
  onApiEndpointChange,
  busy,
}: {
  config: ProviderConfig;
  company: DeliveryCompany | null;
  apiToken: string;
  onApiTokenChange: (val: string) => void;
  apiUserGuid: string;
  onApiUserGuidChange: (val: string) => void;
  fromWilayaName: string;
  onFromWilayaNameChange: (val: string) => void;
  apiEndpoint: string;
  onApiEndpointChange: (val: string) => void;
  busy: boolean;
}) {
  const t = useT("delivery_companies");
  const isConnected = company?.isConnected ?? false;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2">
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            isConnected ? "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]" : "bg-primary/10 text-primary",
          )}
        >
          {isConnected ? <ShieldCheck size={18} /> : <Key size={18} />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">
              {isConnected ? t("credentials_title_configure") : t("credentials_title_connect")}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
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
        </div>
      </div>

      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {t("api_credentials")}
      </h2>

      <Field label={config.tokenLabel ?? (config.requiresEndpoint ? t("ecotrack_token") : t("api_token"))}>
        <Input
          value={apiToken}
          onChange={(event) => onApiTokenChange(event.currentTarget.value)}
          type="password"
          placeholder={isConnected ? "••••••••••••••••" : (config.tokenLabel ?? t("api_token"))}
          dir="ltr"
          disabled={busy}
          autoComplete="off"
          className="font-mono"
        />
        {config.tokenHint && (
          <p className="mt-1 text-xs font-medium text-muted-foreground/60">
            {config.tokenHint}
          </p>
        )}
      </Field>

      {config.requiresUserGuid && (
        <Field label={config.guidLabel ?? (config.code === "zr_express" ? t("tenant_id") : t("user_guid"))}>
          <Input
            value={apiUserGuid}
            onChange={(event) => onApiUserGuidChange(event.currentTarget.value)}
            placeholder={config.guidLabel ?? "User ID / GUID"}
            dir="ltr"
            disabled={busy}
            autoComplete="off"
            className="font-mono"
          />
          {config.guidHint && (
            <p className="mt-1 text-xs font-medium text-muted-foreground/60">
              {config.guidHint}
            </p>
          )}
        </Field>
      )}

      {config.requiresFromWilaya && (
        <Field label={t("from_wilaya")}>
          <Input
            value={fromWilayaName}
            onChange={(event) => onFromWilayaNameChange(event.currentTarget.value)}
            placeholder="Alger"
            dir="ltr"
            disabled={busy}
            autoComplete="off"
          />
          <p className="mt-1 text-xs font-medium text-muted-foreground/60">
            {t("from_wilaya_hint")}
          </p>
        </Field>
      )}

      {config.requiresEndpoint && (
        <Field label={config.endpointLabel ?? t("ecotrack_endpoint")}>
          <Input
            value={apiEndpoint}
            onChange={(event) => onApiEndpointChange(event.currentTarget.value)}
            placeholder={config.endpointDefault ?? "https://"}
            dir="ltr"
            disabled={busy}
            autoComplete="off"
            className="font-mono"
          />
          {config.endpointHint && (
            <p className="mt-1 text-xs font-medium text-muted-foreground/60">
              {config.endpointHint}
            </p>
          )}
        </Field>
      )}
    </div>
  );
}
