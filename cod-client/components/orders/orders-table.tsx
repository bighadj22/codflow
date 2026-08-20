"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Package, MapPin, MoreHorizontal, Truck, Building2,
  Check, Search, X, Star, Zap, Trash2, Filter,
  Home, Store,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable, TableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorModal } from "@/components/errors/error-modal";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useOrders, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatPrice, formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateOrderStatus, assignDriverToOrder, dispatchOrder, deleteOrder } from "@/actions/orders";
import { fetchCompanyStopDesks } from "@/actions/delivery-companies";
import { useConfirm } from "@/components/ui/use-confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import type { Order, OrderStatus, Driver, DeliveryCompany, StopDesk } from "@/types";
import { SCOPES } from "@/../cod-shared/rbac/scopes";

// Statuses the user can manually set via the inline row dropdown.
// "dispatched" is intentionally excluded — it is set by the dispatch action only.
const ALL_STATUSES: OrderStatus[] = [
  "new", "confirmed", "unreachable", "preparing", "ready", "assigned",
  "out_for_delivery", "delivered", "returned", "cancelled",
];

// Statuses available in the filter dropdown — includes "dispatched" so users
// can filter the list to the carrier-validation queue.
const FILTER_STATUSES: OrderStatus[] = [
  "new", "confirmed", "unreachable", "preparing", "ready", "assigned",
  "dispatched", "out_for_delivery", "delivered", "returned", "cancelled",
];

// Provider capability matrix for the dispatch dialog's optional fields.
// Mirrors what each provider's createShipment adapter actually consumes.
function dispatchFieldSupport(companyCode: string) {
  const isEcotrack = companyCode === "ecotrack" || companyCode.endsWith("_ecotrack");
  if (isEcotrack)               return { remarks: true,  weight: true,  fragile: true  };
  if (companyCode === "noest")  return { remarks: true,  weight: true,  fragile: false };
  // yalidine and zr_express: createShipment payload has no remarks/weight/fragile fields,
  // so showing those inputs in the UI would mislead the user — they would be discarded.
  return { remarks: false, weight: false, fragile: false };
}

// ── Inline status dropdown ─────────────────────────────────────────────────

