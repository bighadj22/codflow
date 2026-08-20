"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gift, Package, Calendar, Settings2, Save, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createOffer, updateOffer } from "@/actions/offers";
import { useOffers } from "@/lib/translations";
import type { Offer, CreateOfferData } from "@/actions/offers";
import type { Product, ProductVariant } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  products: Product[];
  offer?: Offer; // undefined = create mode
}

export function OfferForm({ products, offer }: Props) {
  const t = useOffers();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!offer;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(offer?.name ?? "");
  const [discountType, setDiscountType] = useState<"free" | "free_shipping">(offer?.discountType ?? "free");
  const [triggerProductId, setTriggerProductId] = useState(offer?.triggerProduct?.id ?? "");
  const [triggerVariantId, setTriggerVariantId] = useState(offer?.triggerVariant?.id ?? "");
  const [triggerQty, setTriggerQty] = useState(String(offer?.triggerQuantity ?? 2));
  const [rewardProductId, setRewardProductId] = useState(offer?.rewardProduct?.id ?? "");
  const [rewardVariantId, setRewardVariantId] = useState(offer?.rewardVariant?.id ?? "");
  const [rewardQty, setRewardQty] = useState(String(offer?.rewardQuantity ?? 1));
  const [startsAt, setStartsAt] = useState(
    offer?.startsAt ? offer.startsAt.slice(0, 16) : ""
  );
  const [endsAt, setEndsAt] = useState(
    offer?.endsAt ? offer.endsAt.slice(0, 16) : ""
  );
  const [status, setStatus] = useState<"active" | "inactive">(offer?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Derived variant lists ────────────────────────────────────────────────────
  const triggerProduct = useMemo(
    () => products.find((p) => p.id === triggerProductId) ?? null,
    [products, triggerProductId]
  );
  const rewardProduct = useMemo(
    () => products.find((p) => p.id === rewardProductId) ?? null,
    [products, rewardProductId]
  );

  const triggerVariants: ProductVariant[] = useMemo(
    () => (triggerProduct?.hasVariants ? (triggerProduct.variants ?? []).filter((v) => v.active) : []),
    [triggerProduct]
  );
  const rewardVariants: ProductVariant[] = useMemo(
    () => (rewardProduct?.hasVariants ? (rewardProduct.variants ?? []).filter((v) => v.active) : []),
    [rewardProduct]
  );

  // Reward variant "same as ordered" option only available when reward = trigger product
  const rewardIsSameProduct = rewardProductId === triggerProductId;

  function variantLabel(v: ProductVariant) {
    return Object.values(v.variations).join(" / ");
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.form.error_name_required;
    if (!triggerProductId) errs.triggerProductId = t.form.error_trigger_product_required;
    if (discountType === "free" && !rewardProductId) errs.rewardProductId = t.form.error_reward_product_required;
    const tQty = parseInt(triggerQty);
    if (isNaN(tQty) || tQty < 1) errs.triggerQty = t.form.error_trigger_qty;
    if (discountType === "free") {
      const rQty = parseInt(rewardQty);
      if (isNaN(rQty) || rQty < 1) errs.rewardQty = t.form.error_reward_qty;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!validate()) return;

    const data: CreateOfferData = {
      name: name.trim(),
      discountType,
      triggerProductId,
      triggerVariantId: triggerVariantId || undefined,
      triggerQuantity: parseInt(triggerQty),
      rewardProductId: discountType === "free" ? rewardProductId : undefined,
      rewardVariantId: discountType === "free" ? (rewardVariantId || undefined) : undefined,
      rewardQuantity: discountType === "free" ? parseInt(rewardQty) : 0,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      status,
    };

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateOffer(offer.id, data);
          toast.success(t.form.success_edit);
        } else {
          await createOffer(data);
          toast.success(t.form.success_add);
        }
        router.push("/offers");
        router.refresh();
      } catch {
        toast.error(t.form.error_save);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header & Back Action */}
      <div className="flex items-center justify-end gap-2.5 sm:gap-3">
        <div className="hidden lg:flex items-center gap-3">
          <Button 
            onClick={handleSubmit} 
            disabled={isPending} 
            className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
          >
            {isPending ? "..." : <><Save size={14} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
        <Link
          href="/offers"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Basic Info Section */}
        <Section title={isEdit ? t.form.title_edit : t.form.title_add} icon={<Gift size={18} />}>
          <div className="space-y-5">
            <Field label={`${t.form.name_label} *`} error={errors.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.form.name_placeholder}
                className={cn(
                  "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all",
                  errors.name && "border-destructive"
                )}
                disabled={isPending}
              />
            </Field>

            <div className="space-y-2">
              <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ml-1">
                {t.form.discount_type_label}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {(["free", "free_shipping"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDiscountType(type)}
                    className={cn(
                      "flex items-center justify-center gap-2.5 rounded-xl border p-4 text-sm font-bold transition-all active:scale-[0.98]",
                      discountType === type
                        ? "bg-primary/[0.03] border-primary/30 text-primary shadow-sm"
                        : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span className="text-xl">{type === "free" ? "🎁" : "🚚"}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {(t.discount_type as Record<string, string>)[type]}
                    </span>
                  </button>
                ))}
              </div>
              {discountType === "free_shipping" && (
                <p className="text-[10px] text-muted-foreground/60 font-medium mt-1.5 ms-1">
                  {t.form.free_shipping_note}
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Trigger Section */}
        <Section title={t.form.section_trigger} icon={<Package size={18} />}>
          <div className="space-y-5">
            <Field label={`${t.form.trigger_product_label} *`} error={errors.triggerProductId}>
              <Select
                value={triggerProductId}
                onValueChange={(v) => {
                  setTriggerProductId(v ?? "");
                  setTriggerVariantId("");
                }}
                disabled={isPending}
              >
                <SelectTrigger className={cn(
                  "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold",
                  errors.triggerProductId && "border-destructive"
                )}>
                  <SelectValue placeholder={t.form.trigger_product_placeholder} />
                </SelectTrigger>
                <SelectContent className="glass-card rounded-2xl max-h-64">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-sm py-2.5">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {triggerVariants.length > 0 && (
              <Field label={t.form.trigger_variant_label}>
                <Select
                  value={triggerVariantId || "__any__"}
                  onValueChange={(v) => setTriggerVariantId(v === "__any__" ? "" : (v ?? ""))}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-card rounded-2xl max-h-64">
                    <SelectItem value="__any__" className="font-bold text-sm py-2.5">
                      {t.form.trigger_variant_any}
                    </SelectItem>
                    {triggerVariants.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="font-bold text-sm py-2.5">
                        {variantLabel(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label={`${t.form.trigger_qty_label} *`} error={errors.triggerQty}>
              <Input
                type="number"
                min={1}
                value={triggerQty}
                onChange={(e) => setTriggerQty(e.target.value)}
                className={cn(
                  "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all w-32 tabular-nums",
                  errors.triggerQty && "border-destructive"
                )}
                disabled={isPending}
              />
              <p className="text-[10px] text-muted-foreground/60 font-medium mt-1.5 ms-1">
                {t.form.trigger_qty_hint}
              </p>
            </Field>
          </div>
        </Section>

        {/* Reward Section - only for 'free' type */}
        {discountType === "free" && (
          <Section title={t.form.section_reward} icon={<Zap size={18} />}>
            <div className="space-y-5">
              <Field label={`${t.form.reward_product_label} *`} error={errors.rewardProductId}>
                <Select
                  value={rewardProductId}
                  onValueChange={(v) => {
                    setRewardProductId(v ?? "");
                    setRewardVariantId("");
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(
                    "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold",
                    errors.rewardProductId && "border-destructive"
                  )}>
                    <SelectValue placeholder={t.form.reward_product_placeholder} />
                  </SelectTrigger>
                  <SelectContent className="glass-card rounded-2xl max-h-64">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="font-bold text-sm py-2.5">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {rewardVariants.length > 0 && (
                <Field label={t.form.reward_variant_label}>
                  <Select
                    value={rewardVariantId || "__default__"}
                    onValueChange={(v) => setRewardVariantId(v === "__default__" ? "" : (v ?? ""))}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-card rounded-2xl max-h-64">
                      <SelectItem value="__default__" className="font-bold text-sm py-2.5">
                        {rewardIsSameProduct ? t.form.reward_variant_same : t.form.reward_variant_any}
                      </SelectItem>
                      {rewardVariants.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="font-bold text-sm py-2.5">
                          {variantLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label={`${t.form.reward_qty_label} *`} error={errors.rewardQty}>
                <Input
                  type="number"
                  min={1}
                  value={rewardQty}
                  onChange={(e) => setRewardQty(e.target.value)}
                  className={cn(
                    "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all w-32 tabular-nums",
                    errors.rewardQty && "border-destructive"
                  )}
                  disabled={isPending}
                />
              </Field>
            </div>
          </Section>
        )}

        {/* Schedule Section */}
        <Section title={t.form.section_schedule} icon={<Calendar size={18} />}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.form.starts_at_label}>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                  disabled={isPending}
                />
              </Field>
              <Field label={t.form.ends_at_label}>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                  disabled={isPending}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* Settings Section */}
        <Section title={t.form.status_label} icon={<Settings2 size={18} />}>
          <div className="pt-2">
            <label className="flex items-center justify-between gap-4 cursor-pointer group">
              <div className="space-y-0.5">
                <p className="text-[13px] sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {status === "active" ? t.form.status_active : t.form.status_inactive}
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium opacity-70">
                  {status === "active" ? "Offer is currently active" : "Offer is currently inactive"}
                </p>
              </div>
              <Switch
                checked={status === "active"}
                onCheckedChange={(checked) => setStatus(checked ? "active" : "inactive")}
                disabled={isPending}
                className="scale-95 sm:scale-100 shrink-0"
              />
            </label>
          </div>
        </Section>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/offers")}
            disabled={isPending}
            className="flex-none w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground transition-all active:scale-90 shadow-sm"
          >
            <X size={20} />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 h-12 sm:h-14 rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
          >
            {isPending ? "..." : <><Save size={16} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl sm:rounded-[2rem] border-border/30 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 border-b border-border/10 bg-muted/5">
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <div className="text-primary scale-90 sm:scale-100">{icon}</div>
          </div>
        )}
        <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight font-display uppercase">{title}</h2>
      </div>
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ml-1">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive font-medium mt-1.5 ms-1">{error}</p>}
    </div>
  );
}
