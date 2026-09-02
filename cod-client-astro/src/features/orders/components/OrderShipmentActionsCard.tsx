import { useState } from "react";
import {
  Check,
  Download,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { canScope } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { listStopDesks } from "@/features/orders/api";
import type {
  DeliveryCompany,
  Driver,
  OrderDetail,
  OrderStatus,
  StopDesk,
} from "@/features/orders/types";
import type {
  shipmentCapabilities,
  dispatchFieldSupport,
  shipmentUpdateFieldSupport,
  DetailStatusAction,
} from "@/features/orders/model";

export function ActivityLabel({ value }: { value: string }) {
  const t = useT("orders");
  const labels: Record<string, string> = {
    notification_on_order: t("detail.tracking_notification"),
    order_information_received_by_carrier: t("detail.tracking_registered"),
    picked: t("detail.tracking_picked"),
    accepted_by_carrier: t("detail.tracking_accepted"),
    dispatched_to_driver: t("detail.tracking_to_driver"),
    attempt_delivery: t("detail.tracking_attempt"),
    return_asked: t("detail.tracking_return_asked"),
    return_in_transit: t("detail.tracking_return_transit"),
    Return_received: t("detail.tracking_return_received"),
    livred: t("detail.tracking_delivered"),
    encaissed: t("detail.tracking_encaissed"),
    payed: t("detail.tracking_payed"),
  };
  if (labels[value]) return <>{labels[value]}</>;
  if (/\s/.test(value)) return <>{value}</>;
  return <>{value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}</>;
}

export function statusActionLabel(
  t: (key: string) => string,
  current: OrderStatus,
  next: OrderStatus,
): string {
  if (next === "unreachable") return t("next_status.mark_unreachable");
  if (next === "cancelled") return t("status.cancelled");
  if (current === "new" && next === "confirmed") return t("next_status.new");
  if (current === "unreachable" && next === "confirmed")
    return t("next_status.unreachable");
  const key = `next_status.${current}`;
  const label = t(key);
  return label === key ? t(`status.${next}`) : label;
}

interface OrderShipmentActionsCardProps {
  order: OrderDetail;
  effectiveStatus: OrderStatus;
  explicitStatusActions: DetailStatusAction[];
  canAssign: boolean;
  canDispatch: boolean;
  dispatched: boolean;
  caps: ReturnType<typeof shipmentCapabilities>;
  dispatchFields: ReturnType<typeof dispatchFieldSupport>;
  updateFields: ReturnType<typeof shipmentUpdateFieldSupport>;
  drivers: Driver[];
  companies: DeliveryCompany[];
  busy: boolean;
  identity: Parameters<typeof canScope>[0];
  initialDriverId: string;
  initialCompanyId: string;
  onChangeOrderStatus: (next: OrderStatus) => void | Promise<void>;
  onAssignDriver: (driverId: string) => void | Promise<void>;
  onDispatchOrder: (params: {
    companyId: string;
    stationCode?: string;
    remarks?: string;
    weight?: number;
    fragile?: boolean;
  }) => void | Promise<void>;
  onValidateShipment: () => void | Promise<void>;
  onDownloadLabel: () => void | Promise<void>;
  onCancelShipment: () => void | Promise<void>;
  onUpdateShipment: (params: {
    customerName?: string;
    phone?: string;
    phone2?: string;
    address?: string;
    amount?: number;
    weight?: number;
    fragile?: boolean;
    remarks?: string;
  }) => void | Promise<void>;
  onAddRemark: (remark: string) => Promise<void>;
  onFetchTracking: () => Promise<Array<Record<string, unknown>>>;
}

export function OrderShipmentActionsCard({
  order,
  effectiveStatus,
  explicitStatusActions,
  canAssign,
  canDispatch,
  dispatched,
  caps,
  dispatchFields,
  updateFields,
  drivers,
  companies,
  busy,
  identity,
  initialDriverId,
  initialCompanyId,
  onChangeOrderStatus,
  onAssignDriver,
  onDispatchOrder,
  onValidateShipment,
  onDownloadLabel,
  onCancelShipment,
  onUpdateShipment,
  onAddRemark,
  onFetchTracking,
}: OrderShipmentActionsCardProps) {
  const t = useT("orders");

  const [driverId, setDriverId] = useState(initialDriverId);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [stationCode, setStationCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [weight, setWeight] = useState("");
  const [fragile, setFragile] = useState(false);
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);

  const [tracking, setTracking] = useState<Array<Record<string, unknown>> | null>(null);
  const [remark, setRemark] = useState("");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateName, setUpdateName] = useState(order.customerName);
  const [updatePhone, setUpdatePhone] = useState(order.phone);
  const [updatePhone2, setUpdatePhone2] = useState("");
  const [updateAddress, setUpdateAddress] = useState(order.address ?? "");
  const [updateAmount, setUpdateAmount] = useState(String(order.price ?? ""));
  const [updateWeight, setUpdateWeight] = useState(
    order.weight != null ? String(order.weight) : "",
  );
  const [updateFragile, setUpdateFragile] = useState(order.isFragile ?? false);
  const [updateRemarks, setUpdateRemarks] = useState(order.notes ?? "");

  return (
    <Card title={t("detail.shipment_actions")}>
      <div className="space-y-3">
        {explicitStatusActions.length > 0 &&
          canScope(identity, "orders:update") && (
            <div className="space-y-2">
              {explicitStatusActions.map(({ status: next, emphasis }) => (
                <button
                  type="button"
                  key={next}
                  disabled={busy}
                  onClick={() => void onChangeOrderStatus(next)}
                  className={`flex min-h-10 w-full items-center justify-between rounded-md border px-3 text-start text-sm font-semibold disabled:opacity-50 ${
                    emphasis === "primary"
                      ? "border-primary bg-primary text-primary-foreground"
                      : emphasis === "danger"
                        ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                        : "border-input hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  <span>
                    {statusActionLabel(
                      t,
                      effectiveStatus,
                      next,
                    )}
                  </span>
                  <Send size={15} />
                </button>
              ))}
            </div>
          )}

        {canAssign && (
          <Field label={t("detail.assign_to_driver")}>
            <div className="flex gap-2">
              <Select
                value={driverId}
                onChange={(event) =>
                  setDriverId(event.currentTarget.value)
                }
              >
                <option value="">{t("table.not_assigned")}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.firstName} {driver.lastName}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                disabled={!driverId || busy}
                onClick={() => void onAssignDriver(driverId)}
                className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                aria-label={t("assign_driver_dialog.assign")}
              >
                <Check size={16} />
              </button>
            </div>
          </Field>
        )}

        {canDispatch && (
          <div className="space-y-3 border-t border-border pt-3">
            <Field label={t("dispatch_dialog.select_company")}>
              <Select
                value={companyId}
                onChange={(event) => {
                  const val = event.currentTarget.value;
                  setCompanyId(val);
                  setStopDesks([]);
                  setStationCode("");
                  if (val && order.deliveryType === "stop_desk") {
                    void listStopDesks(val)
                      .then(setStopDesks)
                      .catch(() => setStopDesks([]));
                  }
                }}
              >
                <option value="">
                  {t("dispatch_dialog.select_company")}
                </option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            {order.deliveryType === "stop_desk" && companyId && (
              <Field label={t("dispatch_dialog.station_code_label")}>
                <>
                  {stopDesks.length > 0 && (
                    <Select
                      value={stationCode}
                      onChange={(event) =>
                        setStationCode(event.currentTarget.value)
                      }
                    >
                      <option value="">
                        {t("dispatch_dialog.station_picker_placeholder")}
                      </option>
                      {stopDesks.map((desk) => (
                        <option key={desk.code} value={desk.code}>
                          {desk.code} · {desk.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Input
                    value={stationCode}
                    onChange={(event) =>
                      setStationCode(event.currentTarget.value)
                    }
                    placeholder={t(
                      "dispatch_dialog.station_code_placeholder",
                    )}
                    className="mt-2 font-mono"
                  />
                </>
              </Field>
            )}
            {dispatchFields.remarks && (
              <Field label={t("dispatch_dialog.remarks_label")}>
                <Textarea
                  value={remarks}
                  onChange={(event) =>
                    setRemarks(event.currentTarget.value)
                  }
                  maxLength={500}
                />
              </Field>
            )}
            {(dispatchFields.weight || dispatchFields.fragile) && (
              <div className="flex items-end gap-4">
                {dispatchFields.weight && (
                  <Field label={t("detail.weight")}>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={weight}
                      onChange={(event) =>
                        setWeight(event.currentTarget.value)
                      }
                    />
                  </Field>
                )}
                {dispatchFields.fragile && (
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={fragile}
                      onChange={(event) =>
                        setFragile(event.currentTarget.checked)
                      }
                    />
                    {t("detail.fragile")}
                  </label>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={
                !companyId ||
                (order.deliveryType === "stop_desk" && !stationCode) ||
                busy
              }
              onClick={() =>
                void onDispatchOrder({
                  companyId,
                  stationCode: stationCode || undefined,
                  remarks: dispatchFields.remarks
                    ? remarks || undefined
                    : undefined,
                  weight:
                    dispatchFields.weight && Number(weight) > 0
                      ? Number(weight)
                      : undefined,
                  fragile: dispatchFields.fragile ? fragile : undefined,
                })
              }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Truck size={16} />
              {t("dispatch_dialog.dispatch")}
            </button>
          </div>
        )}

        {dispatched && canScope(identity, "delivery:dispatch") && (
          <div className="space-y-3 border-t border-border pt-3">
            {caps.canValidate && (
              <button
                type="button"
                onClick={() => void onValidateShipment()}
                disabled={busy || effectiveStatus !== "dispatched"}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary/10 text-sm font-semibold text-primary disabled:opacity-50"
              >
                <Check size={16} />
                {t("detail.validate_shipment_btn")}
              </button>
            )}
            {order.labelUrl && (
              <button
                type="button"
                onClick={() => void onDownloadLabel()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input text-sm font-semibold hover:bg-muted"
              >
                <Download size={16} />
                {t("detail.print_label")}
              </button>
            )}
            {caps.canTrack && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void onFetchTracking()
                      .then(setTracking)
                      .catch(() => undefined)
                  }
                  disabled={busy}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input text-sm font-semibold hover:bg-muted"
                >
                  <RefreshCw size={16} />
                  {t("detail.track_live")}
                </button>
                {tracking && (
                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-2">
                    {tracking.length === 0 && (
                      <p className="p-2 text-xs text-muted-foreground">
                        {t("detail.no_notes")}
                      </p>
                    )}
                    {tracking.map((event, index) => (
                      <div
                        key={index}
                        className="rounded-md bg-card p-2 text-xs"
                      >
                        <p className="font-semibold">
                          <ActivityLabel
                            value={String(
                              event.activity ?? event.status ?? "event",
                            )}
                          />
                        </p>
                        {event.description != null && (
                          <p className="mt-1 text-muted-foreground">
                            {String(event.description)}
                          </p>
                        )}
                        {event.date != null && (
                          <p className="mt-1 text-muted-foreground/70">
                            {String(event.date)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {caps.canCancel && (
              <button
                type="button"
                onClick={() => void onCancelShipment()}
                disabled={busy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <XCircle size={16} />
                {t("detail.cancel_shipment")}
              </button>
            )}
            {caps.canUpdate && (
              <>
                <button
                  type="button"
                  onClick={() => setUpdateOpen((open) => !open)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input text-sm font-semibold hover:bg-muted"
                >
                  <Pencil size={16} />
                  {t("detail.update_shipment")}
                </button>
                {updateOpen && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <Field label={t("detail.update_shipment_name")}>
                      <Input
                        value={updateName}
                        onChange={(event) =>
                          setUpdateName(event.currentTarget.value)
                        }
                      />
                    </Field>
                    <Field label={t("detail.update_shipment_phone")}>
                      <Input
                        value={updatePhone}
                        onChange={(event) =>
                          setUpdatePhone(event.currentTarget.value)
                        }
                        dir="ltr"
                      />
                    </Field>
                    {updateFields.phone2 && (
                      <Field label={t("detail.update_shipment_phone2")}>
                        <Input
                          value={updatePhone2}
                          onChange={(event) =>
                            setUpdatePhone2(event.currentTarget.value)
                          }
                          dir="ltr"
                        />
                      </Field>
                    )}
                    {updateFields.address && (
                      <Field label={t("detail.address")}>
                        <Input
                          value={updateAddress}
                          onChange={(event) =>
                            setUpdateAddress(event.currentTarget.value)
                          }
                        />
                      </Field>
                    )}
                    {updateFields.amount && (
                      <Field label={t("detail.update_shipment_amount")}>
                        <Input
                          type="number"
                          value={updateAmount}
                          onChange={(event) =>
                            setUpdateAmount(event.currentTarget.value)
                          }
                        />
                      </Field>
                    )}
                    {updateFields.weight && (
                      <Field label={t("detail.weight")}>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={updateWeight}
                          onChange={(event) =>
                            setUpdateWeight(event.currentTarget.value)
                          }
                        />
                      </Field>
                    )}
                    {updateFields.fragile && (
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={updateFragile}
                          onChange={(event) =>
                            setUpdateFragile(event.currentTarget.checked)
                          }
                        />
                        {t("detail.fragile")}
                      </label>
                    )}
                    {updateFields.remarks && (
                      <Field label={t("detail.remarks")}>
                        <Textarea
                          value={updateRemarks}
                          onChange={(event) =>
                            setUpdateRemarks(event.currentTarget.value)
                          }
                          maxLength={255}
                        />
                      </Field>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void onUpdateShipment({
                          customerName: updateFields.name
                            ? updateName || undefined
                            : undefined,
                          phone: updateFields.phone
                            ? updatePhone || undefined
                            : undefined,
                          phone2: updateFields.phone2
                            ? updatePhone2 || undefined
                            : undefined,
                          address: updateFields.address
                            ? updateAddress || undefined
                            : undefined,
                          amount:
                            updateFields.amount && Number(updateAmount) > 0
                              ? Number(updateAmount)
                              : undefined,
                          weight:
                            updateFields.weight && Number(updateWeight) > 0
                              ? Number(updateWeight)
                              : undefined,
                          fragile: updateFields.fragile
                            ? updateFragile
                            : undefined,
                          remarks: updateFields.remarks
                            ? updateRemarks || undefined
                            : undefined,
                        })
                      }
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Check size={16} />
                      {busy ? t("detail.updating") : t("form.save")}
                    </button>
                  </div>
                )}
              </>
            )}
            {caps.canRemark && (
              <div className="space-y-2">
                <Field label={t("detail.add_remark")}>
                  <Textarea
                    value={remark}
                    onChange={(event) =>
                      setRemark(event.currentTarget.value)
                    }
                    maxLength={255}
                    placeholder={t("detail.remark_placeholder")}
                  />
                  <button
                    type="button"
                    disabled={!remark.trim() || busy}
                    onClick={() => {
                      const text = remark;
                      setRemark("");
                      void onAddRemark(text);
                    }}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input text-sm font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <MessageSquare size={16} />
                    {t("detail.add_remark")}
                  </button>
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
