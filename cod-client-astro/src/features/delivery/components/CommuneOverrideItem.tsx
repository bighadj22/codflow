import { Home, RotateCcw, Store } from "lucide-react";
import { useT } from "@/i18n/react";
import type { CommuneOverride } from "@/features/delivery/types";

export type CommuneDraft = {
  homePrice: string;
  stopDeskPrice: string;
  homeEnabled: boolean | null;
  stopDeskEnabled: boolean | null;
};

export function CommuneOverrideItem({
  commune,
  draft,
  wilayaDefaults,
  saving,
  onUpdateDraft,
  onSave,
  onReset,
}: {
  commune: CommuneOverride;
  draft: CommuneDraft;
  wilayaDefaults: {
    homePrice: number;
    stopDeskPrice: number;
    homeEnabled: boolean;
    stopDeskEnabled: boolean;
  };
  saving: boolean;
  onUpdateDraft: (patch: Partial<CommuneDraft>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useT("delivery");
  const settings = useT("settings");
  const sp = (key: string) => t(`shipping_profiles.${key}`);

  const homeToggle = draft.homeEnabled ?? wilayaDefaults.homeEnabled;
  const deskToggle = draft.stopDeskEnabled ?? wilayaDefaults.stopDeskEnabled;
  const isHomeOverridden = draft.homeEnabled != null;
  const isDeskOverridden = draft.stopDeskEnabled != null;

  return (
    <article
      key={commune.communeId}
      className={`py-4 ${commune.hasOverride ? "bg-primary/[0.03]" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {commune.communeNameAr}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {commune.communeName}
            {commune.postalCode && (
              <span className="ms-2 tabular-nums">
                {commune.postalCode}
              </span>
            )}
          </p>
        </div>
        {commune.hasOverride ? (
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <RotateCcw size={11} />
            {sp("commune_reset_override")}
          </button>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            {sp("commune_inherits")}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() =>
              onUpdateDraft({
                homeEnabled:
                  isHomeOverridden &&
                  draft.homeEnabled === !wilayaDefaults.homeEnabled
                    ? null
                    : !homeToggle,
              })
            }
            disabled={saving}
            className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-50 ${
              homeToggle
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted/20 text-muted-foreground"
            } ${isHomeOverridden ? "ring-1 ring-primary/30" : ""}`}
          >
            <Home size={11} />
            {homeToggle
              ? settings("shipping.toggle_on")
              : settings("shipping.toggle_off")}
            {!isHomeOverridden && (
              <span className="opacity-60">
                ·{sp("commune_inherits")}
              </span>
            )}
          </button>
          <input
            type="number"
            min={0}
            value={draft.homePrice}
            onChange={(event) =>
              onUpdateDraft({
                homePrice: event.currentTarget.value,
              })
            }
            disabled={saving}
            placeholder={`${sp("commune_inherit_placeholder")} (${wilayaDefaults.homePrice})`}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-center text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          />
        </div>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() =>
              onUpdateDraft({
                stopDeskEnabled:
                  isDeskOverridden &&
                  draft.stopDeskEnabled ===
                    !wilayaDefaults.stopDeskEnabled
                    ? null
                    : !deskToggle,
              })
            }
            disabled={saving}
            className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-50 ${
              deskToggle
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted/20 text-muted-foreground"
            } ${isDeskOverridden ? "ring-1 ring-primary/30" : ""}`}
          >
            <Store size={11} />
            {deskToggle
              ? settings("shipping.toggle_on")
              : settings("shipping.toggle_off")}
            {!isDeskOverridden && (
              <span className="opacity-60">
                ·{sp("commune_inherits")}
              </span>
            )}
          </button>
          <input
            type="number"
            min={0}
            value={draft.stopDeskPrice}
            onChange={(event) =>
              onUpdateDraft({
                stopDeskPrice: event.currentTarget.value,
              })
            }
            disabled={saving}
            placeholder={`${sp("commune_inherit_placeholder")} (${wilayaDefaults.stopDeskPrice})`}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-center text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? sp("commune_saving") : sp("commune_save")}
        </button>
      </div>
    </article>
  );
}
