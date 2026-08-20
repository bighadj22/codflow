"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Package, Save, X, DollarSign, Layers, Settings2, BarChart3, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useProducts, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { useConfirm } from "@/components/ui/use-confirm";
import { ProductOptionsManager } from "./product-options-manager";
import { ProductImageUploader, type PendingImage } from "./product-image-uploader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createProduct, updateProduct, getProduct,
  createVariant, updateVariant, getVariants, deleteVariant,
  getProductImages, saveProductImage, deleteProductImage,
} from "@/actions/products";
import type { ProductCategory, ProductStatus, ProductImage, VariantOptionFormState, ShippingProfile } from "@/types";
import { cn } from "@/lib/utils";
import { createProductFormSchema, type ProductFormErrors } from "@/validations/products";

interface Props {
  productId?: string;
  groups: ProductCategory[];
  shippingProfiles?: ShippingProfile[];
}

interface VariantRow {
  key: string;
  variations: Record<string, string>;
  price: string;
  sku: string;
  inventory: string;
  lowStockThreshold: string;
  active: boolean;
  existingId?: string;
  imageId?: string | null;
}

const STATUS_VALUES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function calcMargin(price: string, cost: string) {
  const b = Number(price), c = Number(cost);
  if (!b || !c || c >= b) return null;
  return Math.round(((b - c) / b) * 100);
}

function generateCombinations(options: VariantOptionFormState[]): Array<{ key: string; variations: Record<string, string> }> {
  const valid = options.filter((o) => o.name.trim() && o.values.some((v) => v.value.trim()));
  if (!valid.length) return [];
  let result: Record<string, string>[] = [{}];
  for (const opt of valid) {
    const vals = opt.values.filter((v) => v.value.trim());
    result = result.flatMap((existing) => vals.map((val) => ({ ...existing, [opt.name]: val.value })));
  }
  return result.map((variations) => ({ key: Object.values(variations).join(" / "), variations }));
}

