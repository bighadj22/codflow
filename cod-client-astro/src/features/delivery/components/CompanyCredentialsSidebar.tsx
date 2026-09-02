import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/react";

export function CompanyCredentialsSidebar({
  providerCode,
  isConnected,
  busy,
  loading,
  disconnecting,
  onSave,
  onDisconnect,
}: {
  providerCode: string;
  isConnected: boolean;
  busy: boolean;
  loading: boolean;
  disconnecting: boolean;
  onSave: () => void;
  onDisconnect: () => void;
}) {
  const t = useT("delivery_companies");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t("actions")}
        </h2>
        <Button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="w-full"
        >
          {loading ? t("saving") : isConnected ? t("save") : t("connect")}
        </Button>
        <a
          href={`/delivery/companies/${providerCode}`}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {t("cancel")}
        </a>
        {isConnected && (
          <Button
            type="button"
            variant="dangerOutline"
            onClick={onDisconnect}
            disabled={busy}
            className="w-full"
          >
            <Trash2 size={13} />
            {disconnecting ? t("saving") : t("disconnect")}
          </Button>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          <ShieldCheck size={14} className="shrink-0 text-primary/50" aria-hidden="true" />
          {t("security")}
        </p>
        <p className="text-xs font-medium leading-relaxed text-muted-foreground/60">
          {t("security_note")}
        </p>
      </div>
    </div>
  );
}
