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
  const [remarks, setRemarks] = useState("");
  const [weight, setWeight] = useState("");
  const [fragile, setFragile] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedCompany = companies.find((company) => company.id === companyId);
  const fields = dispatchFieldSupport(selectedCompany?.code ?? "");
  const isStopDesk = order.deliveryType === "stop_desk";

  useEffect(() => {
    if (!companyId || !isStopDesk) {
      setDesks([]);
      return;
    }
    let alive = true;
    setLoadingDesks(true);
    listStopDesks(companyId)
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
  }, [companyId, isStopDesk]);

  const visibleDesks = useMemo(() => {
    const query = deskQuery.trim().toLocaleLowerCase();
    if (query) {
      return desks.filter((desk) =>
        `${desk.code} ${desk.name} ${desk.commune ?? ""}`
          .toLocaleLowerCase()
          .includes(query),
      );
    }
    const wilayaDesks = order.wilayaId
      ? desks.filter((desk) => desk.wilayaId === order.wilayaId)
      : [];
    return wilayaDesks.length > 0 ? wilayaDesks : desks;
  }, [deskQuery, desks, order.wilayaId]);

  async function submit() {
    if (!companyId || (isStopDesk && !stationCode.trim())) return;
    setBusy(true);
    let trackingNumber = "";
    try {
      const parsedWeight = Number(weight);
      const response = await dispatchOrder(order.id, {
        companyId,
        stationCode: stationCode.trim() || undefined,
        remarks: fields.remarks && remarks.trim() ? remarks.trim() : undefined,
        weight: fields.weight && parsedWeight > 0 ? parsedWeight : undefined,
        fragile: fields.fragile && fragile ? true : undefined,
      });
      trackingNumber = response.data.trackingNumber;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
      notify.error(t("detail.dispatch_failed"));
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
                      {t("dispatch_dialog.station_code_hint")}
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
              <Input
                value={stationCode}
                onChange={(event) => setStationCode(event.currentTarget.value)}
                placeholder={t("dispatch_dialog.station_code_placeholder")}
                className="font-mono"
              />
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
        <Button
          type="button"
          className="w-full"
          disabled={!companyId || (isStopDesk && !stationCode.trim()) || busy}
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
