import { useState } from "react";
import {
  AlertCircle,
  Check,
  Coins,
  Info,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import {
  Button,
  Alert,
  Select,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteDriverCompensation,
  setDriverCompensation,
} from "@/features/delivery/api";
import {
  driverErrorMessage,
  formatDeliveryMoney,
} from "@/features/delivery/model";
import type {
  Driver,
  DriverCompensation,
  Wilaya,
} from "@/features/delivery/types";
import { CompensationRow } from "@/features/delivery/components/DriverCompensationRow";
import { notify } from "@/lib/notify";

export function DriverCompensationsSection({
  driver,
  compensations,
  wilayas,
}: {
  driver: Driver;
  compensations: DriverCompensation[];
  wilayas: Wilaya[];
}) {
  const t = useT("delivery");
  const common = useT("common");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draftWilaya, setDraftWilaya] = useState<number | null>(null);
  const [draftFee, setDraftFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);
  const sorted = [...compensations].sort((a, b) => a.wilayaId - b.wilayaId);
  const takenIds = new Set(sorted.map((row) => row.wilayaId));
  const availableWilayas = wilayas.filter((wilaya) => !takenIds.has(wilaya.id));
  const totalFee = sorted.reduce((sum, row) => sum + row.feePerDelivery, 0);
  const canAdd = availableWilayas.length > 0;

  function wilayaLabel(id: number) {
    const found = wilayas.find((wilaya) => wilaya.id === id);
    return found ? (locale === "ar" ? found.nameAr : found.name) : String(id);
  }

  async function run(task: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      notify.flashSuccess(successMessage);
      window.location.reload();
    } catch (cause) {
      const message = driverErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  function startAdd() {
    setEditing("new");
    setDraftWilaya(availableWilayas[0]?.id ?? null);
    setDraftFee("");
  }
  function startEdit(row: DriverCompensation) {
    setEditing(row.wilayaId);
    setDraftWilaya(row.wilayaId);
    setDraftFee(String(row.feePerDelivery));
  }
  function cancelEdit() {
    setEditing(null);
    setDraftWilaya(null);
    setDraftFee("");
  }
  async function save() {
    if (draftWilaya == null) return;
    const feeNum = Number(draftFee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      const message = t("compensations.error_save");
      setMessage(message);
      notify.error(message);
      return;
    }
    await run(
      () => setDriverCompensation(driver.id, draftWilaya, feeNum),
      t(
        editing === "new"
          ? "compensations.success_added"
          : "compensations.success_updated",
      ),
    );
  }
  async function handleDelete(row: DriverCompensation) {
    if (
      !(await confirm({
        title: t("compensations.confirm_delete_title"),
        description: t("compensations.confirm_delete_body"),
        confirmLabel: common("remove"),
        tone: "danger",
      }))
    )
      return;
    await run(
      () => deleteDriverCompensation(driver.id, row.wilayaId),
      t("compensations.success_deleted"),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Coins size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-foreground">
              {t("compensations.title")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground/60">
              {t("compensations.subtitle")}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="secondary"
            onClick={startAdd}
            disabled={!canAdd || editing === "new" || busy}
            className="shrink-0"
          >
            <Plus size={14} />
            {t("compensations.add_button")}
          </Button>
        )}
      </div>

      {message && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              <MapPin size={9} className="text-primary/40" />
              {t("compensations.total_rates")}
            </p>
            <p className="mt-1 text-xl font-bold leading-none tabular-nums text-foreground">
              {sorted.length}
              <span className="ms-2 text-xs font-bold text-muted-foreground/30">
                / 58
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-3.5">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary/50">
              <Coins size={9} />
              {t("compensations.total_fee_sum")}
            </p>
            <p className="mt-1 text-xl font-bold leading-none tabular-nums text-primary">
              {formatDeliveryMoney(totalFee, locale)}
            </p>
          </div>
        </div>
      )}

      {editing === "new" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {t("compensations.wilaya_label")}
              </p>
              <Select
                value={draftWilaya == null ? "" : String(draftWilaya)}
                onChange={(event) =>
                  setDraftWilaya(
                    event.currentTarget.value === ""
                      ? null
                      : Number(event.currentTarget.value),
                  )
                }
              >
                <option value="">
                  {t("compensations.select_wilaya_placeholder")}
                </option>
                {availableWilayas.map((wilaya) => (
                  <option key={wilaya.id} value={String(wilaya.id)}>
                    <span>
                      {String(wilaya.id).padStart(2, "0")} — {wilaya.nameAr} ·{" "}
                      {wilaya.name}
                    </span>
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {t("compensations.fee_label")}
              </p>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  autoFocus
                  value={draftFee}
                  onChange={(event) => setDraftFee(event.currentTarget.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-input bg-card pe-12 ps-3 text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  DA
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEdit}
              disabled={busy}
            >
              <X size={13} />
              {t("compensations.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={busy || draftWilaya == null || draftFee === ""}
            >
              <Check size={13} />
              {busy ? t("compensations.saving") : t("compensations.save")}
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 && editing !== "new" && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/10">
            <Info size={20} className="text-amber-500" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">
            {t("compensations.empty_title")}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-muted-foreground/60">
            {t("compensations.empty_description")}
          </p>
          {canManage && (
            <Button
              type="button"
              variant="secondary"
              onClick={startAdd}
              disabled={!canAdd}
              className="mt-4"
            >
              <Plus size={14} />
              {t("compensations.add_button")}
            </Button>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <ul className="divide-y divide-border">
            {sorted.map((row) => (
              <CompensationRow
                key={row.wilayaId}
                row={row}
                wilayaLabel={wilayaLabel}
                canManage={canManage}
                isEditing={editing === row.wilayaId}
                draftFee={draftFee}
                busy={busy}
                onStartEdit={startEdit}
                onDelete={(item) => void handleDelete(item)}
                onFeeChange={setDraftFee}
                onSave={() => void save()}
                onCancel={cancelEdit}
              />
            ))}
          </ul>
        </div>
      )}

      {!canAdd && sorted.length > 0 && editing !== "new" && (
        <p className="text-center text-[11px] font-bold italic text-muted-foreground/40">
          {t("compensations.all_wilayas_configured")}
        </p>
      )}
    </div>
  );
}
