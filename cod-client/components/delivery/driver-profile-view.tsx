"use client";

import Link from "next/link";
import {
  ArrowLeft, Phone, Truck, Package, Edit, TrendingUp, Star, LayoutGrid, ChevronRight, UserCheck, ShieldCheck, DollarSign, Clock, ExternalLink, Coins
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { DriverSettlementSection } from "./driver-settlement-section";
import { useDelivery, useCommon, useNavigation } from "@/lib/translations";
import { formatPrice } from "@/lib/format";
import type { Driver, Order } from "@/types";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { cn } from "@/lib/utils";

interface Props {
  driver: Driver;
  activeOrders: Order[];
  deliveredOrders: Order[];
  userScopes: string[];
}

export function DriverProfileView({ driver, activeOrders, deliveredOrders, userScopes }: Props) {
  const t = useDelivery();
  const common = useCommon();
  const nav = useNavigation();

  const fullName = `${driver.firstName} ${driver.lastName}`.trim();
  const initials = `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase();
  const allOrders = [...activeOrders, ...deliveredOrders];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter font-display">
            {fullName}
          </h1>
          <p className="text-sm text-muted-foreground/80 font-medium">{t.driver_profile?.subtitle ?? "Logistics personnel profile & performance"}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/delivery/drivers/${driver.id}/compensations`}
            className="inline-flex items-center gap-2 h-12 px-5 rounded-2xl border border-primary/20 bg-primary/5 text-primary font-black text-[11px] uppercase tracking-widest hover:bg-primary/10 hover:border-primary/30 transition-all active:scale-95"
          >
            <Coins size={16} />
            {(t.compensations as unknown as Record<string, string>)?.title ?? "Pay Grid"}
            {driver.compensationWilayaCount !== undefined && driver.compensationWilayaCount > 0 && (
              <span className="ms-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary tabular-nums text-[10px]">
                {driver.compensationWilayaCount}
              </span>
            )}
            <ChevronRight size={14} className="opacity-60 rtl:rotate-180" />
          </Link>
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
            <Link
              href={`/delivery/drivers/${driver.id}/edit`}
              className="inline-flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
            >
              <Edit size={16} />
              {t.actions?.edit ?? "Edit Profile"}
            </Link>
          </ProtectedAction>
          <Link
            href="/delivery"
            className="group inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
        </div>
      </div>

      {/* Profile Info Glass Card */}
      <div className="group relative glass-card rounded-[2.5rem] border-border/30 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-premium">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[80px] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 duration-700" />
        
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex flex-col items-center lg:items-start lg:flex-row gap-6 flex-1">
              <div className="relative group/avatar shrink-0">
                <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center text-primary-foreground font-black text-3xl shadow-xl shadow-primary/20 transition-transform group-hover/avatar:scale-105 duration-500">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-background rounded-xl flex items-center justify-center border border-border/50 shadow-md">
                  <UserCheck size={16} className="text-primary" />
                </div>
              </div>
              
              <div className="space-y-4 min-w-0 text-center lg:text-left">
                <div>
                  <h2 dir="rtl" className="text-2xl md:text-3xl font-black text-foreground tracking-tight font-display mb-2">{fullName}</h2>
                  <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                    <StatusBadge status={driver.status} className="py-1.5 px-4 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm" />
                    {driver.vehicleType && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 border border-border/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
                        <Truck size={12} className="text-primary/60" />
                        <span dir="rtl">{t.vehicle_type?.[driver.vehicleType] ?? driver.vehicleType}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground bg-muted/20 px-3 py-2 rounded-xl border border-border/10">
                    <Phone size={14} className="text-primary/60" />
                    <span dir="ltr">{driver.phone}</span>
                    {driver.phone2 && <span className="opacity-30 mx-1">/</span>}
                    {driver.phone2 && <span dir="ltr">{driver.phone2}</span>}
                  </div>
                  <Link
                    href={`/delivery/drivers/${driver.id}/compensations`}
                    className="group/pay flex items-center gap-2 text-sm font-bold text-foreground bg-primary/5 px-3 py-2 rounded-xl border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-all"
                  >
                    <ShieldCheck size={14} className="text-primary/60" />
                    <span>
                      {driver.compensationWilayaCount ?? 0} {(t.driver_profile as unknown as Record<string, string>)?.wilaya_rates ?? "wilaya rates"}
                    </span>
                    <ChevronRight size={12} className="opacity-40 group-hover/pay:opacity-80 transition-opacity rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 shrink-0 lg:w-56 w-full">
              <div className="bg-muted/20 border border-border/10 rounded-2xl p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                  <Package size={12} className="text-primary/50" />
                  Active
                </p>
                <p className="text-2xl font-black text-foreground font-display tabular-nums leading-none">{activeOrders.length}</p>
              </div>
              <div className="bg-muted/20 border border-border/10 rounded-2xl p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                  <Star size={12} className="text-amber-500/50" />
                  Delivered
                </p>
                <p className="text-2xl font-black text-foreground font-display tabular-nums leading-none">{driver.totalDelivered}</p>
              </div>
              <div className="col-span-2 lg:col-span-1 bg-primary/5 border border-primary/10 rounded-2xl p-4 transition-all hover:bg-primary/10 hover:border-primary/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-primary" />
                  Total Earnings
                </p>
                <p className="text-2xl font-black text-primary font-display tabular-nums leading-none">
                  {formatPrice(driver.totalEarnings, common.currency.symbol)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deliveredOrders.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <DriverSettlementSection
            driverId={driver.id}
            deliveredOrders={deliveredOrders}
            userScopes={userScopes}
          />
        </div>
      )}

      {activeOrders.length > 0 && (
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </div>
            <h2 className="text-lg font-black text-foreground tracking-tight font-display">
              Active Shipments
              <span className="text-muted-foreground/40 ml-2 font-mono text-sm">({activeOrders.length})</span>
            </h2>
          </div>
          
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/10 bg-muted/10">
                    <th className="px-6 md:px-8 py-4 text-start text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Order</th>
                    <th className="px-6 md:px-8 py-4 text-start text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Status</th>
                    <th className="px-6 md:px-8 py-4 text-end text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {activeOrders.map((order) => (
                    <tr key={order.id} className="group hover:bg-white/40 dark:hover:bg-primary/5 transition-all duration-300">
                      <td className="px-6 md:px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Link href={`/orders/${order.id}`} className="font-mono text-[11px] font-black text-primary hover:underline flex items-center gap-1">
                            #{order.orderNumber}
                          </Link>
                          <span className="opacity-10 hidden sm:inline">/</span>
                          <p className="text-[13px] font-bold text-foreground hidden sm:block" dir="rtl">{order.customerName}</p>
                        </div>
                      </td>
                      <td className="px-6 md:px-8 py-5">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-6 md:px-8 py-5 text-end">
                        <span className="text-sm font-black text-foreground tabular-nums tracking-tighter">
                          {formatPrice(order.price, common.currency.symbol)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {allOrders.length === 0 && (
        <div className="glass-card rounded-[2.5rem] border-border/20 py-24 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/30 rounded-[1.5rem] flex items-center justify-center mx-auto opacity-20">
            <Clock size={32} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">
            No active or delivered orders
          </p>
        </div>
      )}
    </div>
  );
}
