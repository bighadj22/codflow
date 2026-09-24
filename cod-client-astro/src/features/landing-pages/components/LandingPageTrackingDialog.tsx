import { useEffect, useRef, useState } from "react";
import { BarChart2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Dialog, Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import {
  ConversionEventPicker,
  type ConversionEvent,
} from "@/components/tracking/ConversionEventPicker";
import {
  deleteLandingPageTracking,
  saveLandingPageTracking,
} from "@/features/landing-pages/api";
import { landingPageErrorMessage } from "@/features/landing-pages/model";
import type { LandingPageTracking } from "@/features/landing-pages/types";

/**
 * Give one landing page its own Meta pixel.
 *
 * A dialog rather than a fourth pane in the Studio: a pixel id, a credential
 * and a four-option conversion picker do not fit a 240px column, and they are
 * not something a merchant adjusts while looking at the preview. The Studio
 * keeps its three panes about how the page looks.
 *
 * The token is write-only everywhere — the field starts empty on an edit and
 * an untouched field keeps what is stored.
 */
export function LandingPageTrackingDialog({
  landingPageId,
  existing,
  open,
  onClose,
  onSaved,
}: {
  landingPageId: string;
  existing: LandingPageTracking | null;
  open: boolean;
  onClose: () => void;
  onSaved: (tracking: LandingPageTracking | null) => void;
}) {
  const t = useT("landing-pages");
  const settings = useT("settings");
  const common = useT("common");

  const [pixelId, setPixelId] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [conversionEvent, setConversionEvent] = useState<ConversionEvent | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const pixelRef = useRef<HTMLInputElement>(null);

  // Reset from the stored row every time the dialog opens, so a cancelled edit
  // never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setPixelId(existing?.pixelId ?? "");
    setAdAccountName(existing?.adAccountName ?? "");
    setAccessToken("");
    setShowToken(false);
    setConversionEvent(existing?.conversionEvent ?? null);
    setTestMode(existing?.testMode ?? false);
    setTestEventCode(existing?.testEventCode ?? "");
  }, [open, existing]);

  const busy = saving || removing;

  async function handleSave() {
    if (!pixelId.trim()) {
      notify.error(`${settings("store.tracking_pixel_id_label")} — ${t("tracking.required")}`);
      return;
    }
    if (!conversionEvent) {
      notify.error(`${settings("store.tracking_event_label")} — ${t("tracking.required")}`);
      return;
    }
    // Required on create, optional afterwards — the server enforces the same
    // rule, this only saves the merchant a round trip.
    if (!existing && !accessToken.trim()) {
      notify.error(`${settings("store.tracking_token_label")} — ${t("tracking.required")}`);
      return;
    }
    if (testMode && !testEventCode.trim()) {
      notify.error(`${settings("store.tracking_test_code_label")} — ${t("tracking.required")}`);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveLandingPageTracking(landingPageId, {
        pixelId: pixelId.trim(),
        adAccountName: adAccountName.trim() || null,
        accessToken: accessToken.trim() || undefined,
        conversionEvent,
        testMode,
        testEventCode: testEventCode.trim() || null,
      });
      notify.success(common("feedback.saved"));
      onSaved(saved);
      onClose();
    } catch (cause) {
      notify.error(landingPageErrorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteLandingPageTracking(landingPageId);
      notify.success(common("feedback.saved"));
      onSaved(null);
      onClose();
    } catch (cause) {
      notify.error(landingPageErrorMessage(cause, t));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      preventClose={busy}
      icon={<BarChart2 size={18} aria-hidden="true" />}
      title={t("tracking.dialog_title")}
      description={t("tracking.dialog_description")}
      initialFocusRef={pixelRef}
      footer={
        <>
          {existing && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={busy}
              className="sm:me-auto"
            >
              {removing && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {t("tracking.use_store_pixel")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {common("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {t("studio.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={settings("store.tracking_pixel_id_label")} hint={t("tracking.pixel_id_hint")}>
          <Input
            ref={pixelRef}
            dir="ltr"
            value={pixelId}
            disabled={busy}
            onChange={(event) => setPixelId(event.currentTarget.value)}
            placeholder={settings("store.tracking_pixel_id_placeholder")}
          />
        </Field>

        <Field label={settings("store.tracking_token_label")} hint={t("tracking.token_hint")}>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              dir="ltr"
              value={accessToken}
              disabled={busy}
              onChange={(event) => setAccessToken(event.currentTarget.value)}
              placeholder={
                existing?.accessTokenMasked ?? settings("store.tracking_token_placeholder")
              }
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShowToken((current) => !current)}
              tabIndex={-1}
              aria-label={
                showToken ? settings("store.api_key_hide") : settings("store.api_key_reveal")
              }
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {existing && !accessToken && (
            <p className="text-xs text-muted-foreground">
              {settings("store.otp_key_stored")}:{" "}
              <span dir="ltr">{existing.accessTokenMasked}</span>
            </p>
          )}
        </Field>

        <Field
          label={settings("store.tracking_ad_account_label")}
          hint={settings("store.tracking_ad_account_hint")}
        >
          <Input
            dir="ltr"
            value={adAccountName}
            disabled={busy}
            onChange={(event) => setAdAccountName(event.currentTarget.value)}
            placeholder={settings("store.tracking_ad_account_placeholder")}
          />
        </Field>

        <div className="space-y-2.5">
          <div>
            <span className="text-xs font-semibold text-foreground">
              {settings("store.tracking_event_label")}
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("tracking.event_description")}
            </p>
          </div>
          <ConversionEventPicker
            value={conversionEvent}
            onChange={setConversionEvent}
            disabled={busy}
            compact
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-foreground">
              {settings("store.tracking_test_mode_label")}
            </span>
            <p className="text-xs text-muted-foreground">
              {settings("store.tracking_test_mode_hint")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={testMode}
            aria-label={settings("store.tracking_test_mode_label")}
            disabled={busy}
            onClick={() => setTestMode((current) => !current)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
              testMode ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                testMode ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {testMode && (
          <>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">
              {settings("store.tracking_test_mode_warning")}
            </p>
            <Field
              label={settings("store.tracking_test_code_label")}
              hint={settings("store.tracking_test_code_hint")}
            >
              <Input
                dir="ltr"
                value={testEventCode}
                disabled={busy}
                onChange={(event) => setTestEventCode(event.currentTarget.value)}
                placeholder={settings("store.tracking_test_code_placeholder")}
              />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
