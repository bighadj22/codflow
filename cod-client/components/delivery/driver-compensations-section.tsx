"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MapPin, Plus, Check, X, Pencil, Trash2, Coins, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ui/use-confirm";
import { setDriverCompensation, deleteDriverCompensation } from "@/actions/drivers";
import { formatPrice } from "@/lib/format";
import { useDelivery, useCommon } from "@/lib/translations";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import type { DriverCompensation, Wilaya } from "@/types";

interface Props {
  driverId: string;
  compensations: DriverCompensation[];
  wilayas: Wilaya[];
  userScopes: string[];
}

type Draft = { wilayaId: number | null; fee: string };

/**
 * Per-wilaya driver pay editor. Lives on the driver profile page.
 *
 * Reads `compensations` + the full `wilayas` reference list from the server
 * (page preloads both). Add/edit writes via `setDriverCompensation`, delete via
 * `deleteDriverCompensation` — each mutation calls `router.refresh()` so the
 * page re-fetches and the list + summary stats stay in sync without a full
 * client-side cache.
 */
export function DriverCompensationsSection({
  driverId,
  compensations,
  wilayas,
  userScopes,
}: Props) {
  const router = useRouter();
  const t = useDelivery();
  const common = useCommon();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();

  // Inline-edit state keyed by wilayaId; "new" sentinel for the add-row form.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>({ wilayaId: null, fee: "" });

  // Sort compensations by wilayaId so the table reads 1 → 58 like the official list.
  const sorted = useMemo(
    () => [...compensations].sort((a, b) => a.wilayaId - b.wilayaId),
    [compensations],
  );

  // Wilayas NOT yet on this driver's grid — used to populate the add-row Select.
  const takenIds = useMemo(() => new Set(sorted.map((c) => c.wilayaId)), [sorted]);
  const availableWilayas = useMemo(
    () => wilayas.filter((w) => !takenIds.has(w.id)),
    [wilayas, takenIds],
  );

  const totalFee = sorted.reduce((sum, c) => sum + c.feePerDelivery, 0);
  const canAdd = availableWilayas.length > 0;

  function startAdd() {
    setEditing("new");
    setDraft({ wilayaId: availableWilayas[0]?.id ?? null, fee: "" });
  }

  function startEdit(row: DriverCompensation) {
    setEditing(row.wilayaId);
    setDraft({ wilayaId: row.wilayaId, fee: String(row.feePerDelivery) });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft({ wilayaId: null, fee: "" });
  }

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (draft.wilayaId == null) return;
    const feeNum = Number(draft.fee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      toast.error(t.compensations?.error_save ?? "Invalid fee");
      return;
    }

    const isNew = editing === "new";
    startTransition(async () => {
      try {
        await setDriverCompensation(driverId, draft.wilayaId!, feeNum);
        toast.success(
          isNew
            ? t.compensations?.success_added ?? "Rate added"
            : t.compensations?.success_updated ?? "Rate updated",
        );
        cancelEdit();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.compensations?.error_save ?? "Error");
      }
    });
  }

  async function handleDelete(row: DriverCompensation) {
    const ok = await confirmDialog({
      title: t.compensations?.confirm_delete_title ?? "Remove rate?",
      description: t.compensations?.confirm_delete_body,
      variant: "destructive",
      confirmLabel: t.compensations?.delete ?? "Delete",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteDriverCompensation(driverId, row.wilayaId);
        toast.success(t.compensations?.success_deleted ?? "Rate removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.compensations?.error_delete ?? "Error");
      }
    });
  }

  function wilayaLabel(id: number): { ar: string; fr: string } {
    const w = wilayas.find((x) => x.id === id);
    return { ar: w?.nameAr ?? String(id), fr: w?.name ?? `#${id}` };
  }

  return (
    <>
      <div className="space-y-4">
        {/* Section header ------------------------------------------------ */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Coins size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-foreground tracking-tight leading-tight truncate">
                {t.compensations?.title ?? "Wilaya Pay Grid"}
              </h2>
              <p className="text-[11px] font-bold text-muted-foreground/60 mt-0.5 truncate">
                {t.compensations?.subtitle}
              </p>
            </div>
          </div>

          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
            <Button
              type="button"
              size="sm"
              onClick={startAdd}
              disabled={!canAdd || editing === "new" || isPending}
              className="h-10 rounded-xl px-4 font-black text-[11px] uppercase tracking-widest shadow-md shadow-primary/10 active:scale-95 transition-all shrink-0"
            >
              <Plus size={13} className="me-1.5" />
              {t.compensations?.add_button ?? "Add rate"}
            </Button>
          </ProtectedAction>
        </div>

        {/* Summary strip ------------------------------------------------- */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-2xl border-border/20 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
                <MapPin size={9} className="text-primary/40" />
                {t.compensations?.total_rates ?? "rates"}
              </p>
              <p className="text-xl font-black text-foreground tabular-nums mt-1 leading-none">
                {sorted.length}
                <span className="text-muted-foreground/30 text-xs font-bold ms-2">/ 58</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl border-primary/10 p-3.5 bg-primary/[0.02]">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary/50 flex items-center gap-1.5">
                <Coins size={9} />
                {t.compensations?.total_fee_sum ?? "Total"}
              </p>
              <p className="text-xl font-black text-primary tabular-nums mt-1 leading-none">
                {formatPrice(totalFee, common.currency.symbol)}
              </p>
            </div>
          </div>
        )}

        {/* Add-row form -------------------------------------------------- */}
        {editing === "new" && (
          <form
            onSubmit={save}
            className="glass-card rounded-2xl border-primary/20 bg-primary/[0.03] p-4 space-y-3 animate-fade-in"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {t.compensations?.wilaya_label ?? "Wilaya"}
                </Label>
                <Select
                  value={draft.wilayaId != null ? String(draft.wilayaId) : undefined}
                  onValueChange={(v) => setDraft((d) => ({ ...d, wilayaId: v ? Number(v) : null }))}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-card border-border font-bold">
                    <SelectValue placeholder={t.compensations?.select_wilaya_placeholder ?? "Choose a wilaya…"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-72">
                    {availableWilayas.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)} className="font-semibold">
                        <div className="flex items-center gap-3 w-full">
                          <span className="text-muted-foreground/40 font-mono text-[10px] tabular-nums w-6">
                            {String(w.id).padStart(2, "0")}
                          </span>
                          <span dir="rtl" className="flex-1">{w.nameAr}</span>
                          <span className="text-muted-foreground/50 text-[10px] uppercase tracking-wider">{w.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {t.compensations?.fee_label ?? "Fee"}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="50"
                    autoFocus
                    placeholder="0"
                    value={draft.fee}
                    onChange={(e) => setDraft((d) => ({ ...d, fee: e.target.value }))}
                    className="h-11 rounded-xl bg-card border-border font-black tabular-nums pe-12"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    {common.currency.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                disabled={isPending}
                className="h-10 rounded-xl px-4 text-[11px] font-black uppercase tracking-widest"
              >
                <X size={13} className="me-1" />
                {t.compensations?.cancel ?? "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || draft.wilayaId == null || draft.fee === ""}
                className="h-10 rounded-xl px-5 text-[11px] font-black uppercase tracking-widest shadow-md shadow-primary/10 active:scale-95"
              >
                <Check size={13} className="me-1" />
                {isPending ? t.compensations?.saving ?? "Saving…" : t.compensations?.save ?? "Save"}
              </Button>
            </div>
          </form>
        )}

        {/* Empty state --------------------------------------------------- */}
        {sorted.length === 0 && editing !== "new" && (
          <div className="glass-card rounded-2xl border-dashed border-border/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Info size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground tracking-tight">
                {t.compensations?.empty_title ?? "No wilaya rates yet"}
              </p>
              <p className="text-[12px] text-muted-foreground/60 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
                {t.compensations?.empty_description}
              </p>
            </div>
            <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
              <Button
                type="button"
                size="sm"
                onClick={startAdd}
                disabled={!canAdd}
                className="h-11 rounded-xl px-5 text-[11px] font-black uppercase tracking-widest shadow-md shadow-primary/10 active:scale-95"
              >
                <Plus size={13} className="me-1.5" />
                {t.compensations?.add_button ?? "Add rate"}
              </Button>
            </ProtectedAction>
          </div>
        )}

        {/* Rates list ---------------------------------------------------- */}
        {sorted.length > 0 && (
          <div className="glass-card rounded-2xl border-border/30 overflow-hidden">
            <ul className="divide-y divide-border/10">
              {sorted.map((row) => {
                const lbl = wilayaLabel(row.wilayaId);
                const isEditing = editing === row.wilayaId;

                if (isEditing) {
                  return (
                    <li key={row.wilayaId} className="bg-primary/[0.03] p-4">
                      <form
                        onSubmit={save}
                        className="flex flex-col sm:flex-row sm:items-end gap-3"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-mono text-xs font-black flex items-center justify-center shrink-0 tabular-nums">
                            {String(row.wilayaId).padStart(2, "0")}
                          </div>
                          <div className="min-w-0">
                            <p dir="rtl" className="text-sm font-black text-foreground leading-tight truncate">{lbl.ar}</p>
                            <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/50 mt-0.5 truncate">{lbl.fr}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative w-36">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="50"
                              autoFocus
                              value={draft.fee}
                              onChange={(e) => setDraft((d) => ({ ...d, fee: e.target.value }))}
                              className="h-10 rounded-xl bg-card border-border font-black tabular-nums pe-10"
                            />
                            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                              {common.currency.symbol}
                            </span>
                          </div>
                          <Button
                            type="submit"
                            size="icon"
                            disabled={isPending || draft.fee === ""}
                            className="h-10 w-10 rounded-xl shrink-0 active:scale-90"
                          >
                            <Check size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={cancelEdit}
                            disabled={isPending}
                            className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground/60 active:scale-90"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      </form>
                    </li>
                  );
                }

                return (
                  <li
                    key={row.wilayaId}
                    className="group flex items-center gap-3 p-3.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted/40 text-muted-foreground/50 group-hover:bg-primary/10 group-hover:text-primary font-mono text-xs font-black flex items-center justify-center shrink-0 tabular-nums transition-colors">
                      {String(row.wilayaId).padStart(2, "0")}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p dir="rtl" className="text-sm font-black text-foreground leading-tight truncate">{lbl.ar}</p>
                      <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/50 mt-0.5 truncate">{lbl.fr}</p>
                    </div>

                    <div className="shrink-0 text-end">
                      <p className="text-sm font-black text-primary tabular-nums leading-none">
                        {formatPrice(row.feePerDelivery, common.currency.symbol)}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-1">
                        {t.compensations?.fee_unit ?? "per delivery"}
                      </p>
                    </div>

                    <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
                      <div className="flex items-center gap-1 shrink-0 ms-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(row)}
                          disabled={isPending || editing !== null}
                          aria-label={t.compensations?.edit ?? "Edit"}
                          className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 active:scale-90"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row)}
                          disabled={isPending || editing !== null}
                          aria-label={t.compensations?.delete ?? "Delete"}
                          className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 active:scale-90"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </ProtectedAction>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!canAdd && sorted.length > 0 && editing !== "new" && (
          <p className={cn(
            "text-[11px] font-bold text-muted-foreground/40 text-center italic"
          )}>
            {t.compensations?.all_wilayas_configured ?? "All wilayas configured"}
          </p>
        )}
      </div>

      {ConfirmDialog}
    </>
  );
}
