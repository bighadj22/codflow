"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, RotateCcw, Home, Store, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getShippingRuleCommunes,
  setCommuneOverride,
  deleteCommuneOverride,
} from "@/actions/shipping-profiles";
import { useDelivery } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import type { CommuneOverride } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  wilayaId: number | null;
  wilayaName: string;
  wilayaNameAr: string;
  wilayaDefaults: {
    homePrice: number;
    stopDeskPrice: number;
    homeEnabled: boolean;
    stopDeskEnabled: boolean;
  };
}

type Draft = {
  homePrice: string;
  stopDeskPrice: string;
  homeEnabled: boolean | null;
  stopDeskEnabled: boolean | null;
};

function toDraft(o: CommuneOverride): Draft {
  return {
    homePrice: o.homePrice == null ? "" : String(o.homePrice),
    stopDeskPrice: o.stopDeskPrice == null ? "" : String(o.stopDeskPrice),
    homeEnabled: o.homeEnabled,
    stopDeskEnabled: o.stopDeskEnabled,
  };
}

export function CommuneOverridesDrawer({
  open,
  onOpenChange,
  profileId,
  wilayaId,
  wilayaName,
  wilayaNameAr,
  wilayaDefaults,
}: Props) {
  const d = useDelivery();
  const { dir, locale } = useLanguage();
  const isRtl = dir === "rtl";
  const sp = d.shipping_profiles as any;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CommuneOverride[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !profileId || wilayaId == null) return;
    setLoading(true);
    getShippingRuleCommunes(profileId, wilayaId)
      .then((data) => {
        setItems(data);
        const map: Record<string, Draft> = {};
        for (const c of data) map[c.communeId] = toDraft(c);
        setDrafts(map);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Error");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, profileId, wilayaId, onOpenChange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.communeName.toLowerCase().includes(q) ||
        c.communeNameAr.includes(search) ||
        (c.postalCode ?? "").includes(q),
    );
  }, [items, search]);

  const overriddenCount = useMemo(
    () => items.filter((c) => c.hasOverride).length,
    [items],
  );

  function updateDraft(communeId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [communeId]: { ...(prev[communeId] ?? { homePrice: "", stopDeskPrice: "", homeEnabled: null, stopDeskEnabled: null }), ...patch },
    }));
  }

  function resetItem(c: CommuneOverride): CommuneOverride {
    return {
      ...c,
      homeEnabled: null,
      stopDeskEnabled: null,
      homePrice: null,
      stopDeskPrice: null,
      effectiveHomeEnabled: wilayaDefaults.homeEnabled,
      effectiveStopDeskEnabled: wilayaDefaults.stopDeskEnabled,
      effectiveHomePrice: wilayaDefaults.homePrice,
      effectiveStopDeskPrice: wilayaDefaults.stopDeskPrice,
      hasOverride: false,
    };
  }

  async function handleSave(communeId: string) {
    if (!profileId || wilayaId == null) return;
    const draft = drafts[communeId];
    if (!draft) return;

    const homePriceNum = draft.homePrice.trim() === "" ? null : Math.max(0, parseFloat(draft.homePrice) || 0);
    const stopDeskPriceNum = draft.stopDeskPrice.trim() === "" ? null : Math.max(0, parseFloat(draft.stopDeskPrice) || 0);

    setSavingId(communeId);
    startTransition(async () => {
      try {
        await setCommuneOverride(profileId, wilayaId, communeId, {
          homeEnabled: draft.homeEnabled,
          stopDeskEnabled: draft.stopDeskEnabled,
          homePrice: homePriceNum,
          stopDeskPrice: stopDeskPriceNum,
        });

        const allNull =
          homePriceNum == null &&
          stopDeskPriceNum == null &&
          draft.homeEnabled == null &&
          draft.stopDeskEnabled == null;

        setItems((prev) =>
          prev.map((c) => {
            if (c.communeId !== communeId) return c;
            if (allNull) return resetItem(c);
            return {
              ...c,
              homeEnabled: draft.homeEnabled,
              stopDeskEnabled: draft.stopDeskEnabled,
              homePrice: homePriceNum,
              stopDeskPrice: stopDeskPriceNum,
              effectiveHomeEnabled: draft.homeEnabled ?? wilayaDefaults.homeEnabled,
              effectiveStopDeskEnabled: draft.stopDeskEnabled ?? wilayaDefaults.stopDeskEnabled,
              effectiveHomePrice: homePriceNum ?? wilayaDefaults.homePrice,
              effectiveStopDeskPrice: stopDeskPriceNum ?? wilayaDefaults.stopDeskPrice,
              hasOverride: !allNull,
            };
          }),
        );

        toast.success(allNull ? sp?.commune_override_removed : sp?.commune_override_saved);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      } finally {
        setSavingId(null);
      }
    });
  }

  async function handleReset(communeId: string) {
    if (!profileId || wilayaId == null) return;
    setSavingId(communeId);
    startTransition(async () => {
      try {
        await deleteCommuneOverride(profileId, wilayaId, communeId);
        setItems((prev) => prev.map((c) => (c.communeId === communeId ? resetItem(c) : c)));
        setDrafts((prev) => ({
          ...prev,
          [communeId]: { homePrice: "", stopDeskPrice: "", homeEnabled: null, stopDeskEnabled: null },
        }));
        toast.success(sp?.commune_override_removed);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      } finally {
        setSavingId(null);
      }
    });
  }

  const displayName = locale === "ar" ? wilayaNameAr : wilayaName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className="w-full sm:max-w-xl flex flex-col p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border/10 bg-muted/5">
          <SheetTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
            {sp?.communes_drawer_title ?? "Commune overrides"}
          </SheetTitle>
          <div className="flex items-center justify-between gap-3 mt-1">
            <p className="text-base font-bold text-foreground truncate" dir={isRtl ? "rtl" : "ltr"}>
              {displayName}
            </p>
            {overriddenCount > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                {(sp?.commune_overrides_count ?? "{{count}} overridden").replace("{{count}}", String(overriddenCount))}
              </span>
            )}
          </div>
          <SheetDescription className="text-[11px] text-muted-foreground/60 font-medium mt-1 leading-relaxed">
            {sp?.communes_drawer_subtitle ?? "Override wilaya defaults per commune. Leave a field blank to inherit."}
          </SheetDescription>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
              <Home size={11} className="text-muted-foreground/50" />
              <span className="text-muted-foreground/60 uppercase tracking-widest">{sp?.home_placeholder ?? "Home"}</span>
              <span className="ms-auto tabular-nums text-foreground">
                {wilayaDefaults.homeEnabled ? `${wilayaDefaults.homePrice}` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
              <Store size={11} className="text-muted-foreground/50" />
              <span className="text-muted-foreground/60 uppercase tracking-widest">{sp?.desk_placeholder ?? "Desk"}</span>
              <span className="ms-auto tabular-nums text-foreground">
                {wilayaDefaults.stopDeskEnabled ? `${wilayaDefaults.stopDeskPrice}` : "—"}
              </span>
            </div>
          </div>

          <div className="mt-3 relative">
            <Search size={13} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={sp?.commune_search_placeholder ?? "Search commune…"}
              className="h-10 ps-10 bg-muted/20 border-border/30 rounded-xl text-sm font-bold"
              dir={isRtl ? "rtl" : "ltr"}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">
              {sp?.communes_loading ?? "Loading communes…"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <Info size={24} className="mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                {sp?.communes_empty ?? "No communes"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/5">
              {filtered.map((c) => {
                const draft = drafts[c.communeId] ?? {
                  homePrice: "",
                  stopDeskPrice: "",
                  homeEnabled: null,
                  stopDeskEnabled: null,
                };
                const saving = savingId === c.communeId && isPending;

                const homeToggle = draft.homeEnabled ?? wilayaDefaults.homeEnabled;
                const deskToggle = draft.stopDeskEnabled ?? wilayaDefaults.stopDeskEnabled;

                const isHomeOverriddenToggle = draft.homeEnabled != null;
                const isDeskOverriddenToggle = draft.stopDeskEnabled != null;

                return (
                  <div key={c.communeId} className={cn("px-5 py-4 space-y-3", c.hasOverride && "bg-primary/[0.02]")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[13px] text-foreground truncate" dir="rtl">
                          {c.communeNameAr}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tight mt-0.5 truncate">
                          {c.communeName}
                          {c.postalCode && <span className="ms-2 tabular-nums">{c.postalCode}</span>}
                        </p>
                      </div>
                      {c.hasOverride ? (
                        <button
                          type="button"
                          onClick={() => handleReset(c.communeId)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-muted/30 text-muted-foreground border border-border/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all active:scale-95 disabled:opacity-50"
                          title={sp?.commune_reset_override ?? "Reset"}
                        >
                          <RotateCcw size={10} />
                          {sp?.commune_reset_override ?? "Reset"}
                        </button>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 px-2.5 py-1.5">
                          {sp?.commune_inherits ?? "Inherits"}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Home */}
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(c.communeId, {
                              homeEnabled: isHomeOverriddenToggle && draft.homeEnabled === !wilayaDefaults.homeEnabled
                                ? null
                                : !homeToggle,
                            })
                          }
                          className={cn(
                            "w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5",
                            homeToggle
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted/20 border-border/20 text-muted-foreground/40",
                            isHomeOverriddenToggle && "ring-1 ring-primary/30",
                          )}
                        >
                          <Home size={10} />
                          {homeToggle ? "ON" : "OFF"}
                          {!isHomeOverriddenToggle && <span className="opacity-50">·{sp?.commune_inherits ?? "Inherits"}</span>}
                        </button>
                        <Input
                          type="number"
                          value={draft.homePrice}
                          onChange={(e) => updateDraft(c.communeId, { homePrice: e.target.value })}
                          placeholder={`${sp?.commune_inherit_placeholder ?? "Inherit"} (${wilayaDefaults.homePrice})`}
                          className="h-8 bg-muted/30 border-border/30 rounded-lg text-xs font-black text-center tabular-nums"
                        />
                      </div>

                      {/* Desk */}
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(c.communeId, {
                              stopDeskEnabled: isDeskOverriddenToggle && draft.stopDeskEnabled === !wilayaDefaults.stopDeskEnabled
                                ? null
                                : !deskToggle,
                            })
                          }
                          className={cn(
                            "w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5",
                            deskToggle
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted/20 border-border/20 text-muted-foreground/40",
                            isDeskOverriddenToggle && "ring-1 ring-primary/30",
                          )}
                        >
                          <Store size={10} />
                          {deskToggle ? "ON" : "OFF"}
                          {!isDeskOverriddenToggle && <span className="opacity-50">·{sp?.commune_inherits ?? "Inherits"}</span>}
                        </button>
                        <Input
                          type="number"
                          value={draft.stopDeskPrice}
                          onChange={(e) => updateDraft(c.communeId, { stopDeskPrice: e.target.value })}
                          placeholder={`${sp?.commune_inherit_placeholder ?? "Inherit"} (${wilayaDefaults.stopDeskPrice})`}
                          className="h-8 bg-muted/30 border-border/30 rounded-lg text-xs font-black text-center tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(c.communeId)}
                        disabled={saving}
                        className="h-8 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95"
                      >
                        {saving ? (sp?.commune_saving ?? "Saving…") : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
