import {
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { IconButton } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { formatDeliveryMoney } from "@/features/delivery/model";
import type { DriverCompensation } from "@/features/delivery/types";

export function CompensationRow({
  row,
  wilayaLabel,
  canManage,
  isEditing,
  draftFee,
  busy,
  onStartEdit,
  onDelete,
  onFeeChange,
  onSave,
  onCancel,
}: {
  row: DriverCompensation;
  wilayaLabel: (id: number) => string;
  canManage: boolean;
  isEditing: boolean;
  draftFee: string;
  busy: boolean;
  onStartEdit: (row: DriverCompensation) => void;
  onDelete: (row: DriverCompensation) => void;
  onFeeChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT("delivery");
  const locale = useLocale();
  const ar = wilayaLabel(row.wilayaId);
  const fr = row.wilayaName ?? `#${row.wilayaId}`;
  if (isEditing) {
    return (
      <li className="bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-mono text-xs font-bold tabular-nums text-primary">
              {String(row.wilayaId).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{ar}</p>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-tight text-muted-foreground/50">
                {fr}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                autoFocus
                value={draftFee}
                onChange={(event) => onFeeChange(event.currentTarget.value)}
                className="h-10 w-36 rounded-xl border border-input bg-card pe-10 ps-3 text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                DA
              </span>
            </div>
            <IconButton
              type="button"
              variant="solid"
              aria-label={t("compensations.save")}
              disabled={busy || draftFee === ""}
              onClick={onSave}
            >
              <Check size={15} />
            </IconButton>
            <IconButton
              type="button"
              aria-label={t("compensations.cancel")}
              disabled={busy}
              onClick={onCancel}
            >
              <X size={15} />
            </IconButton>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="group flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/20">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted/40 font-mono text-xs font-bold tabular-nums text-muted-foreground/50 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {String(row.wilayaId).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{ar}</p>
        <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-tight text-muted-foreground/50">
          {fr}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-sm font-bold leading-none tabular-nums text-primary">
          {formatDeliveryMoney(row.feePerDelivery, locale)}
        </p>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
          {t("compensations.fee_unit")}
        </p>
      </div>
      {canManage && (
        <div className="ms-1 flex shrink-0 items-center gap-1">
          <IconButton
            type="button"
            aria-label={t("compensations.edit")}
            title={t("compensations.edit")}
            onClick={() => onStartEdit(row)}
            disabled={busy}
          >
            <Pencil size={14} />
          </IconButton>
          <IconButton
            type="button"
            variant="danger"
            aria-label={t("compensations.delete")}
            title={t("compensations.delete")}
            onClick={() => onDelete(row)}
            disabled={busy}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
    </li>
  );
}
