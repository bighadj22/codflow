"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Search, Zap, Info, Save, X,
  DollarSign, MapPin, Layers,
} from "lucide-react";
import { CommuneOverridesDrawer } from "./commune-overrides-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createShippingProfile,
  updateShippingProfile,
  setShippingRules,
} from "@/actions/shipping-profiles";
import { useSettings, useDelivery } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import type { ShippingProfileWithRules, ShippingRule, Wilaya } from "@/types";
import { cn } from "@/lib/utils";

type RateMap = Record<number, { homePrice: number; stopDeskPrice: number; homeEnabled: boolean; stopDeskEnabled: boolean }>;

function buildRateMap(rules: ShippingRule[]): RateMap {
  const map: RateMap = {};
  for (const r of rules) {
    map[r.wilayaId] = {
      homePrice: r.homePrice,
      stopDeskPrice: r.stopDeskPrice,
      homeEnabled: r.homeEnabled ?? true,
      stopDeskEnabled: r.stopDeskEnabled ?? false,
    };
  }
  return map;
}

interface Props {
  profile?: ShippingProfileWithRules | null;
  wilayas: Wilaya[];
}

export function ShippingProfileFormPage({ profile, wilayas }: Props) {
  const router = useRouter();
  const t = useSettings();
  const d = useDelivery();
  const { dir } = useLanguage();
  const isEdit = !!profile;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(profile?.name ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [isDefault, setIsDefault] = useState(profile?.isDefault ?? false);
  const [rates, setRates] = useState<RateMap>(buildRateMap(profile?.rules ?? []));
  const [search, setSearch] = useState("");
  const [showBulkFill, setShowBulkFill] = useState(false);
  const [bulkHome, setBulkHome] = useState("");
  const [bulkDesk, setBulkDesk] = useState("");
  const [communeDrawer, setCommuneDrawer] = useState<{
    wilayaId: number;
    wilayaName: string;
    wilayaNameAr: string;
  } | null>(null);

  // Communes can only be managed for rules that already exist server-side.
  // In edit mode, these are the wilayaIds present in profile.rules.
  const savedWilayaIds = new Set<number>((profile?.rules ?? []).map((r) => r.wilayaId));

  const backHref = "/delivery/shipping-profiles";

  function getDefaultEntry() {
    return { homePrice: 0, stopDeskPrice: 0, homeEnabled: true, stopDeskEnabled: false };
  }

  function setRate(wilayaId: number, field: "homePrice" | "stopDeskPrice", raw: string) {
    const value = Math.max(0, parseFloat(raw) || 0);
    setRates((prev) => ({
      ...prev,
      [wilayaId]: { ...(prev[wilayaId] ?? getDefaultEntry()), [field]: value },
    }));
  }

  function setEnabled(wilayaId: number, field: "homeEnabled" | "stopDeskEnabled", value: boolean) {
    setRates((prev) => ({
      ...prev,
      [wilayaId]: { ...(prev[wilayaId] ?? getDefaultEntry()), [field]: value },
    }));
  }

  function handleBulkFill() {
    const homeVal = parseFloat(bulkHome) || 0;
    const deskVal = parseFloat(bulkDesk) || 0;
    if (homeVal === 0 && deskVal === 0) return;
    setRates((prev) => {
      const next = { ...prev };
      for (const w of wilayas) {
        const existing = next[w.id] ?? getDefaultEntry();
        next[w.id] = {
          homePrice: homeVal > 0 ? homeVal : existing.homePrice,
          stopDeskPrice: deskVal > 0 ? deskVal : existing.stopDeskPrice,
          homeEnabled: homeVal > 0 ? true : existing.homeEnabled,
          stopDeskEnabled: deskVal > 0 ? true : existing.stopDeskEnabled,
        };
      }
      return next;
    });
    setBulkHome("");
    setBulkDesk("");
    setShowBulkFill(false);
    toast.success(t.shipping.bulk_fill_success ?? "Rates applied to all wilayas");
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error(t.shipping.profile_name_label);
      return;
    }

    const rules = Object.entries(rates)
      .map(([id, r]) => ({
        wilayaId: Number(id),
        homePrice: r.homePrice,
        stopDeskPrice: r.stopDeskPrice,
        homeEnabled: r.homeEnabled,
        stopDeskEnabled: r.stopDeskEnabled,
      }))
      .filter((r) => r.homeEnabled || r.stopDeskEnabled);

    startTransition(async () => {
      try {
        if (!isEdit) {
          const created = await createShippingProfile({
            name: name.trim(),
            isDefault,
            notes: notes.trim() || null,
          });
          if (rules.length > 0) await setShippingRules(created.id, rules);
          toast.success(t.shipping.success_created);
          router.push(`/delivery/shipping-profiles/${created.id}`);
        } else {
          await updateShippingProfile(profile.id, {
            name: name.trim(),
            isDefault,
            notes: notes.trim() || null,
          });
          await setShippingRules(profile.id, rules);
          toast.success(t.shipping.success_saved);
          router.push(`/delivery/shipping-profiles/${profile.id}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  const filteredWilayas = wilayas.filter(
    (w) =>
      !search ||
      w.nameAr.includes(search) ||
      w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-48 md:pb-12 space-y-6 animate-fade-in">

      {/* Header: back + desktop save */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors group"
        >
          <ArrowRight
            size={13}
            className={cn(
              "transition-transform shrink-0",
              dir === "rtl" ? "group-hover:translate-x-0.5" : "rotate-180 group-hover:-translate-x-0.5"
            )}
          />
          {t.shipping.back_to_list}
        </button>

        <div className="hidden lg:block">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 active:scale-95 transition-all"
          >
            {isPending
              ? t.shipping.saving
              : <><Save size={14} className="me-2" />{isEdit ? t.shipping.form_save_edit : t.shipping.form_save_create}</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left — Profile info */}
        <div className="lg:col-span-5 space-y-5">

          {/* Info card */}
          <div className="glass-card rounded-2xl border-border/30 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/10 bg-muted/5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Info size={14} className="text-primary" />
              </div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                {t.shipping.form_info_section}
              </h2>
            </div>

            <div className="p-5 space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                  {t.shipping.profile_name_label}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.shipping.profile_name_placeholder}
                  className="h-12 bg-muted/20 border-border/30 rounded-xl px-4 text-sm font-bold focus:border-primary/30 transition-all"
                  disabled={isPending}
                  dir="rtl"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-foreground/70 uppercase tracking-wider">
                  {t.shipping.notes_label}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.shipping.notes_placeholder}
                  className="bg-muted/20 border-border/30 rounded-xl p-4 text-sm font-bold focus:border-primary/30 transition-all min-h-[90px] resize-none"
                  disabled={isPending}
                  dir="rtl"
                />
              </div>

              {/* Default toggle */}
              <div className="pt-4 border-t border-border/10">
                <label className="flex items-center justify-between gap-4 cursor-pointer group">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {t.shipping.set_as_default_label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 font-medium leading-tight line-clamp-1">
                      {t.shipping.set_as_default_hint}
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="sr-only peer"
                      disabled={isPending}
                    />
                    <div className="w-10 h-5.5 bg-muted/50 border border-border/40 rounded-full transition-all peer-checked:bg-primary peer-checked:border-primary" />
                    <div className="absolute left-1 top-1 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4.5" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Rates */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-2xl border-border/30 overflow-hidden h-full flex flex-col">

            {/* Rates header */}
            <div className="p-5 border-b border-border/10 bg-muted/5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <DollarSign size={14} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                      {t.shipping.form_rates_section}
                    </h2>
                    <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest mt-0.5">
                      {t.shipping.coverage_pricing ?? "Coverage & Pricing"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowBulkFill(!showBulkFill)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95",
                    showBulkFill
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10"
                      : "bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50"
                  )}
                >
                  <Zap size={12} className={cn(showBulkFill && "animate-pulse")} />
                  {t.shipping.bulk_fill}
                </button>
              </div>

              {/* Bulk fill */}
              {showBulkFill && (
                <div className="mt-4 p-4 rounded-xl bg-primary/[0.03] border border-primary/10 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="grid grid-cols-2 gap-2.5 flex-1 w-full">
                      <div className="relative">
                        <DollarSign size={11} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                        <Input
                          type="number"
                          value={bulkHome}
                          onChange={(e) => setBulkHome(e.target.value)}
                          placeholder={d.shipping_profiles?.home_placeholder ?? "Home"}
                          className="h-10 bg-muted/30 border-border/30 rounded-xl ps-8 text-xs font-bold"
                        />
                      </div>
                      <div className="relative">
                        <DollarSign size={11} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                        <Input
                          type="number"
                          value={bulkDesk}
                          onChange={(e) => setBulkDesk(e.target.value)}
                          placeholder={d.shipping_profiles?.desk_placeholder ?? "Desk"}
                          className="h-10 bg-muted/30 border-border/30 rounded-xl ps-8 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleBulkFill}
                      disabled={!bulkHome && !bulkDesk}
                      size="sm"
                      className="w-full sm:w-auto h-10 px-5 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      {t.shipping.bulk_fill_apply ?? "Apply"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mt-4 relative">
                <Search size={14} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.shipping.search_wilaya}
                  className="w-full h-11 ps-11 pe-4 bg-muted/20 border border-border/30 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/30 font-bold outline-none focus:border-primary/30 transition-all"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-5 py-3 bg-muted/5 border-b border-border/10">
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{t.shipping.wilaya}</span>
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest text-center">{d.shipping_profiles?.home_placeholder ?? "Home"}</span>
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest text-center">{d.shipping_profiles?.desk_placeholder ?? "Desk"}</span>
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest w-9 text-center" />
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto min-h-[350px] max-h-[550px] divide-y divide-border/5 no-scrollbar">
              {filteredWilayas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <MapPin size={28} className="mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{d.shipping_profiles?.no_matching_wilayas ?? "No matching wilayas"}</p>
                </div>
              ) : (
                filteredWilayas.map((w) => {
                  const rate = rates[w.id];
                  const homeVal = rate?.homePrice ?? 0;
                  const deskVal = rate?.stopDeskPrice ?? 0;
                  const homeEnabled = rate?.homeEnabled ?? false;
                  const deskEnabled = rate?.stopDeskEnabled ?? false;
                  const hasAnyRate = homeEnabled || deskEnabled;

                  const savedRule = savedWilayaIds.has(w.id);
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-5 py-3 items-center transition-all group/row",
                        hasAnyRate ? "hover:bg-muted/10" : "opacity-40 hover:opacity-100"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[13px] text-foreground tracking-tight group-hover/row:text-primary transition-colors truncate" dir="rtl">{w.nameAr}</p>
                        <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-tight mt-0.5 truncate">{w.name}</p>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEnabled(w.id, "homeEnabled", !homeEnabled)}
                          className={cn(
                            "w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                            homeEnabled
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted/20 border-border/20 text-muted-foreground/40"
                          )}
                        >
                          {homeEnabled ? (t.shipping.toggle_on ?? "ON") : (t.shipping.toggle_off ?? "OFF")}
                        </button>
                        <input
                          type="number"
                          value={homeVal === 0 ? "" : homeVal}
                          onChange={(e) => {
                            setRate(w.id, "homePrice", e.target.value);
                            if (parseFloat(e.target.value) > 0) setEnabled(w.id, "homeEnabled", true);
                          }}
                          placeholder="0"
                          disabled={!homeEnabled}
                          className="w-full h-8 bg-muted/30 border border-border/30 rounded-lg text-xs font-black text-foreground text-center outline-none focus:border-primary/30 transition-all tabular-nums disabled:opacity-30"
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEnabled(w.id, "stopDeskEnabled", !deskEnabled)}
                          className={cn(
                            "w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                            deskEnabled
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted/20 border-border/20 text-muted-foreground/40"
                          )}
                        >
                          {deskEnabled ? (t.shipping.toggle_on ?? "ON") : (t.shipping.toggle_off ?? "OFF")}
                        </button>
                        <input
                          type="number"
                          value={deskVal === 0 ? "" : deskVal}
                          onChange={(e) => {
                            setRate(w.id, "stopDeskPrice", e.target.value);
                            if (parseFloat(e.target.value) > 0) setEnabled(w.id, "stopDeskEnabled", true);
                          }}
                          placeholder="0"
                          disabled={!deskEnabled}
                          className="w-full h-8 bg-muted/30 border border-border/30 rounded-lg text-xs font-black text-foreground text-center outline-none focus:border-primary/30 transition-all tabular-nums disabled:opacity-30"
                        />
                      </div>

                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() =>
                            setCommuneDrawer({ wilayaId: w.id, wilayaName: w.name, wilayaNameAr: w.nameAr })
                          }
                          disabled={!isEdit || !savedRule || !hasAnyRate}
                          title={
                            !isEdit || !savedRule
                              ? (d.shipping_profiles?.communes_save_first ?? "Save rate first")
                              : (d.shipping_profiles?.manage_communes ?? "Manage communes")
                          }
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-all active:scale-95",
                            (isEdit && savedRule && hasAnyRate)
                              ? "bg-muted/30 border-border/30 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                              : "bg-muted/10 border-border/10 text-muted-foreground/20 cursor-not-allowed"
                          )}
                        >
                          <Layers size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer note */}
            <div className="px-5 py-4 border-t border-border/10 bg-muted/5 flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Info size={11} className="text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tight">
                {t.shipping.table_note}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Commune override drawer */}
      {communeDrawer && profile && (() => {
        const r = rates[communeDrawer.wilayaId];
        const savedRule = profile.rules.find((x) => x.wilayaId === communeDrawer.wilayaId);
        const defaults = {
          homePrice: r?.homePrice ?? savedRule?.homePrice ?? 0,
          stopDeskPrice: r?.stopDeskPrice ?? savedRule?.stopDeskPrice ?? 0,
          homeEnabled: r?.homeEnabled ?? savedRule?.homeEnabled ?? true,
          stopDeskEnabled: r?.stopDeskEnabled ?? savedRule?.stopDeskEnabled ?? false,
        };
        return (
          <CommuneOverridesDrawer
            open={!!communeDrawer}
            onOpenChange={(o) => !o && setCommuneDrawer(null)}
            profileId={profile.id}
            wilayaId={communeDrawer.wilayaId}
            wilayaName={communeDrawer.wilayaName}
            wilayaNameAr={communeDrawer.wilayaNameAr}
            wilayaDefaults={defaults}
          />
        );
      })()}

      {/* Mobile floating save bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 shadow-2xl flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => router.push(backHref)}
            disabled={isPending}
            className="flex-none w-12 h-12 rounded-2xl border-border/40 bg-background text-muted-foreground transition-all active:scale-90"
          >
            <X size={18} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
          >
            {isPending
              ? t.shipping.saving
              : <><Save size={15} className="me-2" />{isEdit ? t.shipping.form_save_edit : t.shipping.form_save_create}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
