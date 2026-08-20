"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Truck, Building2, Trash2, Package, Lock, User, MapPin, Info, Clock, ShoppingBag, X, Phone, PhoneMissed, FileDown, ExternalLink, Zap,
  RefreshCw, MessageSquare, Pencil, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrders, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import {
  updateOrderStatus, deleteOrder, validateShipment,
  updateShipment, cancelShipment, addShipmentRemark,
  getShipmentTracking,
} from "@/actions/orders";
import { formatPrice, formatDateTime } from "@/lib/format";
import { ErrorModal } from "@/components/errors/error-modal";
import { useErrorLocale } from "@/lib/errors/use-locale";
import type { Order, OrderStatus, Driver, DeliveryCompany } from "@/types";
import { AssignDriverDialog, DispatchCompanyDialog } from "@/components/orders/orders-table";

const DRIVER_FLOW: OrderStatus[] = ["new", "confirmed", "preparing", "ready", "assigned", "out_for_delivery", "delivered"];
const COMPANY_FLOW: OrderStatus[] = ["new", "confirmed", "preparing", "ready", "dispatched", "out_for_delivery", "delivered"];

interface Props {
  order: Order;
  drivers: Driver[];
  companies: DeliveryCompany[];
}

export function OrderDetailView({ order: initialOrder, drivers, companies }: Props) {
  const t = useOrders();
  const common = useCommon();
  const router = useRouter();
  const locale = useErrorLocale();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [status, setStatus] = useState<OrderStatus>(initialOrder.status);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(initialOrder.trackingNumber);
  const [driverId, setDriverId] = useState<string | null>(initialOrder.driverId);
  const [deliveryMethod, setDeliveryMethod] = useState(initialOrder.deliveryMethod);
  const [labelUrl, setLabelUrl] = useState<string | null>(initialOrder.labelUrl ?? null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorState, setErrorState] = useState<{ isOpen: boolean; message: string; code?: string }>({ isOpen: false, message: "" });

  // Shipment management state
  const [trackingEvents, setTrackingEvents] = useState<Array<{ activity: string; description?: string; date?: string }> | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [loadingTracking, startTrackingTransition] = useTransition();

  const [showRemarkForm, setShowRemarkForm] = useState(false);
  const [remarkContent, setRemarkContent] = useState("");
  const [submittingRemark, startRemarkTransition] = useTransition();

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateName, setUpdateName] = useState(initialOrder.customerName ?? "");
  const [updatePhone, setUpdatePhone] = useState(initialOrder.phone ?? "");
  const [updateAmount, setUpdateAmount] = useState(String(initialOrder.price ?? ""));
  const [updateAddress, setUpdateAddress] = useState(initialOrder.address ?? "");
  const [updatePhone2, setUpdatePhone2] = useState("");
  const [updateWeight, setUpdateWeight] = useState(initialOrder.weight != null ? String(initialOrder.weight) : "");
  const [updateFragile, setUpdateFragile] = useState<boolean>(initialOrder.isFragile ?? false);
  const [updateRemarks, setUpdateRemarks] = useState(initialOrder.notes ?? "");
  const [updatingShipment, startUpdateTransition] = useTransition();

  // Display state — reflects carrier updates immediately without a full page reload.
  const [displayName, setDisplayName] = useState(initialOrder.customerName ?? "");
  const [displayPhone, setDisplayPhone] = useState(initialOrder.phone ?? "");
  const [displayPrice, setDisplayPrice] = useState(initialOrder.price ?? 0);
  const [displayAddress, setDisplayAddress] = useState(initialOrder.address ?? "");

  const [cancellingShipment, startCancelTransition] = useTransition();

  const isComplete = ["delivered", "returned", "cancelled"].includes(status);
  const isUnreachable = status === "unreachable";
  const isDispatched = !!trackingNumber;
  const isDriverAssigned = !!driverId;
  const isDriverMethod = (deliveryMethod === "driver" && isDriverAssigned) || (isDriverAssigned && !isDispatched);
  const isCompanyMethod = isDispatched || deliveryMethod === "company";
  const isOutOrLater = ["out_for_delivery", "delivered", "returned", "cancelled"].includes(status);

  const STATUS_FLOW = isCompanyMethod ? COMPANY_FLOW : DRIVER_FLOW;
  const currentIndex = STATUS_FLOW.indexOf(status);

  const virtualCurrentIndex = isUnreachable
    ? Math.max(-1, ...((initialOrder.statusHistory ?? []).map((h) => STATUS_FLOW.indexOf(h.status as OrderStatus)).filter((i) => i >= 0)))
    : currentIndex;

  const canValidateShipment = status === "dispatched" && !!trackingNumber;
  const canAdvanceFromReady = status === "ready" && isCompanyMethod && isDispatched;
  const canAdvanceStatus =
    !isComplete &&
    !isUnreachable &&
    currentIndex >= 0 &&
    currentIndex < STATUS_FLOW.length - 1 &&
    (status !== "ready" || canAdvanceFromReady);

  const canMarkUnreachable = !isComplete && !isUnreachable && (status === "new" || status === "confirmed");
  const canAssignDriver = !isComplete && !isUnreachable && !isCompanyMethod && !isOutOrLater && drivers.length > 0;
  const canDispatch = !isComplete && !isUnreachable && !isDispatched && !isDriverMethod && companies.length > 0;

  const company = companies.find((c) => c.id === initialOrder.companyId) ?? null;
  const driver = drivers.find((d) => d.id === driverId) ?? null;

  function handleAdvanceStatus() {
    const next = STATUS_FLOW[currentIndex + 1];
    if (!next) return;
    startTransition(async () => {
      const res = await updateOrderStatus(initialOrder.id, next);
      if (!res.ok) {
        setErrorState({ isOpen: true, message: res.error || t.detail.error_status });
        return;
      }
      setStatus(next);
      toast.success((t.detail.status_updated ?? "Status: ") + (t.status[next] ?? next));
    });
  }

  function handleAdvanceViaStatus(next: OrderStatus) {
    startTransition(async () => {
      const res = await updateOrderStatus(initialOrder.id, next);
      if (!res.ok) {
        setErrorState({ isOpen: true, message: res.error || t.detail.error_status });
        return;
      }
      setStatus(next);
      toast.success((t.detail.status_updated ?? "Status: ") + (t.status[next] ?? next));
    });
  }

  function handleMarkUnreachable() {
    startTransition(async () => {
      const res = await updateOrderStatus(initialOrder.id, "unreachable");
      if (!res.ok) {
        setErrorState({ isOpen: true, message: res.error || t.detail.error_status });
        return;
      }
      setStatus("unreachable");
      toast.success(t.status.unreachable);
    });
  }

  function handleRetryCall() {
    startTransition(async () => {
      const res = await updateOrderStatus(initialOrder.id, "confirmed");
      if (!res.ok) {
        setErrorState({ isOpen: true, message: res.error || t.detail.error_status });
        return;
      }
      setStatus("confirmed");
      toast.success(t.status.confirmed);
    });
  }

  async function handleValidateShipment() {
    const ok = await confirmDialog({
      title: t.detail?.validate_shipment_confirm ?? "Validate shipment at carrier?",
      variant: "default",
      confirmLabel: t.detail?.validate_shipment_btn ?? "Validate",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await validateShipment(initialOrder.id);
        setStatus("out_for_delivery");
        toast.success(t.detail?.validate_shipment_success ?? "Shipment validated — order is now out for delivery");
      } catch (error) {
        setErrorState({ isOpen: true, message: error instanceof Error ? error.message : (t.detail?.error_status ?? "Error") });
      }
    });
  }

  async function handleDeleteOrder() {
    const ok = await confirmDialog({
      title: t.detail.cancel_confirm,
      variant: "destructive",
      confirmLabel: common.confirm,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteOrder(initialOrder.id);
        toast.success(t.detail.cancelled);
        router.push("/orders");
      } catch (error) {
        setErrorState({ isOpen: true, message: error instanceof Error ? error.message : t.detail.error_cancel });
      }
    });
  }

  // EcoTrack platform: "ecotrack" (direct) or any "<name>_ecotrack" code (e.g. "packers_ecotrack").
  // Must mirror the backend registry pattern so renaming a company's code doesn't silently hide buttons.
  const companyCode = company?.code ?? "";
  const isEcotrackCompany = (code: string) => code === "ecotrack" || code.endsWith("_ecotrack");

  // ── Per-provider capability matrix ────────────────────────────────────────
  // Source of truth: cod-server provider test suite, all four providers passed
  // 89-100% (see ALL_PROVIDERS_TEST_SUMMARY.md). Capabilities below mirror what
  // the carrier APIs actually accept — keep in sync with the backend adapters
  // or buttons will appear for actions the carrier rejects.
  //
  // Booleans here describe FEATURE support (does the provider expose this op?).
  // The status-window restrictions (e.g. "only before validation") are applied
  // separately below in the canUpdateAtCarrier / canCancelAtCarrier blocks.
  const caps = (() => {
    if (isEcotrackCompany(companyCode)) {
      // EcoTrack (Packers): full surface. Note that update works AFTER
      // validation too — confirmed live 2026-04-25, contradicting earlier docs.
      return { canUpdate: true, canCancel: true, canRemark: true, canTrack: true };
    }
    if (companyCode === "noest") {
      return { canUpdate: true, canCancel: true, canRemark: true, canTrack: true };
    }
    if (companyCode === "yalidine") {
      // Yalidine has no remarks API.
      return { canUpdate: true, canCancel: true, canRemark: false, canTrack: true };
    }
    if (companyCode === "zr_express") {
      // ZR Express has no remarks API and the cancel endpoint returns HTTP 405,
      // so the backend can't honour cancel — hide the button entirely until
      // ZR fixes the endpoint (tracked in ALL_PROVIDERS_TEST_SUMMARY.md).
      return { canUpdate: true, canCancel: false, canRemark: false, canTrack: true };
    }
    return { canUpdate: false, canCancel: false, canRemark: false, canTrack: false };
  })();

  // ── Status-window restrictions ────────────────────────────────────────────
  // CANCEL — every supporting provider locks once the parcel moves past its
  // "ready to ship" state.
  //   noest / ecotrack: manual-validate. Our "dispatched" status = before validate.
  //   yalidine:         auto-validate. The carrier's editable window
  //                     ("En préparation") survives into our "out_for_delivery"
  //                     state because dispatch jumps the order straight there.
  //                     The carrier 4xx surfaces via toast if the window has closed.
  //   zr_express:       caps.canCancel is false (HTTP 405 from carrier), so the
  //                     branch below never runs for it.
  const canCancelAtCarrier = (() => {
    if (!isDispatched || !caps.canCancel) return false;
    if (companyCode === "yalidine") return ["dispatched", "out_for_delivery"].includes(status);
    return status === "dispatched";
  })();

  // UPDATE — provider-specific window.
  //   ecotrack / zr_express: carrier accepts updates in any non-terminal state.
  //   yalidine:              "En préparation" window only — covers our
  //                          "dispatched" + "out_for_delivery" states.
  //   noest:                 only before validation (our "dispatched" state).
  const canUpdateAtCarrier = (() => {
    if (!isDispatched || !caps.canUpdate) return false;
    if (isEcotrackCompany(companyCode) || companyCode === "zr_express") {
      return !["delivered", "returned", "cancelled"].includes(status);
    }
    if (companyCode === "yalidine") return ["dispatched", "out_for_delivery"].includes(status);
    return status === "dispatched";
  })();

  // Remarks + tracking: simple capability check. No status-window restriction —
  // the carriers accept these at any point in the lifecycle.
  const canAddRemark = isDispatched && caps.canRemark;
  const canTrackLive = isDispatched && caps.canTrack;

  // ── Edit Shipment field support ──────────────────────────────────────────
  // Mirrors what each provider's adapter actually forwards in updateShipment.
  // Source of truth:
  //   ecotrack: provider sends customerName/phone/phone2/address/commune/wilayaId/amount/weight/fragile/remarks
  //   noest:    provider sends customerName/phone/phone2/address/commune/wilayaId/amount/weight/fragile/remarks
  //   yalidine: provider sends customerName/phone/address/commune/amount/weight (no phone2/fragile/remarks; wilayaId not supported on update)
  //   zr_express: provider sends customerName/phone/address/amount only (no commune/wilayaId/phone2/weight/fragile/remarks)
  const updateFieldSupport = (() => {
    if (isEcotrackCompany(companyCode) || companyCode === "noest") {
      return { name: true, phone: true, phone2: true, address: true, amount: true, weight: true, fragile: true, remarks: true };
    }
    if (companyCode === "yalidine") {
      return { name: true, phone: true, phone2: false, address: true, amount: true, weight: true, fragile: false, remarks: false };
    }
    if (companyCode === "zr_express") {
      return { name: true, phone: true, phone2: false, address: true, amount: true, weight: false, fragile: false, remarks: false };
    }
    return { name: false, phone: false, phone2: false, address: false, amount: false, weight: false, fragile: false, remarks: false };
  })();

  function handleLoadTracking() {
    startTrackingTransition(async () => {
      try {
        const events = await getShipmentTracking(initialOrder.id);
        setTrackingEvents(events);
        setShowTracking(true);
        if (events.length === 0) toast.info(t.detail?.tracking_refreshed ?? "Tracking refreshed — no events yet");
        else toast.success(t.detail?.tracking_refreshed ?? "Tracking refreshed");
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.tracking_not_supported ?? "Tracking not available") });
      }
    });
  }

  function handleSubmitRemark() {
    if (!remarkContent.trim()) return;
    startRemarkTransition(async () => {
      try {
        await addShipmentRemark(initialOrder.id, remarkContent.trim());
        toast.success(t.detail?.remark_success ?? "Note sent");
        setRemarkContent("");
        setShowRemarkForm(false);
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.remark_error ?? "Failed to send note") });
      }
    });
  }

  function handleUpdateShipment() {
    startUpdateTransition(async () => {
      try {
        const parsedAmount = parseFloat(updateAmount);
        const newAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;
        const parsedWeight = parseFloat(updateWeight);
        const newWeight = !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined;

        // Only forward fields the selected provider's updateShipment adapter consumes.
        // Sending extras for yalidine/zr is harmless but misleading in API logs.
        await updateShipment(initialOrder.id, {
          customerName: updateFieldSupport.name && updateName ? updateName : undefined,
          phone:        updateFieldSupport.phone && updatePhone ? updatePhone : undefined,
          phone2:       updateFieldSupport.phone2 && updatePhone2 ? updatePhone2 : undefined,
          address:      updateFieldSupport.address && updateAddress ? updateAddress : undefined,
          amount:       updateFieldSupport.amount ? newAmount : undefined,
          weight:       updateFieldSupport.weight ? newWeight : undefined,
          fragile:      updateFieldSupport.fragile ? updateFragile : undefined,
          remarks:      updateFieldSupport.remarks && updateRemarks ? updateRemarks : undefined,
        });

        // Reflect changes immediately in the UI — DB was also synced on the server side.
        if (updateFieldSupport.name && updateName.trim()) setDisplayName(updateName.trim());
        if (updateFieldSupport.phone && updatePhone.trim()) setDisplayPhone(updatePhone.trim());
        if (updateFieldSupport.amount && newAmount !== undefined) setDisplayPrice(newAmount);
        if (updateFieldSupport.address && updateAddress.trim()) setDisplayAddress(updateAddress.trim());
        toast.success(t.detail?.update_shipment_success ?? "Shipment updated");
        setShowUpdateForm(false);
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.update_shipment_error ?? "Failed to update shipment") });
      }
    });
  }

  async function handleCancelAtCarrier() {
    const ok = await confirmDialog({
      title: t.detail?.cancel_shipment_confirm ?? "Cancel this shipment at the carrier? This may not be reversible.",
      variant: "destructive",
      confirmLabel: t.detail?.cancel_shipment ?? "Cancel Shipment",
    });
    if (!ok) return;
    startCancelTransition(async () => {
      try {
        await cancelShipment(initialOrder.id);
        setTrackingNumber(null);
        setStatus("ready");
        toast.success(t.detail?.cancel_shipment_success ?? "Shipment cancelled — order reset to ready");
      } catch (err) {
        setErrorState({ isOpen: true, message: err instanceof Error ? err.message : (t.detail?.cancel_shipment_error ?? "Failed to cancel shipment") });
      }
    });
  }

  function formatActivityLabel(activity: string): string {
    // EcoTrack vocabulary — snake_case keys returned by /api/v1/get/tracking/info.
    const map: Record<string, string> = {
      notification_on_order:                t.detail?.tracking_notification ?? "Remark added",
      order_information_received_by_carrier: t.detail?.tracking_registered ?? "Order registered at carrier",
      picked:               t.detail?.tracking_picked ?? "Picked up",
      accepted_by_carrier:  t.detail?.tracking_accepted ?? "Accepted at sorting hub",
      dispatched_to_driver: t.detail?.tracking_to_driver ?? "Assigned to driver",
      attempt_delivery:     t.detail?.tracking_attempt ?? "Delivery attempt",
      return_asked:         t.detail?.tracking_return_asked ?? "Return initiated",
      return_in_transit:    t.detail?.tracking_return_transit ?? "Return in transit",
      Return_received:      t.detail?.tracking_return_received ?? "Return received",
      livred:               t.detail?.tracking_delivered ?? "Delivered",
      encaissed:            t.detail?.tracking_encaissed ?? "Payment collected",
      payed:                t.detail?.tracking_payed ?? "Paid out",
    };
    if (map[activity]) return map[activity];
    if (!activity) return "";
    // Yalidine returns space-separated French phrases (e.g. "En préparation") — keep verbatim.
    if (/\s/.test(activity)) return activity;
    // ZR Express returns camelCase / PascalCase state names — split on uppercase.
    if (/[a-z][A-Z]/.test(activity)) {
      return activity
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
    }
    // EcoTrack snake_case fallback — title-case each word.
    return activity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Whether to show the Shipment Actions panel
  const hasAnyShipmentAction = isDispatched && (
    canValidateShipment || !!labelUrl || canTrackLive || canAddRemark || canUpdateAtCarrier || canCancelAtCarrier
  );

  return (
    <div className="max-w-5xl mx-auto pb-48 md:pb-12 animate-fade-in">
      {/* Top nav row */}
      <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t.detail?.back_to_orders ?? "Orders"}</span>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} label={t.status[status] ?? status} className="py-1 px-3 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm" />
          {(status === "new" || status === "preparing") && (
            <Button
              variant="outline"
              onClick={handleDeleteOrder}
              disabled={isPending}
              className="h-8 px-3 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 hidden sm:flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              {t.detail.cancel_order}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">

          {/* Hero Card */}
          <div className="group relative glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-premium">
            <div className="absolute top-[-10%] start-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[80px] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 duration-700" />
            <div className="relative z-10 p-5 sm:p-7">
              {/* Order number + type */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight font-display leading-none">{initialOrder.orderNumber}</h1>
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1">
                    {initialOrder.orderType === "online" ? t.type.online : t.type.offline}
                    {isCompanyMethod && company && (
                      <span className="ms-2 text-primary/60">· {company.name}</span>
                    )}
                  </p>
                </div>
                {trackingNumber && (
                  <span className="hidden sm:inline-block font-mono text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg shrink-0">
                    {trackingNumber}
                  </span>
                )}
              </div>

              {/* Customer + Location row */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/10 pt-5">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                    <User className="w-3 h-3 opacity-60" />
                    {t.detail?.customer ?? "Customer"}
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                  <p className="text-[11px] font-bold text-muted-foreground/60">{displayPhone}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                    <MapPin className="w-3 h-3 opacity-60" />
                    {t.detail?.destination ?? "Destination"}
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">{initialOrder.wilaya}</p>
                  <p className="text-[11px] font-bold text-muted-foreground/60 truncate">{initialOrder.commune || "—"}</p>
                </div>
              </div>

              {/* Tracking chip on mobile */}
              {trackingNumber && (
                <div className="mt-4 sm:hidden">
                  <span className="font-mono text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                    {trackingNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          <Section title={t.form.products_section} icon={<ShoppingBag size={16} />}>
            <div className="divide-y divide-border/5">
              {initialOrder.products?.map((p) => {
                const isFreeReward = p.pricePerUnit === 0 && p.lineTotal === 0;
                return (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-3.5 group/item">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[13px] text-foreground tracking-tight truncate group-hover/item:text-primary transition-colors">
                          {p.productName}
                        </p>
                        {isFreeReward && (
                          <span className="inline-flex items-center gap-1 text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide shrink-0">
                            🎁 مجاني
                          </span>
                        )}
                      </div>
                      {p.variantLabel && (
                        <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-tight mt-0.5">
                          {p.variantLabel}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-end">
                      <p className={cn("text-sm font-black tabular-nums", isFreeReward ? "text-emerald-600" : "text-foreground")}>
                        {isFreeReward ? "—" : formatPrice(p.lineTotal, common.currency.symbol)}
                      </p>
                      <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-tighter mt-0.5">
                        {p.quantity} × {isFreeReward ? "مجاني" : formatPrice(p.pricePerUnit, common.currency.symbol)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-5 pt-5 border-t border-border/10 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-muted-foreground/60">{t.detail?.subtotal ?? "Subtotal"}</span>
                <span className="font-black text-foreground/70 tabular-nums">{formatPrice(displayPrice - initialOrder.deliveryFee, common.currency.symbol)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-muted-foreground/60">{t.detail?.delivery_fee ?? "Delivery"}</span>
                {initialOrder.deliveryFee === 0 ? (
                  <span className="text-[0.65rem] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">🚚 مجاني</span>
                ) : (
                  <span className="font-black text-foreground/70 tabular-nums">{formatPrice(initialOrder.deliveryFee, common.currency.symbol)}</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/10">
                <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">{t.detail?.total_price ?? "Total"}</span>
                <span className="text-2xl sm:text-3xl font-black text-primary tabular-nums tracking-tight font-display">
                  {formatPrice(displayPrice, common.currency.symbol)}
                </span>
              </div>
            </div>
          </Section>

          {/* Delivery Info + Notes — compact row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <Section title={t.detail.delivery_info} icon={<Truck size={16} />}>
              <div className="space-y-3">
                <InfoRow label={t.detail.delivery_type} value={initialOrder.deliveryType === "home" ? t.detail.home_delivery : t.detail.stop_desk} />
                {displayAddress && <InfoRow label={t.detail.address} value={displayAddress} />}
                {(initialOrder.deliveryAttempts ?? 0) > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">{t.detail?.delivery_attempts ?? "Attempts"}</p>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm font-black">
                      {initialOrder.deliveryAttempts}
                    </span>
                  </div>
                )}
                {initialOrder.trackingUrl && (
                  <a href={initialOrder.trackingUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-black text-primary hover:text-primary/80 transition-colors">
                    {t.detail?.track_on_provider ?? "Track on provider"}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </Section>
            <Section title={t.detail.notes} icon={<Info size={16} />}>
              {initialOrder.notes ? (
                <p className="text-xs font-bold text-foreground leading-relaxed">{initialOrder.notes}</p>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 opacity-25">
                  <Info size={20} className="mb-1.5" />
                  <p className="text-[9px] font-black uppercase tracking-widest">{t.detail?.no_notes ?? "No notes"}</p>
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6 lg:sticky lg:top-6">

          {/* Status Timeline */}
          <Section
            title={t.detail.status_timeline}
            icon={<Clock size={16} />}
            extra={
              <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-tighter py-0 h-4 border-none bg-primary/5 text-primary/70">
                {isCompanyMethod ? t.flow?.company_label ?? "Via company" : t.flow?.driver_label ?? "Manual"}
              </Badge>
            }
          >
            <div className="relative">
              <div className="absolute top-2.5 bottom-0 start-[11.5px] w-px bg-border/10" />
              <div className="space-y-0">
                {STATUS_FLOW.map((s, i) => {
                  const historyItem = (initialOrder.statusHistory ?? []).find((h) => h.status === s);
                  const isDone = i < virtualCurrentIndex || (i === virtualCurrentIndex && !!historyItem);
                  const isCurrent = i === virtualCurrentIndex && !isUnreachable;
                  return (
                    <div key={s} className="flex items-start gap-3.5 relative pb-5">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 z-10 transition-all duration-500 bg-card",
                        isDone ? "bg-primary border-primary shadow-lg shadow-primary/20"
                          : isCurrent ? "border-primary animate-pulse"
                            : "border-border/40"
                      )}>
                        {isDone && <Check size={11} className="text-primary-foreground" />}
                        {isCurrent && !isDone && <div className="w-1.5 h-1.5 rounded-sm bg-primary" />}
                      </div>
                      <div className="min-w-0 pt-0.5 flex-1">
                        <p className={cn(
                          "text-[12px] font-black transition-colors uppercase tracking-tight",
                          isDone || isCurrent ? "text-foreground" : "text-muted-foreground/30"
                        )}>
                          {t.status[s]}
                        </p>
                        {historyItem && (
                          <p className="text-[10px] font-bold text-muted-foreground/50 mt-0.5 flex items-center gap-1 flex-wrap">
                            <span className="tabular-nums">{formatDateTime(historyItem.timestamp)}</span>
                            {historyItem.by?.startsWith("webhook:") ? (
                              <span className="inline-flex items-center gap-0.5 text-primary/60 font-black">
                                <Zap size={9} />
                                {historyItem.by === "webhook:zr_express" ? "ZR Express"
                                  : historyItem.by === "webhook:yalidine" ? "Yalidine"
                                  : (t.detail?.webhook_auto ?? "Auto")}
                              </span>
                            ) : (
                              historyItem.byName && <span>· {historyItem.byName.split(" ")[0]}</span>
                            )}
                          </p>
                        )}
                        {s === "dispatched" && trackingNumber && (
                          <p className="font-mono text-[10px] text-emerald-600 font-black tracking-tight mt-0.5">{trackingNumber}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* Quick Actions */}
          <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-md">
            <div className="p-5 sm:p-7 space-y-4">

              {/* Unreachable banner */}
              {isUnreachable && (
                <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <PhoneMissed size={14} className="text-amber-600 shrink-0" />
                    <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t.status.unreachable}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={handleRetryCall} disabled={isPending}
                      className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white border-0">
                      <Phone size={12} className="me-1.5" />
                      {isPending ? "..." : t.next_status.unreachable}
                    </Button>
                    <Button variant="outline" onClick={() => handleAdvanceViaStatus("cancelled")} disabled={isPending}
                      className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-red-200 text-red-500 hover:bg-red-50">
                      {t.status.cancelled}
                    </Button>
                  </div>
                </div>
              )}

              {/* Primary advance button */}
              {canAdvanceStatus && (
                <Button onClick={handleAdvanceStatus} disabled={isPending}
                  className="w-full h-12 rounded-xl sm:rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95">
                  {isPending ? "..." : t.next_status[status as keyof typeof t.next_status]}
                </Button>
              )}

              {/* Mark Unreachable */}
              {canMarkUnreachable && (
                <Button variant="outline" onClick={handleMarkUnreachable} disabled={isPending}
                  className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center justify-center gap-2">
                  <PhoneMissed size={12} />
                  {t.next_status.mark_unreachable}
                </Button>
              )}

              {/* ── Delivery Assignment ── */}
              <div className="space-y-2.5 pt-1">
                <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest ms-0.5">
                  {t.detail?.delivery_assignment ?? "Delivery"}
                </p>

                {isDispatched ? (
                  /* Company info chip — actions are in Shipment Actions below */
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl p-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-foreground truncate">
                        {company?.name ?? t.detail?.partner_company ?? "Partner Company"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                        {initialOrder.deliveryType === "home" ? t.detail?.home_delivery : t.detail?.stop_desk}
                      </p>
                    </div>
                    <StatusBadge status={status} label={t.status[status] ?? status}
                      className="text-[8px] font-black uppercase tracking-tighter py-0.5 px-2 rounded-full border shrink-0" />
                  </div>
                ) : isDriverAssigned ? (
                  <div className="space-y-2">
                    <div className={cn(
                      "flex items-center gap-3 rounded-2xl p-3.5 border transition-all",
                      isOutOrLater ? "bg-muted/20 border-border/40" : "bg-primary/5 border-primary/10"
                    )}>
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isOutOrLater ? "bg-muted/40" : "bg-primary/10")}>
                        <Truck size={16} className={isOutOrLater ? "text-muted-foreground/40" : "text-primary"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-foreground truncate">
                          {driver ? `${driver.firstName} ${driver.lastName}` : t.detail?.assigned_driver ?? "Assigned Driver"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                          {t.detail?.manual_delivery ?? "Manual Delivery"}
                        </p>
                      </div>
                      {isOutOrLater && <Lock size={13} className="text-muted-foreground/30" />}
                    </div>
                    {canAssignDriver && (
                      <Button variant="outline" onClick={() => setAssignOpen(true)}
                        className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40">
                        {t.detail?.reassign_driver ?? "Change Driver"}
                      </Button>
                    )}
                  </div>
                ) : !isComplete ? (
                  <div className="space-y-2">
                    {canAssignDriver && (
                      <Button variant="outline" onClick={() => setAssignOpen(true)}
                        className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center gap-2">
                        <Truck size={13} className="opacity-50" />
                        {t.detail?.assign_to_driver ?? "Assign Driver"}
                      </Button>
                    )}
                    {canDispatch && (
                      <Button variant="outline" onClick={() => setDispatchOpen(true)}
                        className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center gap-2">
                        <Building2 size={13} className="opacity-50" />
                        {t.detail?.dispatch_to ?? "Dispatch to Company"}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Delete — mobile only, shown inside card */}
              {(status === "new" || status === "preparing") && (
                <Button variant="outline" onClick={handleDeleteOrder} disabled={isPending}
                  className="w-full h-9 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 sm:hidden flex items-center justify-center gap-1.5">
                  <Trash2 size={12} />
                  {t.detail.cancel_order}
                </Button>
              )}
            </div>
          </div>

          {/* ── Shipment Actions ─────────────────────────────────────── */}
          {hasAnyShipmentAction && (
            <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-md">
              <div className="p-5 sm:p-7 space-y-3">
                <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                  {t.detail?.shipment_actions ?? "Shipment Actions"}
                </p>

                {/* Validate — most prominent, sits first */}
                {canValidateShipment && (
                  <Button onClick={handleValidateShipment} disabled={isPending}
                    className="w-full h-11 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 active:scale-95 transition-all">
                    <Zap size={14} />
                    {isPending ? "..." : (t.detail?.validate_shipment_btn ?? "Validate Shipment")}
                  </Button>
                )}

                {/* Print Label */}
                {labelUrl && (
                  <a href={`/api/orders/${initialOrder.id}/label`} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline"
                      className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all">
                      <FileDown size={13} />
                      {t.detail?.print_label ?? "Print Label"}
                    </Button>
                  </a>
                )}

                {/* Track Live */}
                {canTrackLive && (
                  <div className="space-y-2">
                    <Button variant="outline" onClick={handleLoadTracking} disabled={loadingTracking}
                      className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center gap-2 w-full">
                      <RefreshCw size={12} className={loadingTracking ? "animate-spin" : ""} />
                      {loadingTracking ? "..." : (t.detail?.track_live ?? "Refresh Tracking")}
                      {trackingEvents !== null && (
                        <span className="ms-auto" onClick={(e) => { e.stopPropagation(); setShowTracking((v) => !v); }}>
                          {showTracking ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      )}
                    </Button>
                    {trackingEvents !== null && showTracking && (
                      <div className="space-y-1.5 ps-1">
                        {trackingEvents.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground/50 font-semibold px-3">—</p>
                        ) : (
                          trackingEvents.map((ev, i) => (
                            <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-xl bg-muted/30">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-foreground">{formatActivityLabel(ev.activity)}</p>
                                {ev.description && <p className="text-[10px] text-muted-foreground/60 font-semibold mt-0.5">{ev.description}</p>}
                                {ev.date && <p className="text-[10px] text-muted-foreground/40 font-semibold mt-0.5 tabular-nums">{ev.date}</p>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Add Remark */}
                {canAddRemark && (
                  <div className="space-y-2">
                    {!showRemarkForm ? (
                      <Button variant="outline" onClick={() => setShowRemarkForm(true)}
                        className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center gap-2 w-full">
                        <MessageSquare size={12} />
                        {t.detail?.add_remark ?? "Add Note"}
                      </Button>
                    ) : (
                      <div className="space-y-2 p-3.5 rounded-xl border border-border/30 bg-muted/10">
                        <Input value={remarkContent} onChange={(e) => setRemarkContent(e.target.value)}
                          placeholder={t.detail?.remark_placeholder ?? "Note visible to the delivery company..."}
                          className="h-9 text-sm" maxLength={255} />
                        <div className="flex gap-2">
                          <Button onClick={handleSubmitRemark} disabled={submittingRemark || !remarkContent.trim()}
                            className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-xl">
                            {submittingRemark ? "..." : (t.detail?.add_remark ?? "Send")}
                          </Button>
                          <Button variant="outline" onClick={() => { setShowRemarkForm(false); setRemarkContent(""); }}
                            className="h-9 px-3 rounded-xl">
                            <X size={13} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Shipment — before validation only */}
                {canUpdateAtCarrier && (
                  <div className="space-y-2">
                    {!showUpdateForm ? (
                      <Button variant="outline" onClick={() => setShowUpdateForm(true)}
                        className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/40 flex items-center gap-2 w-full">
                        <Pencil size={12} />
                        {t.detail?.update_shipment ?? "Edit Shipment"}
                      </Button>
                    ) : (
                      <div className="space-y-3 p-3.5 rounded-xl border border-border/30 bg-muted/10">
                        <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{t.detail?.update_shipment ?? "Edit Shipment"}</p>
                        {updateFieldSupport.name && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.update_shipment_name ?? "Name"}</label>
                            <Input value={updateName} onChange={(e) => setUpdateName(e.target.value)} className="h-9 text-sm" />
                          </div>
                        )}
                        {updateFieldSupport.phone && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.update_shipment_phone ?? "Phone"}</label>
                            <Input value={updatePhone} onChange={(e) => setUpdatePhone(e.target.value)} className="h-9 text-sm font-mono" />
                          </div>
                        )}
                        {updateFieldSupport.phone2 && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.update_shipment_phone2 ?? "Phone 2"}</label>
                            <Input value={updatePhone2} onChange={(e) => setUpdatePhone2(e.target.value)} className="h-9 text-sm font-mono" />
                          </div>
                        )}
                        {updateFieldSupport.address && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.address ?? "Address"}</label>
                            <Input value={updateAddress} onChange={(e) => setUpdateAddress(e.target.value)} className="h-9 text-sm" />
                          </div>
                        )}
                        {updateFieldSupport.amount && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.update_shipment_amount ?? "Amount"}</label>
                            <Input type="number" value={updateAmount} onChange={(e) => setUpdateAmount(e.target.value)} className="h-9 text-sm" />
                          </div>
                        )}
                        {(updateFieldSupport.weight || updateFieldSupport.fragile) && (
                          <div className="flex items-end gap-3">
                            {updateFieldSupport.weight && (
                              <div className="flex-1 space-y-0.5">
                                <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.weight ?? "Weight (kg)"}</label>
                                <Input type="number" min="0" step="0.1" value={updateWeight} onChange={(e) => setUpdateWeight(e.target.value)} className="h-9 text-sm" placeholder="0.5" />
                              </div>
                            )}
                            {updateFieldSupport.fragile && (
                              <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                                <Checkbox checked={updateFragile} onCheckedChange={(v) => setUpdateFragile(!!v)} />
                                <span className="text-sm font-bold">{t.detail?.fragile ?? "Fragile"}</span>
                              </label>
                            )}
                          </div>
                        )}
                        {updateFieldSupport.remarks && (
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide">{t.detail?.remarks ?? "Remarks"}</label>
                            <Input value={updateRemarks} onChange={(e) => setUpdateRemarks(e.target.value)} className="h-9 text-sm" maxLength={255} />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={handleUpdateShipment} disabled={updatingShipment}
                            className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-xl">
                            {updatingShipment ? "..." : common.confirm}
                          </Button>
                          <Button variant="outline" onClick={() => setShowUpdateForm(false)} className="h-9 px-3 rounded-xl">
                            <X size={13} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel at Carrier — danger, before validation only */}
                {canCancelAtCarrier && (
                  <Button variant="outline" onClick={handleCancelAtCarrier} disabled={cancellingShipment}
                    className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-rose-300/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 w-full">
                    <XCircle size={12} />
                    {cancellingShipment ? "..." : (t.detail?.cancel_shipment ?? "Cancel Shipment")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Mobile Action Bar ──────────────────────────────────── */}
      <div className="fixed bottom-[88px] inset-x-3 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2 shadow-2xl flex items-center gap-2">
          {/* Back */}
          <Button variant="outline" onClick={() => router.push("/orders")}
            className="flex-none w-12 h-12 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground active:scale-90 shadow-sm">
            <ArrowLeft size={18} />
          </Button>

          {/* Primary action */}
          {isUnreachable ? (
            <Button onClick={handleRetryCall} disabled={isPending}
              className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white active:scale-95">
              <Phone size={13} className="me-1.5" />
              {isPending ? "..." : t.next_status.unreachable}
            </Button>
          ) : canValidateShipment ? (
            <Button onClick={handleValidateShipment} disabled={isPending}
              className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 active:scale-95">
              <Zap size={13} className="me-1.5" />
              {isPending ? "..." : (t.detail?.validate_shipment_btn ?? "Validate")}
            </Button>
          ) : canAdvanceStatus ? (
            <Button onClick={handleAdvanceStatus} disabled={isPending}
              className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95">
              {isPending ? "..." : t.next_status[status as keyof typeof t.next_status]}
            </Button>
          ) : (
            <div className="flex-1 h-12 rounded-2xl bg-muted/50 flex items-center justify-center px-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t.status[status]}</span>
            </div>
          )}

          {/* Print label icon button — only when label available */}
          {labelUrl && (
            <a href={`/api/orders/${initialOrder.id}/label`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"
                className="flex-none w-12 h-12 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground active:scale-90 shadow-sm">
                <FileDown size={18} />
              </Button>
            </a>
          )}
        </div>
      </div>

      {assignOpen && (
        <AssignDriverDialog
          order={initialOrder}
          drivers={drivers}
          onClose={() => setAssignOpen(false)}
          onAssigned={() => { router.refresh(); setAssignOpen(false); }}
        />
      )}

      {dispatchOpen && (
        <DispatchCompanyDialog
          order={initialOrder}
          companies={companies}
          onClose={() => setDispatchOpen(false)}
          onDispatched={(tn, lu) => {
            setTrackingNumber(tn);
            setLabelUrl(lu ?? null);
            setDeliveryMethod("company");
            setDispatchOpen(false);
          }}
        />
      )}

      {ConfirmDialog}

      <ErrorModal
        isOpen={errorState.isOpen}
        onClose={() => setErrorState({ isOpen: false, message: "" })}
        message={errorState.message}
        locale={locale}
        errorCode={errorState.code}
      />
    </div>
  );
}

function Section({ title, children, icon, extra }: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm h-full">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-7 sm:py-4 border-b border-border/10 bg-muted/5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
              <div className="text-primary">{icon}</div>
            </div>
          )}
          <h2 className="text-[13px] sm:text-sm font-black text-foreground tracking-tight font-display uppercase">{title}</h2>
        </div>
        {extra}
      </div>
      <div className="p-5 sm:p-7">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-[12px] font-bold text-foreground leading-snug">{value}</p>
    </div>
  );
}
