import { useState, type ReactNode } from "react";
import { Check, Loader2, Save, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

export const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

/** Section card with icon header and a save action that reports inline status. */
export function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  children,
  onSave,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
  onSave: () => Promise<void>;
}) {
  const t = useT("settings");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSave() {
    setBusy(true);
    setStatus("idle");
    try {
      await onSave();
      setStatus("saved");
      notify.success(t("store.saved"));
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (cause) {
      const detail =
        cause instanceof Error && cause.message && cause.message !== "Error"
          ? cause.message
          : t("store.save_error");
      setError(detail);
      setStatus("error");
      notify.error(t("store.save_error"));
      window.setTimeout(() => setStatus("idle"), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
      <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
        {status === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600">
            <Check size={14} aria-hidden="true" />
            {t("store.saved")}
          </span>
        )}
        {status === "error" && (
          <span className="text-xs font-semibold text-destructive">{error}</span>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          {busy ? t("store.saving") : t("store.save")}
        </button>
      </div>
    </section>
  );
}

/** Label + control row with optional hint below the control. */
export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Color swatch + hex text input pair. */
export function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 space-y-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          maxLength={9}
          dir="ltr"
          className="h-9 w-28 rounded-lg border border-border bg-muted px-3 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>
    </div>
  );
}