export function ProductFormPage({ productId, groups, shippingProfiles = [] }: Props) {
  const router = useRouter();
  const t = useProducts();
  const common = useCommon();
  const { dir, locale } = useLanguage();
  const isEdit = !!productId;
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [initialLoading, setInitialLoading] = useState(isEdit);

  // Basic
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shippingProfileId, setShippingProfileId] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  // Pricing
  const [price, setPrice] = useState("");

  // Keep a ref to price so the variant-rows effect can read the latest value
  // without needing price in its dependency array (avoids re-running on every keystroke)
  const priceRef = useRef("");
  priceRef.current = price;
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  // Settings
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");
  const [trackInventory, setTrackInventory] = useState(true);
  const [inventory, setInventory] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  // Images
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  // Options & generated variant rows
  const [hasVariantsSwitch, setHasVariantsSwitch] = useState(false);
  const [variantOptions, setVariantOptions] = useState<VariantOptionFormState[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const skipOptionsSyncRef = useRef(false);

  // Bulk fill toolbar state
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  // Image picker per variant row (index of open row, null = closed)
  const [openImagePickerRow, setOpenImagePickerRow] = useState<number | null>(null);

  useEffect(() => {
    if (!isEdit && name) setSlug(toSlug(name));
  }, [name, isEdit]);

  useEffect(() => {
    if (productId) loadProduct(productId);
  }, [productId]);

  useEffect(() => {
    if (skipOptionsSyncRef.current) {
      skipOptionsSyncRef.current = false;
      return;
    }
    const combos = generateCombinations(variantOptions);
    setVariantRows((prev) => {
      const byKey = Object.fromEntries(prev.map((r) => [r.key, r]));
      return combos.map((c) => ({
        ...c,
        price: byKey[c.key]?.price ?? priceRef.current,
        sku: byKey[c.key]?.sku ?? "",
        inventory: byKey[c.key]?.inventory ?? "0",
        lowStockThreshold: byKey[c.key]?.lowStockThreshold ?? "5",
        active: byKey[c.key]?.active ?? true,
        existingId: byKey[c.key]?.existingId,
        imageId: byKey[c.key]?.imageId ?? null,
      }));
    });
  }, [variantOptions]); // priceRef is a ref — no need in deps. isEdit is constant.

  async function loadProduct(id: string) {
    try {
      setInitialLoading(true);
      const [p, loadedVariants, loadedImages] = await Promise.all([
        getProduct(id),
        getVariants(id),
        getProductImages(id),
      ]);
      setExistingImages(loadedImages);
      if (!p) { toast.error(t.form.error_not_found); return; }
      setName(p.name);
      setSlug(p.handle);
      setSku(p.sku ?? "");
      setCategoryId(p.categoryId ?? "");
      setShippingProfileId(p.shippingProfileId ?? null);
      setDescription(p.description ?? "");
      setPrice(String(p.price));
      setCompareAtPrice(p.compareAtPrice ? String(p.compareAtPrice) : "");
      setCostPrice(p.costPrice ? String(p.costPrice) : "");
      setStatus(p.status);
      setTrackInventory(p.trackInventory);
      setInventory(String(p.inventory));
      setLowStockThreshold(String(p.lowStockThreshold ?? 5));

      if (p.hasVariants) {
        setHasVariantsSwitch(true);
      }

      if (p.hasVariants && p.variantOptions) {
        skipOptionsSyncRef.current = true;
        setVariantOptions(
          p.variantOptions.map((opt) => ({
            id: `tmp-${Math.random().toString(36).slice(2)}`,
            name: opt.name,
            values: opt.values.map((val) => ({
              id: `tmp-${Math.random().toString(36).slice(2)}`,
              value: val.value,
              hexColor: val.hexColor ?? "",
            })),
          }))
        );
      }

      if (p.hasVariants && loadedVariants.length > 0) {
        setVariantRows(
          loadedVariants.map((v) => ({
            key: Object.values(v.variations).join(" / "),
            variations: v.variations,
            price: String(v.price),
            sku: v.sku ?? "",
            inventory: String(v.inventory),
            lowStockThreshold: String(v.lowStockThreshold ?? 5),
            active: v.active,
            existingId: v.id,
            imageId: v.imageId ?? null,
          }))
        );
      }
    } catch {
      toast.error(t.form.error_load_failed);
    } finally {
      setInitialLoading(false);
    }
  }

  function updateVariantRow(index: number, field: "price" | "sku" | "inventory" | "lowStockThreshold" | "active", value: string | boolean) {
    setVariantRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function updateVariantImageId(index: number, imageId: string | null) {
    setVariantRows((prev) => prev.map((r, i) => (i === index ? { ...r, imageId } : r)));
  }

  async function handleSave() {
    const parsed = createProductFormSchema(locale, hasVariantsSwitch).safeParse({
      name: name.trim(),
      sku: sku.trim(),
      price,
      compareAtPrice,
      costPrice,
      variantRows: hasVariantsSwitch ? variantRows.map((r) => ({ sku: r.sku, price: r.price })) : [],
    });
    if (!parsed.success) {
      const fieldErrors: ProductFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (field === "variantRows") {
          const subField = issue.path[2] as string | undefined;
          if (subField === "sku" && !fieldErrors.variantRowsSku) {
            fieldErrors.variantRowsSku = issue.message;
          } else if (!fieldErrors.variantRows) {
            fieldErrors.variantRows = issue.message;
          }
        } else if (!fieldErrors[field as keyof ProductFormErrors]) {
          fieldErrors[field as keyof ProductFormErrors] = issue.message;
        }
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message);
      return;
    }
    setErrors({});

    startTransition(async () => {
      try {
        const apiVariantOptions = variantOptions
          .filter((o) => o.name.trim())
          .map((o) => ({
            name: o.name,
            values: o.values.filter((v) => v.value.trim()).map((v) => ({
              value: v.value,
              hexColor: v.hexColor || null,
            })),
          }));

        const hasVariants = apiVariantOptions.length > 0 && variantRows.length > 0;

        // Identify orphaned variants by comparing existing backend variants directly
        // against apiVariantOptions — avoids the stale-closure bug where variantRows
        // still holds old rows because the useEffect hasn't re-run after an option change.
        const variantsToDelete: string[] = [];
        const orphanedIds = new Set<string>();

        if (isEdit && productId) {
          const existingVariants = await getVariants(productId);

          if (!hasVariantsSwitch) {
            // "Has Variants" toggled off: all existing variants are orphaned.
            for (const v of existingVariants) {
              variantsToDelete.push(v.id);
              orphanedIds.add(v.id);
            }
          } else {
            // Switch is ON but options may have changed — check each existing variant.
            // When apiVariantOptions is empty (all options deleted), every variant is orphaned.
            for (const variant of existingVariants) {
              const isStillValid = apiVariantOptions.length > 0 &&
                Object.entries(variant.variations).every(([optName, optValue]) => {
                  const matchOpt = apiVariantOptions.find(o => o.name === optName);
                  return matchOpt !== undefined && matchOpt.values.some(v => v.value === optValue);
                });
              if (!isStillValid) {
                variantsToDelete.push(variant.id);
                orphanedIds.add(variant.id);
              }
            }
          }
        }

        const data = {
          name,
          handle: slug || toSlug(name),
          sku: sku || undefined,
          categoryId: categoryId || undefined,
          shippingProfileId: shippingProfileId || undefined,
          description: description || undefined,
          price: Math.round(Number(price)),
          compareAtPrice: compareAtPrice ? Math.round(Number(compareAtPrice)) : undefined,
          costPrice: costPrice ? Math.round(Number(costPrice)) : undefined,
          status,
          trackInventory,
          // Do NOT send inventory on edit — managed via stock adjustments only.
          // On create, seed inventory for simple products; variant products start at 0.
          ...(isEdit ? {} : { inventory: hasVariants ? 0 : (Number(inventory) || 0) }),
          lowStockThreshold: hasVariants ? undefined : (Number(lowStockThreshold) || 5),
          hasVariants,
          // Explicitly null when removing variants so the DB column is cleared.
          // Sending undefined skips the column in updateProduct and leaves stale data.
          variantOptions: hasVariants ? apiVariantOptions : null,
        };

        let savedId: string;
        if (isEdit && productId) {
          await updateProduct(productId, data);
          savedId = productId;
        } else {
          const saved = await createProduct(data);
          savedId = saved.id;
        }

        if (hasVariants) {
          for (const row of variantRows) {
            // Skip rows whose backend variant is already marked for deletion
            if (row.existingId && orphanedIds.has(row.existingId)) continue;
            const variantData = {
              variations: row.variations,
              price: Math.round(Number(row.price) || 0),
              sku: row.sku.trim(),
              inventory: Number(row.inventory) || 0,
              lowStockThreshold: Number(row.lowStockThreshold) || 5,
              active: row.active,
              imageId: row.imageId ?? null,
            };
            if (row.existingId) {
              await updateVariant(savedId, row.existingId, variantData);
            } else {
              await createVariant(savedId, variantData);
            }
          }
        }

        // Delete orphaned variants
        for (const variantId of variantsToDelete) {
          await deleteVariant(savedId, variantId);
        }

        for (const imageId of deletedImageIds) {
          await deleteProductImage(savedId, imageId);
        }

        for (let i = 0; i < pendingImages.length; i++) {
          const img = pendingImages[i];
          await saveProductImage(savedId, {
            key: img.key,
            src: img.url,
            position: (existingImages.length - deletedImageIds.length) + i + 1,
          });
        }

        toast.success(isEdit ? t.form.success_edit : t.form.success_add);
        router.push("/products");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        // In production, Next.js sanitizes Server Action errors into a generic string.
        // Fall back to the generic save error message in that case.
        const isSanitized = !msg || msg.includes("Server Components render") || msg.includes("digest");
        toast.error(isSanitized ? t.form.error_save_failed : msg);
      }
    });
  }

  const margin = calcMargin(price, costPrice);
  const hasVariants = variantRows.length > 0;
  // Image picker column only available in edit mode once images are saved to DB
  const showImageCol = isEdit && existingImages.length > 0;

  if (initialLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-[2rem]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-48 md:pb-28 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header & Back Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="hidden" />
        <Link
          href="/products"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">

        {/* 1 — Basic Information */}
        <Section title={t.form.section_basic} icon={<Settings2 size={18} />}>
          <div className="space-y-5">
            <Field label={`${t.form.name_label} *`}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.form.name_placeholder}
                className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                disabled={isPending}
                dir={dir}
              />
              {errors.name && (
                <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                  <AlertCircle size={11} />{errors.name}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={hasVariantsSwitch ? t.form.sku_label : `${t.form.sku_label} *`}>
                <Input
                  value={sku}
                  onChange={(e) => { setSku(e.target.value); setErrors((prev) => ({ ...prev, sku: undefined })); }}
                  placeholder={t.form.sku_placeholder}
                  className={cn(
                    "h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 font-mono text-[13px] font-bold focus:ring-primary/20 focus:border-primary/30 transition-all",
                    errors.sku && "border-destructive/60 focus:border-destructive/60 focus:ring-destructive/20"
                  )}
                  disabled={isPending || hasVariantsSwitch}
                  dir="ltr"
                />
                {errors.sku && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {errors.sku}
                  </p>
                )}
              </Field>
              <Field label={t.form.group_label}>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold" disabled={isPending}>
                    <SelectValue placeholder={t.form.group_placeholder} />
                  </SelectTrigger>
                  <SelectContent className="glass-card rounded-2xl">
                    <SelectItem value="">{t.form.group_placeholder}</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {shippingProfiles.length > 0 && (
                <Field label="Shipping Profile">
                  <Select value={shippingProfileId ?? ""} onValueChange={(v) => setShippingProfileId(v || null)}>
                    <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold" disabled={isPending}>
                      <SelectValue placeholder="Default (store setting)">
                        {shippingProfileId
                          ? (shippingProfiles.find((p) => p.id === shippingProfileId)?.name ?? "Default (store setting)")
                          : "Default (store setting)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="glass-card rounded-2xl">
                      <SelectItem value="">Default (store setting)</SelectItem>
                      {shippingProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.isDefault ? " ★" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label={t.form.slug_label}>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  dir="ltr"
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 font-mono text-[13px] font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                  disabled={isPending}
                />
              </Field>
            </div>

            <Field label={t.form.description_label}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl p-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all min-h-[100px] resize-none"
                disabled={isPending}
                dir={dir}
              />
            </Field>
          </div>
        </Section>

        {/* 2 — Images */}
        <Section title={t.form.section_images ?? "Media"} icon={<Package size={18} />}>
          <ProductImageUploader
            existingImages={existingImages}
            pendingImages={pendingImages}
            productId={productId}
            onPendingAdd={(img) => setPendingImages((prev) => [...prev, img])}
            onPendingRemove={(clientId) =>
              setPendingImages((prev) => prev.filter((i) => i.clientId !== clientId))
            }
            onExistingRemove={(imageId) => {
              setExistingImages((prev) => prev.filter((i) => i.id !== imageId));
              setDeletedImageIds((prev) => [...prev, imageId]);
            }}
            onExistingReorder={setExistingImages}
            onPendingReorder={setPendingImages}
            disabled={isPending}
          />
        </Section>

        {/* 3 — Pricing */}
        <Section title={t.form.section_pricing} icon={<DollarSign size={18} />}>
          <div className="space-y-5">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
              {hasVariantsSwitch ? t.form.base_price_hint : t.form.product_price_hint}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={`${t.form.base_price_label} *`}>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min={0}
                    step={1}
                    disabled={isPending}
                    className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all pe-16"
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    {common.currency.symbol}
                  </span>
                </div>
                {errors.price && (
                  <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                    <AlertCircle size={11} />{errors.price}
                  </p>
                )}
              </Field>
              <Field label={t.form.compare_at_price_label}>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  min={0}
                  step={1}
                  disabled={isPending}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold"
                />
                {errors.compareAtPrice && (
                  <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                    <AlertCircle size={11} />{errors.compareAtPrice}
                  </p>
                )}
              </Field>
              <Field label={`${t.form.cost_price_label}${margin !== null ? ` — ${t.form.margin_label}: ${margin}%` : ""}`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  min={0}
                  step={1}
                  disabled={isPending}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold"
                />
                {errors.costPrice && (
                  <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                    <AlertCircle size={11} />{errors.costPrice}
                  </p>
                )}
              </Field>
            </div>
          </div>
        </Section>

        {/* 4 — Options & Variants (toggle-gated) */}
        <Section title={t.form.section_options} icon={<Layers size={18} />}>
          {/* Has Variants toggle */}
          <label className="flex items-center justify-between gap-4 cursor-pointer group">
            <div className="space-y-0.5">
              <p className="text-[13px] sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {t.form.has_variants_label}
              </p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium opacity-70">
                {t.form.has_variants_hint}
              </p>
            </div>
            <Switch
              checked={hasVariantsSwitch}
              onCheckedChange={async (v) => {
                if (!v && isEdit && variantRows.length > 0) {
                  const ok = await confirmDialog({
                    title: t.form.remove_variants_confirm,
                    description: t.form.remove_variants_confirm_desc,
                    variant: "destructive",
                    confirmLabel: t.form.remove_variants_confirm_label,
                  });
                  if (!ok) return;
                }
                setHasVariantsSwitch(v);
                if (!v) setVariantOptions([]);
              }}
              disabled={isPending}
              className="scale-95 sm:scale-100 shrink-0"
            />
          </label>

          {/* Options manager — only when switch is ON */}
          {hasVariantsSwitch && (
            <div className="mt-6 pt-5 border-t border-border/10 space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                {t.form.options_hint}
              </p>
              <ProductOptionsManager options={variantOptions} onChange={setVariantOptions} disabled={isPending} />
            </div>
          )}
        </Section>

        {/* 5 — Variant rows table (only when switch ON and rows are generated) */}
        {hasVariantsSwitch && hasVariants && (
          <Section title={`${t.form.variants_label} (${variantRows.length})`} icon={<BarChart3 size={18} />}>
            <div className="space-y-5">
              {errors.variantRows && (
                <p className="flex items-center gap-1 text-xs text-destructive font-bold">
                  <AlertCircle size={11} />{errors.variantRows}
                </p>
              )}
              {errors.variantRowsSku && (
                <p className="flex items-center gap-1 text-xs text-destructive font-bold">
                  <AlertCircle size={11} />{errors.variantRowsSku}
                </p>
              )}
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                {t.form.variants_hint}
              </p>

              {/* Bulk fill toolbar */}
              <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/20 border border-border/20 px-4 py-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 self-center me-1">{t.form.bulk_fill}:</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder={t.form.bulk_price_placeholder}
                    className="w-24 h-8 text-xs font-bold bg-background border-border/40 rounded-lg"
                    disabled={isPending}
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
                    disabled={isPending}
                    onClick={() => {
                      const p = Number(bulkPrice);
                      if (p > 0) setVariantRows((prev) => prev.map((r) => ({ ...r, price: String(p) })));
                    }}
                  >
                    {t.form.bulk_price_apply}
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={bulkSkuPrefix}
                    onChange={(e) => setBulkSkuPrefix(e.target.value)}
                    placeholder={t.form.bulk_sku_placeholder}
                    className="w-28 h-8 font-mono text-[11px] font-bold bg-background border-border/40 rounded-lg"
                    disabled={isPending}
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
                    disabled={isPending}
                    onClick={() => {
                      const prefix = bulkSkuPrefix.trim();
                      if (prefix) {
                        setVariantRows((prev) =>
                          prev.map((r, i) => ({ ...r, sku: `${prefix}-${String(i + 1).padStart(3, "0")}` }))
                        );
                        setErrors((prev) => ({ ...prev, variantRowsSku: undefined }));
                      }
                    }}
                  >
                    {t.form.bulk_sku_auto}
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                    placeholder={t.form.bulk_stock_placeholder}
                    className="w-20 h-8 text-xs font-bold bg-background border-border/40 rounded-lg"
                    disabled={isPending}
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
                    disabled={isPending}
                    onClick={() => {
                      if (bulkStock !== "") {
                        const s = Number(bulkStock);
                        if (!isNaN(s)) setVariantRows((prev) => prev.map((r) => ({ ...r, inventory: String(s) })));
                      }
                    }}
                  >
                    {t.form.bulk_stock_apply}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar rounded-2xl border border-border/20 shadow-inner">
                <div className={showImageCol ? "min-w-[800px]" : "min-w-[680px]"}>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/10">
                      <tr className="border-b border-border/10">
                        <th className="text-start py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_label}</th>
                        <th className="text-start py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_price} ({common.currency.symbol})</th>
                        <th className="text-start py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_sku} *</th>
                        <th className="text-start py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_stock}</th>
                        <th className="text-start py-3 px-4 text-[10px] font-black text-amber-500/60 uppercase tracking-widest">{t.form.variant_threshold}</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_active}</th>
                        {showImageCol && (
                          <th className="text-center py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form.variant_image}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5">
                      {variantRows.map((row, i) => (
                        <tr key={row.key} className="hover:bg-white/[0.02] transition-colors group/row">
                          <td className="py-3 px-4">
                            <div className="min-w-0">
                              <p className="font-bold text-[13px] text-foreground tracking-tight group-hover/row:text-primary transition-colors">{row.key}</p>
                              {row.existingId && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">{t.form.variant_saved_badge}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={row.price}
                              onChange={(e) => updateVariantRow(i, "price", e.target.value)}
                              className="w-28 h-9 text-xs font-bold bg-muted/30 border-border/40 rounded-lg focus:ring-primary/20 tabular-nums"
                              disabled={isPending}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={row.sku}
                              onChange={(e) => { updateVariantRow(i, "sku", e.target.value); setErrors((prev) => ({ ...prev, variantRowsSku: undefined })); }}
                              placeholder={t.form.sku_placeholder ?? "SKU"}
                              className={cn(
                                "w-28 h-9 font-mono text-[11px] font-bold bg-muted/30 border-border/40 rounded-lg focus:ring-primary/20",
                                errors.variantRowsSku && !row.sku.trim() && "border-destructive/60"
                              )}
                              disabled={isPending}
                              dir="ltr"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={row.inventory}
                              onChange={(e) => updateVariantRow(i, "inventory", e.target.value)}
                              className="w-20 h-9 text-xs font-bold bg-muted/30 border-border/40 rounded-lg focus:ring-primary/20 tabular-nums"
                              disabled={isPending}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={row.lowStockThreshold}
                              onChange={(e) => updateVariantRow(i, "lowStockThreshold", e.target.value)}
                              className="w-20 h-9 text-xs font-bold bg-amber-500/5 border-amber-500/20 rounded-lg focus:ring-amber-500/20 tabular-nums"
                              disabled={isPending}
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Switch
                              checked={row.active}
                              onCheckedChange={(v) => updateVariantRow(i, "active", v)}
                              disabled={isPending}
                              className="scale-90"
                            />
                          </td>
                          {showImageCol && (
                            <td className="py-3 px-4 text-center">
                              <Popover
                                open={openImagePickerRow === i}
                                onOpenChange={(open) => setOpenImagePickerRow(open ? i : null)}
                              >
                                <PopoverTrigger
                                  type="button"
                                  disabled={isPending}
                                  className={cn(
                                    "w-10 h-10 rounded-xl overflow-hidden border-2 transition-all mx-auto flex items-center justify-center",
                                    row.imageId
                                      ? "border-primary shadow-sm"
                                      : "border-dashed border-border/40 bg-muted/20 hover:border-primary/40"
                                  )}
                                >
                                  {row.imageId ? (
                                    <img
                                      src={existingImages.find((img) => img.id === row.imageId)?.src ?? ""}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                                  )}
                                </PopoverTrigger>
                                <PopoverContent className="p-2 w-auto" side="left" align="center">
                                  <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">{t.form.variant_image_select}</p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {existingImages.map((img) => (
                                        <button
                                          key={img.id}
                                          type="button"
                                          onClick={() => {
                                            updateVariantImageId(i, row.imageId === img.id ? null : img.id);
                                            setOpenImagePickerRow(null);
                                          }}
                                          className={cn(
                                            "w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                                            row.imageId === img.id
                                              ? "border-primary shadow-md scale-105"
                                              : "border-transparent opacity-70 hover:opacity-100 hover:border-primary/40"
                                          )}
                                        >
                                          <img src={img.src} alt="" className="w-full h-full object-cover" />
                                        </button>
                                      ))}
                                    </div>
                                    {row.imageId && (
                                      <button
                                        type="button"
                                        onClick={() => { updateVariantImageId(i, null); setOpenImagePickerRow(null); }}
                                        className="w-full text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors py-1"
                                      >
                                        {t.form.variant_image_remove}
                                      </button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* 6 — Settings */}
        <Section title={t.form.section_settings} icon={<Settings2 size={18} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <Field label={t.form.status_label}>
              <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold" disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card rounded-2xl">
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>{t.status_options[s.toLowerCase() as keyof typeof t.status_options]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!hasVariantsSwitch && !isEdit && (
              <Field label={t.form.initial_stock_label}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={inventory}
                  onChange={(e) => setInventory(e.target.value)}
                  min={0}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold"
                  disabled={isPending}
                />
              </Field>
            )}
            {!hasVariantsSwitch && (
              <Field label={t.form.threshold_label}>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    min={0}
                    className="h-11 sm:h-12 bg-amber-500/5 border-amber-500/20 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-amber-500/20 focus:border-amber-500/40"
                    disabled={isPending}
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-medium mt-1.5 ms-1">{t.form.threshold_hint}</p>
              </Field>
            )}
          </div>

          {isEdit && !hasVariantsSwitch && (
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/10 px-4 py-3 text-[12px] text-muted-foreground mt-4">
              <span>{t.form.stock_adjust_note}</span>
              <Link href="/products/stock" className="text-primary hover:underline font-bold">
                {t.form.stock_adjust_link}
              </Link>
              <span>.</span>
            </div>
          )}

          <div className="pt-5 border-t border-border/10 mt-6">
            <label className="flex items-center justify-between gap-4 cursor-pointer group">
              <div className="space-y-0.5">
                <p className="text-[13px] sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">{t.form.track_stock_label}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium opacity-70">{t.form.track_stock_hint ?? "Monitor inventory levels automatically"}</p>
              </div>
              <Switch
                checked={trackInventory}
                onCheckedChange={setTrackInventory}
                disabled={isPending}
                className="scale-95 sm:scale-100"
              />
            </label>
          </div>
        </Section>
      </div>

      {/* Floating Action Bar — mobile: full-width above bottom nav / desktop: pill in bottom-end corner */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/products")}
            disabled={isPending}
            className="flex-none w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground transition-all active:scale-90 shadow-sm"
          >
            <X size={20} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-12 sm:h-14 rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
          >
            {isPending ? "..." : <><Save size={16} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
      </div>

      {/* Desktop sticky pill — always visible while scrolling */}
      <div className="hidden lg:flex fixed bottom-6 end-6 z-40 animate-in slide-in-from-bottom-4 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-2xl p-2 shadow-2xl flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/products")}
            disabled={isPending}
            className="h-10 w-10 rounded-xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all active:scale-90 shadow-sm"
          >
            <X size={16} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="h-10 px-5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
          >
            {isPending ? "..." : <><Save size={14} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
      </div>

      {ConfirmDialog}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ml-1">{label}</Label>
      {children}
    </div>
  );
}
