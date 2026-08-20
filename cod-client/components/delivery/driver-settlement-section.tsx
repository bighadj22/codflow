"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote, CheckCircle2, ArrowLeftRight, History, User,
  ChevronDown, ChevronUp, Clock, Check, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { createDriverPayment, getDriverPayments } from "@/actions/driver-payments";
import { formatPrice, formatDate } from "@/lib/format";
import { useDelivery, useCommon } from "@/lib/translations";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import type { Order, DriverPayment, DriverPaymentType } from "@/types";

interface Props {
  driverId: string;
  deliveredOrders: Order[];
  userScopes: string[];
}

const TYPE_COLOR: Record<DriverPaymentType, string> = {
  cod_remittance: "text-amber-500",
  fee_payment: "text-green-500",
  net_settlement: "text-primary",
};

export function DriverSettlementSection({ driverId, deliveredOrders, userScopes }: Props) {
  const router = useRouter();
  const t = useDelivery();
  const common = useCommon();
  const locale = useErrorLocale();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<DriverPayment[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Only orders with at least one unsettled dimension can be selected
  const settleableOrders = deliveredOrders.filter((o) => !o.codPaymentId || !o.feePaymentId);

  const selected = deliveredOrders.filter((o) => selectedIds.has(o.id));
  const selectedCod = selected.filter((o) => !o.codPaymentId).reduce((s, o) => s + (o.codAmount ?? 0), 0);
  const selectedFee = selected.filter((o) => !o.feePaymentId).reduce((s, o) => s + (o.driverFee ?? 0), 0);
  const selectedNet = selectedCod - selectedFee;

  // Footer totals (all unsettled)
  const totalPendingCod = settleableOrders.filter((o) => !o.codPaymentId).reduce((s, o) => s + (o.codAmount ?? 0), 0);
  const totalPendingFee = settleableOrders.filter((o) => !o.feePaymentId).reduce((s, o) => s + (o.driverFee ?? 0), 0);

  function toggle(id: string) {
    const order = deliveredOrders.find((o) => o.id === id);
    if (!order || (order.codPaymentId && order.feePaymentId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(settleableOrders.map((o) => o.id))); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function loadHistory() {
    if (historyLoading || history !== null) return;
    setHistoryLoading(true);
    try { setHistory(await getDriverPayments(driverId)); }
    catch { showErrorToast(t.payments?.error_load_history ?? "Failed to load history", locale); }
    finally { setHistoryLoading(false); }
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  }

  function settle(type: DriverPaymentType) {
    if (!selectedIds.size) return;
    startTransition(async () => {
      try {
        await createDriverPayment({ driverId, type, orderIds: [...selectedIds] });
        const successKey = `success_${type === "cod_remittance" ? "cod" : type === "fee_payment" ? "fee" : "net"}` as const;
        showSuccessToast(t.payments?.[successKey] ?? type, locale);
        setSelectedIds(new Set());
        setHistory(null);
        router.refresh();
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : t.payments?.error_settle ?? "Error", locale);
      }
    });
  }

  const allSettled = settleableOrders.length === 0;
  const isAllSelected = settleableOrders.length > 0 && selectedIds.size === settleableOrders.length;
  const isPartialSelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between ps-1">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
          {t.table?.recent_deliveries ?? "Delivered"} · {deliveredOrders.length}
        </h2>
        <button
          onClick={toggleHistory}
          className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <History size={11} />
          {t.payments?.tab_history ?? "History"}
          {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* ── Main table ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {/* Master checkbox */}
              <th className="w-10 px-3 py-3 text-center">
                <button
                  onClick={isAllSelected ? clearSelection : selectAll}
                  disabled={allSettled}
                  className="flex items-center justify-center mx-auto"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isAllSelected
                      ? "bg-primary border-primary"
                      : isPartialSelected
                      ? "border-primary"
                      : "border-border"
                  }`}>
                    {isAllSelected && <Check size={9} className="text-primary-foreground" />}
                    {isPartialSelected && <Minus size={8} className="text-primary" />}
                  </span>
                </button>
              </th>
              <th className="px-3 py-3 text-start text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                {t.table?.order ?? "Order"}
              </th>
              <th className="px-3 py-3 text-end text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                COD
              </th>
              <th className="px-3 py-3 text-end text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                {t.payments?.fee_badge ?? "Fee"}
              </th>
              <th className="w-14 px-3 py-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                ✓
              </th>
            </tr>
          </thead>

          <tbody>
            {deliveredOrders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const codSettled = !!order.codPaymentId;
              const feeSettled = !!order.feePaymentId;
              const fullySettled = codSettled && feeSettled;

              return (
                <tr
                  key={order.id}
                  onClick={() => toggle(order.id)}
                  className={`border-b border-border/40 transition-colors ${
                    fullySettled
                      ? "opacity-40 cursor-default"
                      : isSelected
                      ? "bg-primary/5 cursor-pointer border-s-2 border-s-primary"
                      : "hover:bg-muted/20 cursor-pointer"
                  }`}
                >
                  {/* Row checkbox */}
                  <td className="w-10 px-3 py-3.5 text-center">
                    {!fullySettled && (
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                        isSelected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {isSelected && <Check size={9} className="text-primary-foreground" />}
                      </span>
                    )}
                  </td>

                  {/* Order info */}
                  <td className="px-3 py-3.5">
                    <p className="font-black text-sm text-foreground">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground font-semibold truncate" dir="rtl">
                      {order.customerName} · {order.wilaya}
                    </p>
                  </td>

                  {/* COD amount */}
                  <td className="px-3 py-3.5 text-end">
                    <p className={`text-sm font-bold tabular-nums ${
                      codSettled ? "line-through text-muted-foreground/50" : "text-amber-500"
                    }`}>
                      {formatPrice(order.codAmount ?? 0, common.currency.symbol)}
                    </p>
                  </td>

                  {/* Driver fee */}
                  <td className="px-3 py-3.5 text-end">
                    <p className={`text-sm font-bold tabular-nums ${
                      feeSettled ? "line-through text-muted-foreground/50" : "text-primary"
                    }`}>
                      {order.driverFee > 0
                        ? formatPrice(order.driverFee, common.currency.symbol)
                        : <span className="text-muted-foreground/40">—</span>}
                    </p>
                  </td>

                  {/* Settlement dots */}
                  <td className="w-14 px-3 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        title="COD"
                        className={`w-2 h-2 rounded-full ${codSettled ? "bg-green-500" : "bg-border"}`}
                      />
                      <span
                        title="Fee"
                        className={`w-2 h-2 rounded-full ${feeSettled ? "bg-green-500" : "bg-border"}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals footer */}
          <tfoot className="border-t border-border bg-muted/20">
            <tr>
              <td colSpan={2} className="px-3 py-2.5">
                {allSettled ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-500">
                    <CheckCircle2 size={11} />
                    {t.payments?.all_settled ?? "All settled"}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {settleableOrders.length} {t.payments?.orders ?? "orders"} {t.payments?.pending ?? "pending"}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-end">
                {totalPendingCod > 0 && (
                  <p className="text-xs font-black text-amber-500">
                    {formatPrice(totalPendingCod, common.currency.symbol)}
                  </p>
                )}
              </td>
              <td className="px-3 py-2.5 text-end">
                {totalPendingFee > 0 && (
                  <p className="text-xs font-black text-primary">
                    {formatPrice(totalPendingFee, common.currency.symbol)}
                  </p>
                )}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Action bar (appears on selection) ─────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">COD</p>
              <p className="text-sm font-black text-amber-500 tabular-nums">
                {formatPrice(selectedCod, common.currency.symbol)}
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">
                {t.payments?.fee_badge ?? "Fee"}
              </p>
              <p className="text-sm font-black text-primary tabular-nums">
                {formatPrice(selectedFee, common.currency.symbol)}
              </p>
            </div>
            <div className="bg-muted/60 border border-border rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">
                {t.payments?.net_label ?? "Net"}
              </p>
              <p className="text-sm font-black text-foreground tabular-nums">
                {formatPrice(selectedNet, common.currency.symbol)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
            <div className="space-y-2">
              {selectedCod > 0 && selectedFee > 0 && (
                <Button
                  className="w-full h-11 font-black text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => settle("net_settlement")}
                  disabled={isPending}
                >
                  <ArrowLeftRight size={14} className="me-2" />
                  {t.payments?.action_net ?? "Net Settlement"}
                  <span className="ms-2 text-xs opacity-80 tabular-nums">
                    ({formatPrice(selectedNet, common.currency.symbol)})
                  </span>
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {selectedCod > 0 && (
                  <Button
                    variant="outline"
                    className="h-10 font-bold text-sm border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    onClick={() => settle("cod_remittance")}
                    disabled={isPending}
                  >
                    <Banknote size={13} className="me-1.5" />
                    {t.payments?.action_cod ?? "Mark COD"}
                  </Button>
                )}
                {selectedFee > 0 && (
                  <Button
                    variant="outline"
                    className="h-10 font-bold text-sm border-green-500/30 bg-green-500/5 hover:bg-green-500/10 text-green-600 dark:text-green-400"
                    onClick={() => settle("fee_payment")}
                    disabled={isPending}
                  >
                    <CheckCircle2 size={13} className="me-1.5" />
                    {t.payments?.action_fee ?? "Pay Fee"}
                  </Button>
                )}
              </div>
            </div>
          </ProtectedAction>
        </div>
      )}

      {/* ── Payment History (collapsible) ──────────────────────────── */}
      {showHistory && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <History size={13} className="text-muted-foreground" />
            <h3 className="text-sm font-black text-foreground">
              {t.payments?.tab_history ?? "Payment History"}
            </h3>
          </div>

          {historyLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground font-semibold">
              {t.payments?.loading ?? "Loading..."}
            </p>
          )}

          {!historyLoading && history?.length === 0 && (
            <div className="py-10 text-center space-y-1.5">
              <Clock size={24} className="text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground font-semibold">
                {t.payments?.no_history ?? "No payment records yet"}
              </p>
            </div>
          )}

          {!historyLoading && history && history.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-start text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    {t.payments?.type_label ?? "Type"}
                  </th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    {t.payments?.count_label ?? "#"}
                  </th>
                  <th className="px-4 py-2.5 text-end text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    {t.payments?.amount_label ?? "Amount"}
                  </th>
                  <th className="px-4 py-2.5 text-start text-[10px] font-black text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t.payments?.by_label ?? "By"}
                  </th>
                  <th className="px-4 py-2.5 text-end text-[10px] font-black text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t.payments?.date_label ?? "Date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black ${TYPE_COLOR[p.type]}`}>
                        {t.payments?.[`type_${p.type}` as keyof typeof t.payments] ?? p.type}
                      </span>
                      {p.notes && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{p.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-muted-foreground">
                      {p.orderCount}
                    </td>
                    <td className="px-4 py-3 text-end font-black text-sm text-foreground tabular-nums">
                      {formatPrice(p.amount, common.currency.symbol)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <User size={10} /> {p.createdByName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end hidden sm:table-cell text-xs text-muted-foreground font-semibold">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
