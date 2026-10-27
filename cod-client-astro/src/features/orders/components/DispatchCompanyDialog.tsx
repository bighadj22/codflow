import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  Search,
} from "lucide-react";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import {
  dispatchOrder,
  listStopDesks,
} from "@/features/orders/api";
import {
  dispatchFailureMessage,
  dispatchFieldSupport,
} from "@/features/orders/model";
import type {
  DeliveryCompany,
  StopDesk,
} from "@/features/orders/types";
import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { OrderForActions } from "@/features/orders/components/AssignDriverDialog";

export function DispatchCompanyDialog({
  order,
  companies,
  onClose,
  onChanged,
  onError,
}: {
  order: OrderForActions;
  companies: DeliveryCompany[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useT("orders");
  const [companyId, setCompanyId] = useState(order.companyId ?? "");
  const [desks, setDesks] = useState<StopDesk[]>([]);
  const [loadingDesks, setLoadingDesks] = useState(false);
  const [deskQuery, setDeskQuery] = useState("");
  const [stationCode, setStationCode] = useState("");
  // Effective delivery type: starts as the order's type; the merchant can
  // switch it here (Y2.1 engine override) — resolves the stop-desk dead end
  // when the carrier has no desk in the order's wilaya.
  const [deliveryType, setDeliveryType] = useState<"home" | "stop_desk">(
    order.deliveryType === "stop_desk" ? "stop_desk" : "home",
  );
  const [remarks, setRemarks] = useState("");
  const [weight, setWeight] = useState("");
  const [fragile, setFragile] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedCompany = companies.find((company) => company.id === companyId);
  const fields = dispatchFieldSupport(selectedCompany?.code ?? "");
  const isStopDesk = deliveryType === "stop_desk";
  const typeOverridden = deliveryType !== order.deliveryType;

  // Desks are scoped to the ORDER'S WILAYA (server-side filter) — desks in
  // other wilayas are never offered. Only fetched for stop-desk dispatches.
  useEffect(() => {
    if (!companyId || !isStopDesk || !order.wilayaId) {
      setDesks([]);
      return;
    }
    let alive = true;
    setLoadingDesks(true);
    listStopDesks(companyId, order.wilayaId)
      .then((rows) => {
        if (alive) setDesks(rows);
      })
      .catch(() => {
        if (alive) setDesks([]);
      })
      .finally(() => {
        if (alive) setLoadingDesks(false);
      });
    return () => {
      alive = false;
    };
  }, [companyId, isStopDesk, order.wilayaId]);

  // Search filters within the wilaya-scoped rows; no cross-wilaya fallback.
  const visibleDesks = useMemo(() => {
    const query = deskQuery.trim().toLocaleLowerCase();
    if (query) {
      return desks.filter((desk) =>
        `${desk.code} ${desk.name} ${desk.commune ?? ""}`
          .toLocaleLowerCase()
          .includes(query),
      );
    }
    return desks;
  }, [deskQuery, desks]);

  // Pre-select the desk serving the order's commune when desks arrive and
  // no explicit pick has been made yet.
  useEffect(() => {
    if (isStopDesk && desks.length > 0 && !stationCode && order.commune) {
      const match = desks.find(
        (desk) =>
          desk.commune?.toLocaleLowerCase() ===
          order.commune?.toLocaleLowerCase(),
      );
      if (match) setStationCode(match.code);
    }
    // stationCode intentionally not a dependency — pre-selection runs only
    // on desk loads, never on a manual clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desks, isStopDesk, order.commune]);

  async function submit() {
    if (!companyId || (isStopDesk && !stationCode.trim())) return;
    setBusy(true);
    let trackingNumber = "";
    try {
      const parsedWeight = Number(weight);
      const response = await dispatchOrder(order.id, {
        companyId,
        // The override is only sent when the merchant actually switched —
        // an untouched dialog never rewrites the order's delivery type.
        ...(typeOverridden ? { deliveryType } : {}),
        stationCode: isStopDesk ? stationCode.trim() || undefined : undefined,
        remarks: fields.remarks && remarks.trim() ? remarks.trim() : undefined,
        weight: fields.weight && parsedWeight > 0 ? parsedWeight : undefined,
        fragile: fields.fragile && fragile ? true : undefined,
      });
      trackingNumber = response.data.trackingNumber;
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      onError(detail);
      notify.error(dispatchFailureMessage(t("detail.dispatch_failed"), detail));
      setBusy(false);
      return;
    }
    notify.success(
      `${t("dispatch_dialog.success")}${trackingNumber}`,
    );
    try {
      await onChanged();
      onClose();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t("dispatch_dialog.title")} onClose={onClose}>
      <p className="mb-4 text-xs font-medium text-muted-foreground">
        {order.orderNumber} · {order.wilaya ?? "-"}
      </p>
      <div className="space-y-4">
        <Field label={t("dispatch_dialog.select_company")}>
          <Select
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.currentTarget.value);
              setStationCode("");
              setDeskQuery("");
            }}
          >
            <option value="">{t("dispatch_dialog.select_company")}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("dispatch_dialog.delivery_type_label")}>
          <Select
            value={deliveryType}
            onChange={(event) => {
              setDeliveryType(
                event.currentTarget.value === "stop_desk" ? "stop_desk" : "home",
              );
              setStationCode("");
              setDeskQuery("");
            }}
          >
            <option value="home">{t("dispatch_dialog.type_home")}</option>
            <option value="stop_desk">{t("dispatch_dialog.type_stop_desk")}</option>
          </Select>
          {typeOverridden && (
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {t("dispatch_dialog.type_override_note")}
            </p>
          )}
        </Field>

        {isStopDesk && companyId && (
          <Field label={t("dispatch_dialog.station_code_label")}>
            {loadingDesks ? (
              <p
                role="status"
                className="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
              >
                {t("dispatch_dialog.loading_stations")}
              </p>
            ) : desks.length > 0 ? (
              <div className="space-y-2">
                <label className="relative block">
                  <Search
                    size={15}
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={deskQuery}
                    onChange={(event) =>
                      setDeskQuery(event.currentTarget.value)
                    }
                    placeholder={t(
                      "dispatch_dialog.station_picker_placeholder",
                    )}
                    className="ps-9"
                  />
                </label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
                  {visibleDesks.map((desk) => (
                    <button
                      type="button"
                      key={desk.code}
                      onClick={() => setStationCode(desk.code)}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-start text-sm ${
                        stationCode === desk.code
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-mono text-xs font-semibold text-primary">
                        {desk.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {desk.name}
                        {desk.commune ? ` · ${desk.commune}` : ""}
                      </span>
                      {stationCode === desk.code && (
                        <Check size={14} className="text-primary" />
                      )}
                    </button>
                  ))}
                  {visibleDesks.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {t("dispatch_dialog.no_desk_match")}
                    </p>
                  )}
                </div>
                <Input
                  value={stationCode}
                  onChange={(event) =>
                    setStationCode(event.currentTarget.value)
                  }
                  placeholder={t("dispatch_dialog.station_code_placeholder")}
                  className="font-mono"
                />
              </div>
            ) : (
              // No desks in the order's wilaya for this carrier — the dead
              // end. The delivery-type select above IS the way out; the hint
              // makes the resolution explicit.
              <div
                role="alert"
                className="rounded-lg border border-border bg-muted/50 p-3 text-sm"
              >
                <p className="font-semibold text-foreground">
                  {`${t("dispatch_dialog.no_desks_in_wilaya")} ${order.wilaya ?? "-"}`}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {t("dispatch_dialog.no_desks_switch_hint")}
                </p>
              </div>
            )}
          </Field>
        )}

        {fields.remarks && (
          <Field label={t("dispatch_dialog.remarks_label")}>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.currentTarget.value)}
              maxLength={500}
              placeholder={t("dispatch_dialog.remarks_placeholder")}
            />
          </Field>
        )}
        {(fields.weight || fields.fragile) && (
          <div className="flex items-end gap-4">
            {fields.weight && (
              <Field label={t("detail.weight")}>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.currentTarget.value)}
                />
              </Field>
            )}
            {fields.fragile && (
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={fragile}
                  onChange={(event) => setFragile(event.currentTarget.checked)}
                />
                {t("detail.fragile")}
              </label>
            )}
          </div>
        )}
        {/* The server rejects a home dispatch without a street address
            (MISSING_ADDRESS) — surface that before the attempt, with the edit
            dialog as the way out. */}
        {!isStopDesk && !order.address?.trim() && (
          <div
            role="alert"
            className="rounded-lg border border-border bg-muted/50 p-3 text-sm"
          >
            <p className="font-semibold text-foreground">
              {t("dispatch_dialog.missing_address_title")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {t("dispatch_dialog.missing_address_hint")}
            </p>
          </div>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={
            !companyId ||
            (isStopDesk && !stationCode.trim()) ||
            (!isStopDesk && !order.address?.trim()) ||
            busy
          }
          onClick={() => void submit()}
        >
          <Building2 size={16} />
          {busy
            ? t("dispatch_dialog.dispatching")
            : t("dispatch_dialog.dispatch")}
        </Button>
      </div>
    </Dialog>
  );
}
