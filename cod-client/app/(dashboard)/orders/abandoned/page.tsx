"use client";

import { PackageX } from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";

const COPY: Record<string, { title: string; subtitle: string; badge: string }> = {
  en: {
    title: "Coming Soon",
    subtitle: "Abandoned orders tracking is on its way. Stay tuned.",
    badge: "In Development",
  },
  ar: {
    title: "قريباً",
    subtitle: "تتبع الطلبات المهجورة قادم قريباً. ترقبوا التحديث.",
    badge: "قيد التطوير",
  },
  fr: {
    title: "Bientôt disponible",
    subtitle: "Le suivi des commandes abandonnées arrive bientôt. Restez connectés.",
    badge: "En développement",
  },
};

export default function AbandonedOrdersPage() {
  const { locale } = useLanguage();
  const copy = COPY[locale] ?? COPY.en;

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 animate-fade-in">
      <div className={cn(
        "glass-card rounded-[2.5rem] p-10 sm:p-16 text-center space-y-8 w-full max-w-md",
        "border-border/20 relative overflow-hidden"
      )}>
        {/* Ambient glow */}
        <div className="absolute top-[-20%] left-[10%] w-[60%] h-[40%] bg-primary/8 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[5%] w-[40%] h-[30%] bg-rose-500/5 blur-[80px] pointer-events-none" />

        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative w-24 h-24 rounded-[1.75rem] bg-primary/10 border border-primary/10 flex items-center justify-center shadow-xl shadow-primary/5">
            <PackageX size={40} className="text-primary/50" strokeWidth={1.5} />
          </div>
        </div>

        {/* Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            {copy.badge}
          </span>
        </div>

        {/* Text */}
        <div className="space-y-3 relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground/60 font-medium leading-relaxed max-w-xs mx-auto">
            {copy.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
