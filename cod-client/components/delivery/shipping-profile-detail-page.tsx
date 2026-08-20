"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, MapPin, Package, Package2, Star, Edit,
  DollarSign, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useSettings } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import type { ShippingProfileWithRules } from "@/types";

interface Props {
  profile: ShippingProfileWithRules;
  productCount: number;
}

export function ShippingProfileDetailPage({ profile, productCount }: Props) {
  const t = useSettings();
  const router = useRouter();
  const { dir } = useLanguage();

  const sortedRules = [...profile.rules].sort((a, b) => a.wilayaId - b.wilayaId);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Back */}
      <button
        onClick={() => router.push("/delivery/shipping-profiles")}
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

      {/* Hero */}
      <div className={cn(
        "glass-card rounded-2xl border-border/30 overflow-hidden",
        profile.isDefault && "border-primary/10"
      )}>
        {profile.isDefault && (
          <div className="h-[3px] bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
        )}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Icon */}
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md",
            profile.isDefault
              ? "bg-primary text-primary-foreground shadow-primary/20"
              : "bg-muted text-muted-foreground/30"
          )}>
            <Package size={28} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{profile.name}</h1>
              {profile.isDefault && (
                <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-primary/20 uppercase tracking-widest">
                  <Star size={8} fill="currentColor" />{t.shipping.default_badge}
                </span>
              )}
            </div>

            {profile.notes && (
              <p className="text-[13px] text-muted-foreground/60 font-medium mt-1 leading-relaxed">{profile.notes}</p>
            )}

            {/* Inline stats */}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/50">
                <MapPin size={10} className="text-primary/50" />
                <span className="text-foreground font-black tabular-nums">{profile.rules.length}</span>
                {t.shipping.card_wilayas}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/50">
                <Package2 size={10} className="text-primary/50" />
                <span className="text-foreground font-black tabular-nums">{productCount}</span>
                {(t.shipping as unknown as Record<string, string>).card_products ?? "Products"}
              </span>
            </div>
          </div>

          {/* Edit CTA */}
          <Link
            href={`/delivery/shipping-profiles/${profile.id}/edit`}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-11 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] shrink-0 w-full sm:w-auto border-border/30 active:scale-95 transition-all"
            )}
          >
            <Edit size={14} className="me-2" />
            {t.shipping.edit_action}
          </Link>
        </div>
      </div>

      {/* Pricing Matrix */}
      <div className="glass-card rounded-2xl border-border/30 overflow-hidden animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="px-5 py-4 border-b border-border/10 flex items-center gap-3 bg-muted/5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign size={13} className="text-primary" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            {t.shipping.pricing_matrix ?? "Pricing Matrix"}
          </h2>
          <span className="text-[10px] font-mono text-muted-foreground/30">({sortedRules.length})</span>
        </div>

        {sortedRules.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Info className="w-8 h-8 text-muted-foreground/15" />
            <p className="text-sm font-bold text-muted-foreground/40">{t.shipping.no_rates_configured}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[1fr_140px_140px] gap-4 px-5 py-3 border-b border-border/10 bg-muted/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t.shipping.wilaya}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">{t.shipping.home_delivery}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">{t.shipping.stop_desk}</p>
              </div>

              <div className="divide-y divide-border/10">
                {sortedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_140px_140px] items-center gap-3 md:gap-4 px-5 py-3.5 hover:bg-muted/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground leading-tight" dir="rtl">{rule.wilayaNameAr}</p>
                      <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/40 mt-0.5 truncate">{rule.wilayaName}</p>
                    </div>
                    <div className="text-center">
                      {rule.homeEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10 text-[12px] font-black text-primary tabular-nums">
                          {rule.homePrice} <span className="text-[8px] opacity-50 uppercase">DA</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/20 font-mono text-sm">—</span>
                      )}
                    </div>
                    <div className="text-center">
                      {rule.stopDeskEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/10 text-[12px] font-black text-foreground tabular-nums">
                          {rule.stopDeskPrice} <span className="text-[8px] opacity-40 uppercase">DA</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/20 font-mono text-sm">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
