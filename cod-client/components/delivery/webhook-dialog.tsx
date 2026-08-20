"use client";

import { useState, useTransition, useEffect } from "react";
import { Zap, CheckCircle2, Copy, Check, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { cn } from "@/lib/utils";
import { useDelivery, useOrders } from "@/lib/translations";
import type { DeliveryCompany } from "@/types";
import {
  registerZrWebhook,
  unregisterZrWebhook,
  saveYalidineSecret,
  saveZrStatusMapping,
} from "@/actions/delivery-companies";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "";

type MappingRow = { id: number; zrName: string; ourStatus: string };
let rowIdCounter = 0;

function jsonToRows(json: string | null): MappingRow[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Record<string, string[]>;
    const rows: MappingRow[] = [];
    for (const [ourStatus, zrNames] of Object.entries(parsed)) {
      if (!Array.isArray(zrNames)) continue;
      for (const zrName of zrNames) {
        rows.push({ id: rowIdCounter++, zrName, ourStatus });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function rowsToMapping(rows: MappingRow[]): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.zrName.trim() || !row.ourStatus) continue;
    if (!mapping[row.ourStatus]) mapping[row.ourStatus] = [];
    mapping[row.ourStatus].push(row.zrName.trim());
  }
  return mapping;
}

interface Props {
  company: DeliveryCompany;
  open: boolean;
  onClose: () => void;
}

export function WebhookDialog({ company, open, onClose }: Props) {
  const t = useDelivery();
  const ordersT = useOrders();
  const wt = t.webhook ?? {};

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle>{wt.title ?? "Auto-sync"}</DialogTitle>
              <DialogDescription>{company.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {company.code === "zr_express" && (
          <ZrContent company={company} onClose={onClose} />
        )}
        {company.code === "yalidine" && (
          <YalidineContent company={company} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── ZR Express Content ───────────────────────────────────────────────────────

function ZrContent({ company, onClose }: { company: DeliveryCompany; onClose: () => void }) {
  const t = useDelivery();
  const ordersT = useOrders();
  const wt = t.webhook ?? {};
  const locale = useErrorLocale();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<MappingRow[]>(() => jsonToRows(company.webhookStatusMapping));
  const isRegistered = !!company.webhookEndpointId;
  const webhookUrl = `${WORKER_URL}/webhooks/zr_express`;

  // Build OUR_STATUSES from translation
  const OUR_STATUSES = [
    { value: "out_for_delivery", label: ordersT.status?.out_for_delivery ?? "Out for Delivery" },
    { value: "assigned",         label: ordersT.status?.assigned ?? "Assigned" },
    { value: "delivered",        label: ordersT.status?.delivered ?? "Delivered" },
    { value: "returned",         label: ordersT.status?.returned ?? "Returned" },
    { value: "cancelled",        label: ordersT.status?.cancelled ?? "Cancelled" },
    { value: "preparing",        label: ordersT.status?.preparing ?? "Preparing" },
  ];

  // Re-sync rows when dialog re-opens with fresh company data
  useEffect(() => {
    setRows(jsonToRows(company.webhookStatusMapping));
  }, [company.webhookStatusMapping]);

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRegister() {
    startTransition(async () => {
      try {
        await registerZrWebhook(company.id);
        showSuccessToast(wt.active ?? "Webhook registered", locale);
        onClose();
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : (wt.register_error ?? "Registration failed"), locale);
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        await unregisterZrWebhook(company.id);
        showSuccessToast(wt.disconnect ?? "Webhook disconnected", locale);
        onClose();
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Failed to disconnect", locale);
      }
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { id: rowIdCounter++, zrName: "", ourStatus: "delivered" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: "zrName" | "ourStatus", value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function handleSaveMapping() {
    startTransition(async () => {
      try {
        await saveZrStatusMapping(company.id, rowsToMapping(rows));
        showSuccessToast(wt.save_mapping ?? "Mapping saved", locale);
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Failed to save mapping", locale);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Connection status */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/20 bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isRegistered ? "bg-emerald-500" : "bg-muted-foreground/30"
          )} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              {isRegistered ? (wt.active ?? "Active") : (wt.not_configured ?? "Not configured")}
            </p>
            {isRegistered && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{webhookUrl}</p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {!isRegistered ? (
          <Button
            size="sm"
            className="h-8 shrink-0 text-[10px] font-black uppercase tracking-wider rounded-lg"
            onClick={handleRegister}
            disabled={isPending}
          >
            <Zap className="w-3 h-3 me-1.5" />
            {isPending ? (wt.registering ?? "Registering...") : (wt.register ?? "Register")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-[10px] font-black uppercase tracking-wider rounded-lg border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
            onClick={handleDisconnect}
            disabled={isPending}
          >
            {isPending ? (wt.disconnecting ?? "Disconnecting...") : (wt.disconnect ?? "Disconnect")}
          </Button>
        )}
      </div>

      {/* Status Mapping */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {wt.custom_mapping ?? "Status Mapping"}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {wt.mapping_subtitle ?? "Map ZR status names to order statuses"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg"
            onClick={addRow}
            disabled={isPending}
          >
            <Plus className="w-3 h-3 me-1" />
            {wt.add_row ?? "Add"}
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-4 rounded-xl border border-border/10 bg-muted/10">
            <p className="text-[10px] text-muted-foreground/40">
              {wt.mapping_empty_hint ?? "No custom mapping — using built-in detection"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                {wt.mapping_zr_col ?? "ZR sends"}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 col-span-2">
                {wt.mapping_our_col ?? "Maps to"}
              </p>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <input
                  type="text"
                  value={row.zrName}
                  onChange={(e) => updateRow(row.id, "zrName", e.target.value)}
                  placeholder={wt.mapping_zr_placeholder ?? "e.g. Livré"}
                  className="h-8 px-2.5 bg-muted/30 border border-border/20 rounded-lg text-[11px] font-mono outline-none focus:border-primary/40 transition-colors w-full"
                />
                <div className="relative">
                  <select
                    value={row.ourStatus}
                    onChange={(e) => updateRow(row.id, "ourStatus", e.target.value)}
                    className="h-8 ps-2.5 pe-6 bg-muted/30 border border-border/20 rounded-lg text-[11px] font-bold text-foreground outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors"
                  >
                    {OUR_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removeRow(row.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          size="sm"
          className="h-8 text-[10px] font-black uppercase tracking-wider rounded-lg"
          onClick={handleSaveMapping}
          disabled={isPending}
        >
          {isPending ? (wt.saving ?? "Saving...") : (wt.save_mapping ?? "Save Mapping")}
        </Button>
      </div>
    </div>
  );
}

// ─── Yalidine Content ─────────────────────────────────────────────────────────

function YalidineContent({ company, onClose }: { company: DeliveryCompany; onClose: () => void }) {
  const t = useDelivery();
  const wt = t.webhook ?? {};
  const locale = useErrorLocale();
  const [isPending, startTransition] = useTransition();
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const hasSecret = !!company.webhookSecret;
  const webhookUrl = `${WORKER_URL}/webhooks/yalidine`;

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSaveSecret() {
    if (!secret.trim()) return;
    startTransition(async () => {
      try {
        await saveYalidineSecret(company.id, secret.trim());
        showSuccessToast(wt.secret_saved ?? "Secret saved", locale);
        setSecret("");
        onClose();
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Failed to save secret", locale);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border/20 bg-muted/20">
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0",
          hasSecret ? "bg-emerald-500" : "bg-muted-foreground/30"
        )} />
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-foreground">
            {hasSecret ? (wt.secret_saved ?? "Secret saved") : (wt.not_configured ?? "Not configured")}
          </p>
          {hasSecret && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-wider border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {wt.active ?? "Active"}
            </span>
          )}
        </div>
      </div>

      {/* Setup steps */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          {wt.setup_steps ?? "Setup Steps"}
        </p>
        <div className="space-y-2">
          {[wt.yalidine_step1, wt.yalidine_step2, wt.yalidine_step3].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0 mt-px">
                {i + 1}
              </div>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          {wt.webhook_url ?? "Webhook URL"}
        </p>
        <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2.5 border border-border/10">
          <p className="text-[10px] font-mono text-muted-foreground/80 truncate flex-1">{webhookUrl}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-white/50 dark:bg-muted border border-border/30 text-muted-foreground hover:text-primary transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Secret input */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          {wt.yalidine_secret ?? "Webhook Secret"}
        </p>
        <p className="text-[10px] text-muted-foreground/50 -mt-0.5">
          {wt.yalidine_secret_hint ?? "Copy the secret key from your Yalidine dashboard"}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="••••••••••••••"
            className="flex-1 h-9 px-3 bg-muted/30 border border-border/20 rounded-lg text-[11px] font-mono outline-none focus:border-primary/40 transition-colors"
          />
          <Button
            size="sm"
            className="h-9 px-4 text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0"
            onClick={handleSaveSecret}
            disabled={isPending || !secret.trim()}
          >
            {isPending ? (wt.saving ?? "Saving...") : (wt.save_secret ?? "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
