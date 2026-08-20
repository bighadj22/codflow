"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Check, RotateCcw, Package, Truck, Phone, Wallet, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Driver, Order } from "@/types";
import { AssignOrdersDialog } from "./assign-orders-dialog";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useDelivery, useCommon } from "@/lib/translations";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { updateOrderStatus } from "@/actions/orders";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  driver: Driver;
  driverOrders: Order[];
  readyOrders: Order[];
  userScopes: string[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; glow: string }> = {
  available: {
    bg: "var(--status-delivered-bg)",
    text: "var(--status-delivered-text)",
    border: "var(--status-delivered-border)",
    dot: "var(--status-dot-delivered)",
    glow: "bg-emerald-500/5",
  },
  busy: {
    bg: "var(--status-out-bg)",
    text: "var(--status-out-text)",
    border: "var(--status-out-border)",
    dot: "var(--status-dot-out)",
    glow: "bg-amber-500/5",
  },
  inactive: {
    bg: "var(--status-cancelled-bg, var(--status-out-bg))",
    text: "var(--status-cancelled-text, var(--status-out-text))",
    border: "var(--status-cancelled-border, var(--status-out-border))",
    dot: "var(--status-dot-out)",
    glow: "bg-slate-500/5",
  },
};

export function DriverCard({ driver, driverOrders, readyOrders, userScopes }: Props) {
  const t = useDelivery();
  const common = useCommon();
  const locale = useErrorLocale();
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());

  const fullName = `${driver.firstName} ${driver.lastName}`.trim();
  const initials = `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase();
  const statusStyle = STATUS_STYLES[driver.status] ?? STATUS_STYLES.inactive;

  const statusLabel =
    driver.status === "available"
      ? t.driver_card.status_available
      : driver.status === "busy"
      ? t.driver_card.status_busy
      : t.driver_card.status_inactive;

  async function handleOrderStatusUpdate(orderId: string, status: "delivered" | "returned") {
    if (updatingOrders.has(orderId)) return;
    setUpdatingOrders((prev) => new Set(prev).add(orderId));

    try {
      const res = await updateOrderStatus(orderId, status);
      if (!res.ok) {
        showErrorToast(res.error || "Failed to update order status", locale);
        return;
      }
      const order = driverOrders.find((o) => o.id === orderId);
      showSuccessToast(
        status === "delivered"
          ? `${t.driver_card.order_delivered} ${order?.orderNumber}`
          : `${t.driver_card.order_returned} ${order?.orderNumber}`,
        locale
      );
      window.location.reload();
    } finally {
      setUpdatingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  return (
    <div className="group relative glass-card rounded-[2rem] border-border/30 overflow-hidden transition-all duration-500 hover:shadow-premium hover:-translate-y-1">
      {/* Background Status Glow */}
      <div className={cn("absolute top-[-10%] right-[-10%] w-[50%] h-[40%] blur-[80px] pointer-events-none transition-all duration-700", statusStyle.glow)} />
      
      <div className="relative z-10 p-6">
        {/* Header - Driver Info */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group/avatar">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-black text-lg shrink-0 shadow-lg shadow-primary/20 transition-transform group-hover/avatar:scale-105 duration-500">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-lg flex items-center justify-center border border-border/50 shadow-sm">
                <UserCheck size={10} className="text-primary" />
              </div>
            </div>
            <div className="min-w-0">
              <h3 dir="rtl" className="font-black text-lg text-foreground tracking-tight truncate leading-tight font-display">
                {fullName}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 text-muted-foreground/60 font-black text-[10px] uppercase tracking-widest">
                <Phone size={10} className="text-primary/50" />
                <span dir="ltr">{driver.phone}</span>
              </div>
            </div>
          </div>
          
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm"
            style={{
              background: statusStyle.bg,
              color: statusStyle.text,
              borderColor: statusStyle.border,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ background: statusStyle.dot }}
            />
            {statusLabel}
          </div>
        </div>

        {/* Vehicle & Compensation Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {driver.compensationWilayaCount !== undefined && driver.compensationWilayaCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border border-border/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
              <Package size={12} className="text-primary/60" />
              <span>{driver.compensationWilayaCount} {((t as unknown as Record<string, Record<string, string>>).drivers_page)?.wilayas ?? "wilayas"}</span>
            </div>
          )}
          {driver.vehicleType && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border border-border/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
              <Truck size={12} className="text-primary/60" />
              <span dir="rtl">{t.vehicle_type[driver.vehicleType]}</span>
            </div>
          )}
        </div>

        {/* Key Metrics - Bento Style */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="group/metric relative overflow-hidden bg-primary/[0.03] border border-primary/10 rounded-2xl p-4 transition-all hover:bg-primary/[0.06] hover:border-primary/20">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/metric:opacity-20 transition-opacity">
              <TrendingUp size={24} className="text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground/70 font-black uppercase tracking-[0.15em] mb-1">{t.driver_card.earnings}</p>
            <p className="text-xl font-black text-primary tracking-tighter font-display tabular-nums">
              {formatPrice(driver.totalEarnings, common.currency.symbol)}
            </p>
          </div>
          
          <div className={cn(
            "group/metric relative overflow-hidden border rounded-2xl p-4 transition-all",
            driver.pendingCash > 0 
              ? "bg-amber-500/[0.03] border-amber-500/20 hover:bg-amber-500/[0.06] hover:border-amber-500/30" 
              : "bg-muted/30 border-border/30 hover:bg-muted/50"
          )}>
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/metric:opacity-20 transition-opacity">
              <Wallet size={24} className={driver.pendingCash > 0 ? "text-amber-500" : "text-muted-foreground"} />
            </div>
            <p className="text-[10px] text-muted-foreground/70 font-black uppercase tracking-[0.15em] mb-1">{t.driver_card.pending_cash}</p>
            <p className={cn(
              "text-xl font-black tracking-tighter font-display tabular-nums",
              driver.pendingCash > 0 ? "text-amber-500" : "text-foreground"
            )}>
              {formatPrice(driver.pendingCash, common.currency.symbol)}
            </p>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-muted/20 border border-border/10">
            <span className="text-2xl font-black text-foreground font-display">{driverOrders.length}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-center mt-1">{t.driver_card.active_orders}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-muted/20 border border-border/10">
            <span className="text-2xl font-black text-foreground font-display">{driver.totalDelivered}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-center mt-1">{t.driver_card.total_delivered}</span>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex gap-3">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest border-border/40 bg-white/50 dark:bg-muted/20 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all duration-300 active:scale-95"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>{t.driver_card.hide_orders} <ChevronUp size={14} className="ms-2" /></>
            ) : (
              <>{t.driver_card.view_orders} <ChevronDown size={14} className="ms-2" /></>
            )}
          </Button>
          
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_ASSIGN}>
            <Button
              size="lg"
              className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 active:scale-95"
              onClick={() => setAssignOpen(true)}
            >
              {t.driver_card.assign_orders}
            </Button>
          </ProtectedAction>
        </div>
      </div>

      {/* Expanded Order List - Glass Style */}
      {expanded && (
        <div className="relative z-10 border-t border-border/20 bg-muted/10 animate-fade-in-up">
          {driverOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
              <Package size={32} className="mb-2" />
              <p className="text-[11px] font-black uppercase tracking-widest">{t.driver_card.no_active_orders}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {driverOrders.map((order) => (
                <div key={order.id} className="group/item px-6 py-4 flex items-center justify-between gap-4 hover:bg-primary/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-foreground group-hover/item:text-primary transition-colors tabular-nums">{order.orderNumber}</p>
                    <p dir="rtl" className="text-[11px] text-muted-foreground/70 truncate font-bold mt-0.5">
                      {order.customerName} <span className="mx-1 opacity-30">·</span> {order.wilaya}
                    </p>
                  </div>
                  
                  <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_UPDATE}>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        onClick={() => handleOrderStatusUpdate(order.id, "delivered")}
                        disabled={updatingOrders.has(order.id)}
                      >
                        <Check size={12} className="me-1.5" /> {t.driver_card.delivered}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 bg-rose-500/5 text-rose-600 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                        onClick={() => handleOrderStatusUpdate(order.id, "returned")}
                        disabled={updatingOrders.has(order.id)}
                      >
                        <RotateCcw size={12} className="me-1.5" /> {t.driver_card.returned}
                      </Button>
                    </div>
                  </ProtectedAction>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AssignOrdersDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        driver={driver}
        readyOrders={readyOrders}
      />
    </div>
  );
}
