"use client";

import Link from "next/link";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import { DriverCompensationsSection } from "./driver-compensations-section";
import { useDelivery } from "@/lib/translations";
import type { Driver, DriverCompensation, Wilaya } from "@/types";

interface Props {
  driver: Driver;
  compensations: DriverCompensation[];
  wilayas: Wilaya[];
  userScopes: string[];
}

export function DriverCompensationsView({ driver, compensations, wilayas, userScopes }: Props) {
  const t = useDelivery();
  const fullName = `${driver.firstName} ${driver.lastName}`.trim();
  const initials = `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-5 animate-fade-in pb-12 max-w-3xl mx-auto">
      {/* Breadcrumb / back */}
      <Link
        href={`/delivery/drivers/${driver.id}`}
        className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} className="rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform" />
        {t.actions?.back_to_driver ?? "Back to driver"}
      </Link>

      {/* Driver context card */}
      <Link
        href={`/delivery/drivers/${driver.id}`}
        className="flex items-center gap-3 glass-card rounded-2xl border-border/20 p-3 hover:bg-muted/10 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black flex items-center justify-center shrink-0 text-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p dir="rtl" className="text-sm font-black text-foreground truncate">{fullName}</p>
          <p dir="ltr" className="text-[11px] font-bold text-muted-foreground/60 truncate">{driver.phone}</p>
        </div>
        <UserCircle2 size={16} className="text-muted-foreground/30 shrink-0" />
      </Link>

      <DriverCompensationsSection
        driverId={driver.id}
        compensations={compensations}
        wilayas={wilayas}
        userScopes={userScopes}
      />
    </div>
  );
}
