import { useState } from "react";
import { Copy, ExternalLink, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { publicApiUrl } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { saveYalidineSecret } from "@/features/delivery/api";
import type { DeliveryCompany } from "@/features/delivery/types";

/**
 * Yalidine webhook setup — lives on the credentials page (the webhook status
 * card on the company profile links here).
 *
 * The receiver URL is derived from the API base (never hardcoded); the
 * secret saves through the existing PATCH /webhook/secret endpoint. The
 * steps mirror the official dashboard flow (webook.md "Steps to receive
 * webhooks"): create the endpoint in Yalidine's Webhooks Dashboard with our
 * URL (the CRC challenge auto-validates — the receiver echoes crc_token),
 * subscribe to the event types, copy the secret back here, activate.
 */
export function CompanyWebhookSetupCard({
  company,
  canManage,
  onSaved,
}: {
  company: DeliveryCompany | null;
  canManage: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const t = useT("delivery_companies");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${publicApiUrl()}/webhooks/yalidine`;
  const secretSet = !!company?.webhookSecret;

  function copyUrl() {
    void navigator.clipboard?.writeText(webhookUrl).then(
      () => notify.success(t("webhook_url_copied")),
      () => notify.error(t("webhook_url_copy_failed")),
    );
  }

  async function save() {
    if (!company || !secret.trim()) return;
    setSaving(true);
    try {
      await saveYalidineSecret(company.id, secret.trim());
      notify.flashSuccess(t("webhook_secret_saved"));
      setSecret("");
      await onSaved();
    } catch {
      notify.error(t("webhook_secret_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          <Zap size={14} className="text-primary/50" aria-hidden="true" />
          {t("webhook_setup_title")}
        </h2>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
            secretSet
              ? "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]"
              : "bg-amber-500/10 text-amber-600",
          )}
        >
          {secretSet ? (
            <>
              <ShieldCheck size={12} aria-hidden="true" />
              {t("webhook_status_verified")}
            </>
          ) : (
            <>
              <ShieldAlert size={12} aria-hidden="true" />
              {t("webhook_status_unverified")}
            </>
          )}
        </span>
      </div>

      <div className="space-y-4">
        {!secretSet && (
          <Alert>
            <ShieldAlert size={16} className="shrink-0" />
            <span>{t("webhook_unverified_warning")}</span>
          </Alert>
        )}

        <Field label={t("webhook_url_label")}>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button type="button" variant="secondary" onClick={copyUrl}>
              <Copy size={14} />
              {t("webhook_url_copy")}
            </Button>
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
            {t("webhook_url_hint")}
          </p>
        </Field>

        <ol className="space-y-2 text-sm font-medium text-foreground">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {step}
              </span>
              <span className="leading-5">{t(`webhook_step_${step}`)}</span>
            </li>
          ))}
        </ol>

        <Field label={t("webhook_secret_label")}>
          <div className="flex gap-2">
            <Input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.currentTarget.value)}
              placeholder={secretSet ? t("webhook_secret_placeholder_set") : t("webhook_secret_placeholder")}
              disabled={!canManage}
              className="font-mono"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void save()}
              disabled={!canManage || !company || !secret.trim() || saving}
            >
              {saving ? t("saving") : t("webhook_secret_save")}
            </Button>
          </div>
        </Field>

        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
          <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
          {t("webhook_events_hint")}
        </p>
      </div>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm font-medium text-amber-700"
    >
      {children}
    </div>
  );
}