function StatusCell({ order, onRefresh }: { order: Order; onRefresh: () => void }) {
  const t = useOrders();
  const [isPending, startTransition] = useTransition();

  function changeStatus(status: OrderStatus) {
    if (status === order.status) return;
    startTransition(async () => {
      const res = await updateOrderStatus(order.id, status);
      if (!res.ok) {
        toast.error(res.error || (t.detail?.error_status ?? "Failed to update status"));
        return;
      }
      toast.success((t.detail?.status_updated ?? "Status: ") + (t.status?.[status] ?? status));
      onRefresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            disabled={isPending}
            className="cursor-pointer hover:opacity-75 transition-opacity focus:outline-none"
          />
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={order.status} />
          {order.lastUpdatedBy?.startsWith("webhook:") && (
            <span
              title={`Auto-updated by ${order.lastUpdatedBy === "webhook:zr_express" ? "ZR Express" : "Yalidine"}`}
              className="text-primary"
            >
              <Zap size={11} />
            </span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => changeStatus(s)}
            className={cn("gap-2", s === order.status && "font-black")}
          >
            <StatusBadge status={s} />
            {s === order.status && <Check size={11} className="ms-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Assign Driver Dialog ───────────────────────────────────────────────────

export function AssignDriverDialog({
  order,
  drivers,
  onClose,
  onAssigned,
}: {
  order: Order;
  drivers: Driver[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const t = useOrders();
  const locale = useErrorLocale();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(order.driverId ?? "");
  const [isPending, startTransition] = useTransition();
  const [errorState, setErrorState] = useState<{ isOpen: boolean; message: string; code?: string }>({ isOpen: false, message: "" });

  const filtered = drivers.filter((d) => {
    const name = `${d.firstName} ${d.lastName}`.toLowerCase();
    return name.includes(query.toLowerCase());
  });

  function handleAssign() {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        await assignDriverToOrder(order.id, selectedId);
        toast.success(t.assign_driver_dialog?.success ?? "Driver assigned");
        onAssigned();
        onClose();
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.error_assign ?? "Failed to assign driver") });
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black">{t.assign_driver_dialog?.title ?? "Assign Driver"}</DialogTitle>
          <p className="text-xs text-muted-foreground font-semibold">{order.orderNumber} · {order.wilaya}</p>
        </DialogHeader>

        <div className="relative">
          <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.assign_driver_dialog?.search_placeholder ?? "Search driver..."}
            className="ps-8 h-9 text-sm"
          />
        </div>

        <div className="space-y-1 max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground font-semibold">
              {t.assign_driver_dialog?.no_drivers ?? "No drivers"}
            </p>
          )}
          {filtered.map((d) => {
            const isSelected = selectedId === d.id;
            const isCurrent = order.driverId === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start transition-colors",
                  isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60 border border-transparent"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-black shrink-0">
                  {d.firstName.charAt(0)}{d.lastName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{d.firstName} {d.lastName}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                    {d.status === "available" ? (t.assign_driver_dialog?.available ?? "Available") : (t.assign_driver_dialog?.busy ?? "Busy")}
                    {isCurrent && " · current"}
                  </p>
                </div>
                {isSelected && <Check size={14} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        <Button onClick={handleAssign} disabled={!selectedId || isPending} className="w-full h-10 font-black">
          {isPending ? (t.assign_driver_dialog?.assigning ?? "Assigning...") : (t.assign_driver_dialog?.assign ?? "Assign")}
        </Button>
      </DialogContent>
      <ErrorModal isOpen={errorState.isOpen} onClose={() => setErrorState({ isOpen: false, message: "" })} message={errorState.message} locale={locale} errorCode={errorState.code} />
    </Dialog>
  );
}

// ── Dispatch to Company Dialog ─────────────────────────────────────────────

export function DispatchCompanyDialog({
  order,
  companies,
  onClose,
  onDispatched,
}: {
  order: Order;
  companies: DeliveryCompany[];
  onClose: () => void;
  onDispatched: (trackingNumber: string, labelUrl?: string | null) => void;
}) {
  const t = useOrders();
  const common = useCommon();
  const locale = useErrorLocale();
  const [selectedId, setSelectedId] = useState(order.companyId ?? "");
  const [stationCode, setStationCode] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [stations, setStations] = useState<StopDesk[]>([]);
  const [loadingStations, startStationsTransition] = useTransition();
  const [remarks, setRemarks] = useState("");
  const [weight, setWeight] = useState("");
  const [fragile, setFragile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorState, setErrorState] = useState<{ isOpen: boolean; message: string; code?: string }>({ isOpen: false, message: "" });

  const isStopDesk = order.deliveryType === "stop_desk";
  const selectedCompany = companies.find((c) => c.id === selectedId);
  const fieldSupport = dispatchFieldSupport(selectedCompany?.code ?? "");

  // Fetch stop desks when a company is selected for stop-desk orders
  useEffect(() => {
    if (!selectedId || !isStopDesk) return;
    setStations([]);
    setStationCode("");
    setStationQuery("");
    startStationsTransition(async () => {
      try {
        const desks = await fetchCompanyStopDesks(selectedId, { activeOnly: true });
        setStations(desks);
      } catch {
        setStations([]);
      }
    });
  }, [selectedId, isStopDesk]);

  // When no search query, show only desks for the order's wilaya (if any match).
  // Once the user types, search across all desks.
  const wilayaDesks = useMemo(
    () => (order.wilayaId ? stations.filter((s) => s.wilayaId === order.wilayaId) : []),
    [stations, order.wilayaId]
  );
  const defaultPool = wilayaDesks.length > 0 ? wilayaDesks : stations;

  const filteredStations = useMemo(() => {
    if (!stationQuery.trim()) return defaultPool;
    const q = stationQuery.toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.commune ?? "").toLowerCase().includes(q)
    );
  }, [stations, defaultPool, stationQuery]);

  function handleDispatch() {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        const parsedWeight = parseFloat(weight);
        // Only forward fields the selected provider's createShipment will actually consume.
        // Sending extras for yalidine/zr is harmless but misleading in API logs.
        const result = await dispatchOrder(order.id, {
          companyId: selectedId,
          stationCode: stationCode || undefined,
          remarks: fieldSupport.remarks ? (remarks || undefined) : undefined,
          weight: fieldSupport.weight && weight && !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined,
          fragile: fieldSupport.fragile && fragile ? true : undefined,
        });
        toast.success((t.dispatch_dialog?.success ?? "Dispatched — Tracking: ") + result.trackingNumber);
        onDispatched(result.trackingNumber, result.labelUrl);
        onClose();
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.dispatch_failed ?? "Dispatch failed") });
      }
    });
  }

  const remarksMax = 500;
  const remarksOver = remarks.length > remarksMax;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">{t.dispatch_dialog?.title ?? "Dispatch to Company"}</DialogTitle>
          <p className="text-xs text-muted-foreground font-semibold">
            {order.orderNumber} · {order.wilaya}
            {isStopDesk && (
              <span className="ms-1.5 text-primary/60 font-black uppercase text-[10px] tracking-wide">
                · {t.detail?.stop_desk ?? "Desk"}
              </span>
            )}
          </p>
        </DialogHeader>

        {companies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground font-semibold">
            {t.dispatch_dialog?.no_companies ?? "No connected companies"}
          </p>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => {
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-start transition-colors border",
                    isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/60 border-border/50"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{c.code}</p>
                  </div>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Stop-desk picker */}
        {isStopDesk && selectedId && (
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-wide">
              {t.dispatch_dialog?.station_code_label ?? "Station"}
            </label>

            {loadingStations ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/30 bg-muted/20">
                <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                <span className="text-xs text-muted-foreground font-semibold">
                  {t.dispatch_dialog?.loading_stations ?? "Loading desks..."}
                </span>
              </div>
            ) : stations.length > 0 ? (
              <>
                <div className="relative">
                  <Search size={12} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    value={stationQuery}
                    onChange={(e) => setStationQuery(e.target.value)}
                    placeholder={t.dispatch_dialog?.station_picker_placeholder ?? "Search desks..."}
                    className="ps-8 h-9 text-sm"
                  />
                </div>
                {!stationQuery && wilayaDesks.length > 0 && wilayaDesks.length < stations.length && (
                  <p className="text-[10px] text-muted-foreground/50 font-semibold">
                    {order.wilaya} · search to see all wilayas
                  </p>
                )}
                <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-border/30 p-1.5">
                  {filteredStations.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground font-semibold">—</p>
                  ) : (
                    filteredStations.map((s) => {
                      const isSelected = stationCode === s.code;
                      return (
                        <button
                          key={s.code}
                          onClick={() => setStationCode(s.code)}
                          className={cn(
                            "w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-start transition-colors",
                            isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60 border border-transparent"
                          )}
                        >
                          <span className="shrink-0 font-mono text-[10px] font-black text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded mt-0.5">
                            {s.code}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                            {s.commune && (
                              <p className="text-[10px] text-muted-foreground/60 font-semibold truncate">
                                {s.commune}
                              </p>
                            )}
                          </div>
                          {isSelected && <Check size={12} className="text-primary shrink-0 mt-1" />}
                        </button>
                      );
                    })
                  )}
                </div>
                {stationCode && (
                  <p className="text-[10px] text-primary/70 font-black uppercase tracking-wide">
                    ✓ {stationCode}
                  </p>
                )}
              </>
            ) : (
              // Fallback manual input if station list is empty
              <>
                <Input
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  placeholder={t.dispatch_dialog?.station_code_placeholder ?? "e.g. 16A"}
                  className="h-9 text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground font-semibold">
                  {t.dispatch_dialog?.station_code_hint ?? "Required for stop-desk orders"}
                </p>
              </>
            )}
          </div>
        )}

        {/* Remarks — only providers that consume it on createShipment (ecotrack, noest) */}
        {fieldSupport.remarks && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-wide">
                {t.dispatch_dialog?.remarks_label ?? "Remarks (optional)"}
              </label>
              {remarks.length > 0 && (
                <span className={cn("text-[10px] font-bold tabular-nums", remarksOver ? "text-rose-500" : "text-muted-foreground/50")}>
                  {remarks.length}/{remarksMax}
                </span>
              )}
            </div>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={t.dispatch_dialog?.remarks_placeholder ?? "e.g. Call before delivery"}
              className={cn("h-9 text-sm", remarksOver && "border-rose-400 focus-visible:ring-rose-400")}
            />
          </div>
        )}

        {/* Weight + Fragile — both supported by ecotrack; weight only by noest */}
        {(fieldSupport.weight || fieldSupport.fragile) && (
          <div className="flex items-end gap-3">
            {fieldSupport.weight && (
              <div className="flex-1 space-y-1">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wide">
                  {t.detail?.weight ?? "Weight (kg)"}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.5"
                  className="h-9 text-sm"
                />
              </div>
            )}
            {fieldSupport.fragile && (
              <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                <Checkbox checked={fragile} onCheckedChange={(v) => setFragile(!!v)} />
                <span className="text-sm font-bold">{t.detail?.fragile ?? "Fragile"}</span>
              </label>
            )}
          </div>
        )}

        <Button
          onClick={handleDispatch}
          disabled={!selectedId || isPending || remarksOver || (isStopDesk && !stationCode)}
          className="w-full h-10 font-black"
        >
          {isPending ? (t.dispatch_dialog?.dispatching ?? "Dispatching...") : (t.dispatch_dialog?.dispatch ?? "Dispatch")}
        </Button>
      </DialogContent>
      <ErrorModal isOpen={errorState.isOpen} onClose={() => setErrorState({ isOpen: false, message: "" })} message={errorState.message} locale={locale} errorCode={errorState.code} />
    </Dialog>
  );
}

