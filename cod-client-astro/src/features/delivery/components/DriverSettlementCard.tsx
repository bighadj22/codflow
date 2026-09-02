import { useState } from "react";
import { AlertCircle, History, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import {
  Button,
  Alert,
  StatCard,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  createDriverPayment,
  listDriverPayments,
} from "@/features/delivery/api";
import {
  driverErrorMessage,
  formatDeliveryDate,
  formatDeliveryMoney,
} from "@/features/delivery/model";
import { notify } from "@/lib/notify";
import type {
  DriverOrder,
  DriverPayment,
  DriverPaymentType,
} from "@/features/delivery/types";

export function DriverSettlementCard({
  driverId,
  deliveredOrders,
}: {
  driverId: string;
  deliveredOrders: DriverOrder[];
}) {
  const t = useT("delivery");
  const common = useT("common");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<DriverPayment[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);
  const settleableOrders = deliveredOrders.filter(
    (order) => !order.codPaymentId || !order.feePaymentId,
  );
  const selected = deliveredOrders.filter((order) => selectedIds.has(order.id));
  const selectedCodOrders = selected.filter((order) => !order.codPaymentId);
  const selectedFeeOrders = selected.filter((order) => !order.feePaymentId);
  const selectedNetOrders = selected.filter(
    (order) => !order.codPaymentId && !order.feePaymentId,
  );
  const selectedCod = selectedCodOrders
    .reduce((sum, order) => sum + (order.codAmount ?? 0), 0);
  const selectedFee = selectedFeeOrders
    .reduce((sum, order) => sum + (order.driverFee ?? 0), 0);
  const selectedNet = selectedNetOrders.reduce(
    (sum, order) => sum + (order.codAmount ?? 0) - (order.driverFee ?? 0),
    0,
  );
  const totalPendingCod = settleableOrders
    .filter((order) => !order.codPaymentId)
    .reduce((sum, order) => sum + (order.codAmount ?? 0), 0);
  const totalPendingFee = settleableOrders
    .filter((order) => !order.feePaymentId)
    .reduce((sum, order) => sum + (order.driverFee ?? 0), 0);
  const allSettled = settleableOrders.length === 0;
  const isAllSelected =
    selectedIds.size > 0 &&
    settleableOrders.every((order) => selectedIds.has(order.id));

  function toggle(orderId: string) {
    const order = deliveredOrders.find((item) => item.id === orderId);
    if (order?.codPaymentId && order?.feePaymentId) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds(
      isAllSelected
        ? new Set()
        : new Set(settleableOrders.map((order) => order.id)),
    );
  }
  async function loadHistory() {
    if (historyLoading || history !== null) return;
    setHistoryLoading(true);
    try {
      setHistory(await listDriverPayments(driverId));
    } catch (cause) {
      setError(driverErrorMessage(cause, t));
    } finally {
      setHistoryLoading(false);
    }
  }
  async function settle(type: DriverPaymentType) {
    const eligibleOrders =
      type === "fee_payment"
        ? selectedFeeOrders
        : type === "cod_remittance"
          ? selectedCodOrders
          : selectedNetOrders;
    if (eligibleOrders.length === 0) return;
    const amount =
      type === "fee_payment"
        ? selectedFee
        : type === "cod_remittance"
          ? selectedCod
          : selectedNet;
    if (
      !(await confirm({
        title: t("payments.confirm_title"),
        description: t("payments.confirm_body")
          .replace("{amount}", formatDeliveryMoney(amount, locale))
          .replace("{count}", String(eligibleOrders.length)),
        confirmLabel: t(
          `payments.action_${type === "fee_payment" ? "fee" : type === "cod_remittance" ? "cod" : "net"}`,
        ),
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await createDriverPayment({
        driverId,
        type,
        orderIds: eligibleOrders.map((order) => order.id),
      });
      setSelectedIds(new Set());
      setHistory(null);
      notify.flashSuccess(
        t(
          `payments.success_${type === "fee_payment" ? "fee" : type === "cod_remittance" ? "cod" : "net"}`,
        ),
      );
      window.location.reload();
    } catch (cause) {
      const message = driverErrorMessage(cause, t);
      setError(message);
      notify.error(message);
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("table.recent_deliveries")}
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowHistory((current) => !current);
            if (!showHistory) void loadHistory();
          }}
        >
          <History size={15} />
          {t("payments.tab_history")}
        </Button>
      }
    >
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      {!allSettled && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={`${t("payments.total_cod_pending")} (${settleableOrders.filter((order) => !order.codPaymentId).length} ${t("payments.orders")})`}
            value={formatDeliveryMoney(totalPendingCod, locale)}
          />
          <StatCard
            label={`${t("payments.total_fee_pending")} (${settleableOrders.filter((order) => !order.feePaymentId).length} ${t("payments.orders")})`}
            value={formatDeliveryMoney(totalPendingFee, locale)}
          />
        </div>
      )}
      {allSettled ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("payments.all_settled")}
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={toggleAll}
              className="min-h-8 px-3 text-xs"
            >
              {isAllSelected
                ? t("payments.deselect_all")
                : t("payments.select_all")}
            </Button>
            {selectedIds.size > 0 && canManage && (
              <div className="flex flex-wrap gap-2">
                {selectedFee > 0 && (
                  <Button
                    type="button"
                    onClick={() => void settle("fee_payment")}
                    disabled={busy}
                    className="min-h-8 px-3 text-xs"
                  >
                    {t("payments.action_fee")} ·{" "}
                    {formatDeliveryMoney(selectedFee, locale)}
                  </Button>
                )}
                {selectedCod > 0 && (
                  <Button
                    type="button"
                    onClick={() => void settle("cod_remittance")}
                    disabled={busy}
                    className="min-h-8 px-3 text-xs"
                  >
                    {t("payments.action_cod")} ·{" "}
                    {formatDeliveryMoney(selectedCod, locale)}
                  </Button>
                )}
                {selectedNetOrders.length > 0 && selectedNet > 0 && (
                  <Button
                    type="button"
                    onClick={() => void settle("net_settlement")}
                    disabled={busy}
                    className="min-h-8 px-3 text-xs"
                  >
                    {t("payments.action_net")} ·{" "}
                    {formatDeliveryMoney(selectedNet, locale)}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="divide-y divide-border rounded-lg border border-border md:hidden">
            {deliveredOrders.map((order) => {
              const codSettled = !!order.codPaymentId;
              const feeSettled = !!order.feePaymentId;
              const selectable = !(codSettled && feeSettled);
              return (
                <label
                  key={order.id}
                  className={`flex min-h-16 items-center gap-3 p-3 ${selectable ? "cursor-pointer" : "opacity-60"}`}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggle(order.id)}
                      aria-label={`${t("payments.selected")}: ${order.orderNumber}`}
                      className="size-5 shrink-0 accent-primary"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {order.orderNumber}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {order.customerName}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block text-sm font-semibold tabular-nums">
                      {formatDeliveryMoney(order.codAmount ?? 0, locale)}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {t("payments.fee_badge")}: {formatDeliveryMoney(order.driverFee, locale)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("table.order")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("payments.amount_label")} (COD)
                  </TableHead>
                  <TableHead className="text-end">
                    {t("payments.fee_badge")}
                  </TableHead>
                  <TableHead className="text-end">{t("table.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveredOrders.map((order) => {
                  const codSettled = !!order.codPaymentId;
                  const feeSettled = !!order.feePaymentId;
                  const selectable = !(codSettled && feeSettled);
                  return (
                    <TableRow
                      key={order.id}
                      className={selectable ? "" : "opacity-60"}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {selectable && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggle(order.id)}
                              aria-label={`${t("payments.selected")}: ${order.orderNumber}`}
                              className="size-4 accent-primary"
                            />
                          )}
                          <div>
                            <p className="font-semibold">{order.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.customerName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <span
                          className={
                            codSettled
                              ? "text-muted-foreground/50 line-through"
                              : "font-semibold text-amber-600"
                          }
                        >
                          {formatDeliveryMoney(order.codAmount ?? 0, locale)}
                        </span>
                        {codSettled && (
                          <span className="ms-1 text-[10px] font-bold text-violet-600">
                            ✓
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        {order.driverFee > 0 ? (
                          <span
                            className={
                              feeSettled
                                ? "text-muted-foreground/50 line-through"
                                : "font-semibold"
                            }
                          >
                            {formatDeliveryMoney(order.driverFee, locale)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                        {feeSettled && order.driverFee > 0 && (
                          <span className="ms-1 text-[10px] font-bold text-violet-600">
                            ✓
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatDeliveryDate(order.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {showHistory && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("payments.tab_history")}
          </h3>
          {historyLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("payments.loading")}
            </p>
          ) : history === null || history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("payments.no_history")}
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {t(`payments.type_${payment.type}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{payment.orderCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums">
                      {formatDeliveryMoney(payment.amount, locale)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {payment.createdByName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDeliveryDate(payment.createdAt, locale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