// ── Row Actions ────────────────────────────────────────────────────────────

function OrderRowActions({
  order,
  drivers,
  companies,
  userScopes,
  onRefresh,
}: {
  order: Order;
  drivers: Driver[];
  companies: DeliveryCompany[];
  userScopes: string[];
  onRefresh: () => void;
}) {
  const t = useOrders();
  const common = useCommon();
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const hasScope = (scope: string) => userScopes.includes(scope) || userScopes.includes(SCOPES.ALL);

  const isDispatched = !!order.trackingNumber;
  const isDriverAssigned = !!order.driverId;
  const isCompanyMethod = isDispatched || order.deliveryMethod === "company";
  const isDriverMethod = order.deliveryMethod === "driver" && isDriverAssigned && !isDispatched;
  const isTerminal = ["out_for_delivery", "delivered", "returned", "cancelled"].includes(order.status);

  const showAssign = hasScope(SCOPES.ORDERS_ASSIGN) && !isDispatched && !isCompanyMethod && !isTerminal;
  const showDispatch = hasScope(SCOPES.DELIVERY_DISPATCH) && companies.length > 0 && !isDispatched && !isDriverMethod && !isTerminal;
  const showDelete = hasScope(SCOPES.ORDERS_DELETE);

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `${t.actions?.delete ?? "Delete"} ${order.orderNumber}?`,
      variant: "destructive",
      confirmLabel: common.delete ?? t.actions?.delete ?? "Delete",
    });
    if (!ok) return;
    startDeleteTransition(async () => {
      try {
        await deleteOrder(order.id);
        toast.success(t.actions?.delete ?? "Order deleted");
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete order");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger 
          disabled={isDeleting}
          render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" />}
        >
          <MoreHorizontal size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)} disabled={isDeleting}>
            <Eye size={13} className="me-2" />
            {t.actions?.view ?? "View"}
          </DropdownMenuItem>
          {showAssign && (
            <DropdownMenuItem onClick={() => setAssignOpen(true)} disabled={isDeleting}>
              <Truck size={13} className="me-2" />
              {t.actions?.assign_driver ?? "Assign Driver"}
            </DropdownMenuItem>
          )}
          {showDispatch && (
            <DropdownMenuItem onClick={() => setDispatchOpen(true)} disabled={isDeleting}>
              <Building2 size={13} className="me-2" />
              {t.actions?.dispatch_to_company ?? "Dispatch to Company"}
            </DropdownMenuItem>
          )}
          {showDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
              >
                {isDeleting ? (
                  <div className="w-3 h-3 me-2 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={13} className="me-2" />
                )}
                {t.actions?.delete ?? "Delete"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {ConfirmDialog}

      {assignOpen && (
        <AssignDriverDialog
          order={order}
          drivers={drivers}
          onClose={() => setAssignOpen(false)}
          onAssigned={onRefresh}
        />
      )}

      {dispatchOpen && (
        <DispatchCompanyDialog
          order={order}
          companies={companies}
          onClose={() => setDispatchOpen(false)}
          onDispatched={() => onRefresh()}
        />
      )}
    </>
  );
}

// ── Main table ─────────────────────────────────────────────────────────────

interface OrdersTableProps {
  orders: Order[];
  drivers?: Driver[];
  companies?: DeliveryCompany[];
  userScopes?: string[];
}

export function OrdersTable({
  orders,
  drivers = [],
  companies = [],
  userScopes = [],
}: OrdersTableProps) {
  const t = useOrders();
  const common = useCommon();
  const { dir } = useLanguage();
  const router = useRouter();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const hasActiveFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    deliveryFilter !== "all" ||
    wilayaFilter !== "all" ||
    typeFilter !== "all";

  // Unique wilayas derived from all orders (not filtered) for the dropdown
  const uniqueWilayas = useMemo(
    () => [...new Set(orders.map((o) => o.wilaya))].sort(),
    [orders]
  );

  // Filtered orders
  const filtered = useMemo(() => {
    let result = orders;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (deliveryFilter === "driver") {
      result = result.filter((o) => !o.trackingNumber && !!o.driverId);
    } else if (deliveryFilter === "company") {
      result = result.filter((o) => !!o.trackingNumber);
    } else if (deliveryFilter === "unassigned") {
      result = result.filter((o) => !o.trackingNumber && !o.driverId);
    }

    if (wilayaFilter !== "all") {
      result = result.filter((o) => o.wilaya === wilayaFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((o) => o.orderType === typeFilter);
    }

    return result;
  }, [orders, search, statusFilter, deliveryFilter, wilayaFilter, typeFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDeliveryFilter("all");
    setWilayaFilter("all");
    setTypeFilter("all");
  }

  function handleRefresh() {
    router.refresh();
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const columns: TableColumn<Order>[] = [
    {
      key: "orderNumber",
      label: t.table.order_number,
      sortable: true,
      isTitle: true,
      render: (value, row) => (
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
            <Package className="w-4 h-4 text-primary" />
            <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-sm">
              {row.deliveryType === "stop_desk"
                ? <Store size={8} className="text-amber-500/80" />
                : <Home size={8} className="text-primary/70" />}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-black tracking-tight">{value}</span>
              {(row.hasReview ?? 0) > 0 && (
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
              )}
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/40 tabular-nums whitespace-nowrap">
              {formatRelativeTime(row.createdAt)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: t.table.customer,
      sortable: true,
      isSubtitle: true,
      render: (value) => (
        <span className="font-bold text-sm tracking-tight">{value}</span>
      ),
    },
    {
      key: "phone",
      label: t.table.phone,
      render: (value) => (
        <span className="text-[11px] font-bold text-muted-foreground/70 tabular-nums select-all whitespace-nowrap" dir="ltr">
          {value}
        </span>
      ),
      tabletHidden: true,
    },
    {
      key: "status",
      label: t.table.status,
      sortable: true,
      isStatus: true,
      render: (_value, row) => <StatusCell order={row} onRefresh={handleRefresh} />,
    },
    {
      key: "wilaya",
      label: t.table.wilaya,
      sortable: true,
      render: (value, row) => (
        <div className="flex items-start gap-1.5 min-w-0">
          <MapPin className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground/80 truncate">{value}</p>
            {row.commune && (
              <p className="text-[10px] font-semibold text-muted-foreground/50 truncate">
                {row.commune}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "deliveryMethod",
      label: t.table.delivery,
      render: (_value, row) => {
        if (row.trackingNumber) {
          const company = companies.find((c) => c.id === row.companyId);
          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-md bg-primary/8 border border-primary/12 flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-primary/60" />
              </div>
              <p className="text-[11px] font-bold text-foreground/80 truncate">
                {company?.name ?? t.detail?.partner_company ?? "Company"}
              </p>
            </div>
          );
        }
        if (row.driverName) {
          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <Truck size={12} className="text-muted-foreground/50 shrink-0" />
              <span className="text-xs font-bold text-foreground/70 truncate">
                {row.driverName}
              </span>
            </div>
          );
        }
        return <span className="text-muted-foreground/20 text-sm select-none">—</span>;
      },
      tabletHidden: true,
    },


    {
      key: "price",
      label: t.table.price,
      sortable: true,
      render: (value) => (
        <span className="font-black text-sm text-primary tabular-nums">
          {formatPrice(value, common.currency.symbol)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "id",
      label: "",
      render: (_value, row) => (
        <OrderRowActions
          order={row}
          drivers={drivers}
          companies={companies}
          userScopes={userScopes}
          onRefresh={handleRefresh}
        />
      ),
      className: "w-10 text-end",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 group">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary",
            dir === "rtl" ? "right-3.5" : "left-3.5"
          )} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search_placeholder ?? "Search..."}
            className={cn(
              "bg-card border-border/60 shadow-xs h-10",
              dir === "rtl" ? "pr-10" : "pl-10",
              search && (dir === "rtl" ? "pe-9" : "ps-9")
            )}
            dir={dir}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors",
                dir === "rtl" ? "left-3" : "right-3"
              )}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-border/60 shadow-xs h-10">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Filter className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="truncate text-[13px] font-medium">
                {statusFilter === "all"
                  ? `${t.filters?.status ?? "Status"}`
                  : (t.status?.[statusFilter as OrderStatus] ?? statusFilter)}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.status?.all ?? "All Statuses"}</SelectItem>
            {FILTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t.status?.[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Delivery method filter */}
        <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-border/60 shadow-xs h-10">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Truck className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="truncate text-[13px] font-medium">
                {deliveryFilter === "all"
                  ? (t.filters?.delivery_method ?? "Delivery")
                  : deliveryFilter === "driver"
                    ? (t.filters?.driver ?? "Driver")
                    : deliveryFilter === "company"
                      ? (t.filters?.company ?? "Company")
                      : (t.filters?.unassigned ?? "Unassigned")}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.filters?.all_delivery ?? "All Methods"}</SelectItem>
            <SelectItem value="driver">{t.filters?.driver ?? "Driver"}</SelectItem>
            <SelectItem value="company">{t.filters?.company ?? "Company"}</SelectItem>
            <SelectItem value="unassigned">{t.filters?.unassigned ?? "Unassigned"}</SelectItem>
          </SelectContent>
        </Select>

        {/* Wilaya filter */}
        {uniqueWilayas.length > 1 && (
          <Select value={wilayaFilter} onValueChange={(v) => setWilayaFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-44 bg-card border-border/60 shadow-xs h-10">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                <span className="truncate text-[13px] font-medium">
                  {wilayaFilter === "all" ? (t.filters?.wilaya ?? "Wilaya") : wilayaFilter}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.filters?.all_wilayas ?? "All Wilayas"}</SelectItem>
              {uniqueWilayas.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {hasActiveFilter && (
          <Button
            variant="outline"
            onClick={clearFilters}
            className="h-10 px-3 border-border/60 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={13} className="me-1.5" />
            <span className="text-[12px] font-bold">{common.cancel ?? "Clear"}</span>
          </Button>
        )}
      </div>

      {/* ── Data table (pagination + sort only — search/filter handled above) ─ */}
      <DataTable
        data={filtered}
        columns={columns}
        searchable={false}
        filterable={false}
        emptyState={
          hasActiveFilter ? (
            <div className="py-10 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">
                {common.no_results_found ?? "No results"}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title={t.empty_state.title}
              description={t.empty_state.description}
              actionLabel={t.empty_state.action}
              onAction={() => router.push("/orders/new")}
            />
          )
        }
        renderMobileCard={(order) => {
          const company = companies.find((c) => c.id === order.companyId);
          return (
            <div className="flex flex-col gap-2 py-0.5">
              {/* Row 1: status + order# + actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusCell order={order} onRefresh={handleRefresh} />
                  {order.lastUpdatedBy?.startsWith("webhook:") && (
                    <Zap size={10} className="text-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground/35 tracking-tight" dir="ltr">
                    #{order.orderNumber}
                  </span>
                  <OrderRowActions
                    order={order}
                    drivers={drivers}
                    companies={companies}
                    userScopes={userScopes}
                    onRefresh={handleRefresh}
                  />
                </div>
              </div>

              {/* Row 2: customer name */}
              <p className="text-[16px] font-black text-foreground tracking-tight leading-snug truncate">
                {order.customerName}
              </p>
              <p className="text-[12px] font-semibold text-muted-foreground/60 tabular-nums select-all -mt-1.5" dir="ltr">
                {order.phone}
              </p>

              {/* Row 3: price + delivery type + date */}
              <div className="flex items-center justify-between gap-2 pt-2 pb-2.5 border-b border-border/10">
                <p className="text-[22px] font-black text-primary tabular-nums tracking-tight leading-none" dir="ltr">
                  {formatPrice(order.price, common.currency.symbol)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md",
                    order.deliveryType === "stop_desk"
                      ? "bg-amber-500/10 text-amber-600/80"
                      : "bg-primary/8 text-primary/70"
                  )}>
                    {order.deliveryType === "stop_desk"
                      ? <Store size={8} />
                      : <Home size={8} />}
                    {order.deliveryType === "stop_desk"
                      ? (t.detail?.stop_desk ?? "Desk")
                      : (t.detail?.home_delivery ?? "Home")}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground/35 tabular-nums whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </span>
                </div>
              </div>

              {/* Row 4: location */}
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3 h-3 text-primary/40 shrink-0" />
                <p className="flex-1 min-w-0 text-[12px] font-semibold text-muted-foreground truncate">
                  {order.wilaya}{order.commune ? ` · ${order.commune}` : ""}
                </p>
              </div>

              {/* Row 5: dispatch info (if any) */}
              {(order.trackingNumber || order.driverName) && (
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-muted/30 border border-border/20">
                  {order.trackingNumber ? (
                    <Building2 size={11} className="text-primary/50 shrink-0" />
                  ) : (
                    <Truck size={11} className="text-muted-foreground/50 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 truncate">
                      {order.trackingNumber
                        ? (company?.name ?? t.detail?.company ?? "Company")
                        : (t.detail?.driver ?? "Driver")}
                    </p>
                    {order.trackingNumber && (
                      <p className="font-mono text-[11px] font-black text-primary/70 tracking-tight truncate select-all" dir="ltr">
                        {order.trackingNumber}
                      </p>
                    )}
                    {!order.trackingNumber && order.driverName && (
                      <p className="text-[11px] font-bold text-foreground/70 truncate">
                        {order.driverName}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
