"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Edit, Trash2, Package, Tag, TrendingUp, Layers, Info, DollarSign, BarChart3, History, Bell, Check, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { useProducts, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { formatPrice } from "@/lib/format";
import { deleteProduct } from "@/actions/products";
import { updateProductStockThreshold, updateVariantStockThreshold } from "@/actions/stock";
import { StockHistoryDrawer } from "@/components/products/stock-history-drawer";
import type { Product, ProductCategory } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  product: Product;
  groups: ProductCategory[];
}

function statusToVariant(status: string) {
  if (status === "ACTIVE") return "available";
  if (status === "DRAFT") return "inactive";
  return "out_of_stock";
}

interface HistoryState {
  open: boolean;
  variantId?: string;
  variantLabel?: string | null;
}

function ProductImageGallery({ images, productName }: { images: Product["images"]; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  if (!images || images.length === 0) {
    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-[2rem] bg-primary/10 flex items-center justify-center shrink-0 shadow-inner border border-primary/5">
        <Package className="w-9 h-9 sm:w-12 sm:h-12 text-primary" />
      </div>
    );
  }

  const selectedImage = images[selectedIndex];

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-[2rem] bg-primary/10 flex items-center justify-center shrink-0 shadow-inner border border-primary/5 overflow-hidden group">
        {selectedImage ? (
          <Image
            src={selectedImage.srcMd || selectedImage.src}
            alt={selectedImage.altText || productName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 64px, 96px"
          />
        ) : (
          <Package className="w-8 h-8 sm:w-12 sm:h-12 text-primary" />
        )}
        
        {/* Navigation arrows for multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setSelectedIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => setSelectedIndex(prev => prev === images.length - 1 ? 0 : prev + 1)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </>
        )}
        
        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-[8px] sm:text-[9px] font-bold rounded-md">
            {selectedIndex + 1}/{images.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip for multiple images */}
      {images.length > 1 && (
        <div className="flex gap-1 sm:gap-1.5 max-w-[80px] sm:max-w-[96px] overflow-x-auto no-scrollbar">
          {images.slice(0, 4).map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative w-3 h-3 sm:w-4 sm:h-4 rounded-md overflow-hidden border-2 transition-all shrink-0",
                selectedIndex === index 
                  ? "border-primary shadow-sm" 
                  : "border-transparent opacity-60 hover:opacity-80"
              )}
            >
              <Image
                src={image.srcSm || image.src}
                alt={image.altText || productName}
                fill
                className="object-cover"
                sizes="16px"
              />
            </button>
          ))}
          {images.length > 4 && (
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-md bg-muted/50 flex items-center justify-center">
              <span className="text-[6px] sm:text-[7px] font-bold text-muted-foreground">+{images.length - 4}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThresholdEditor({
  productId,
  variantId,
  initial,
}: {
  productId: string;
  variantId?: string;
  initial: number;
}) {
  const t = useProducts();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function handleSave() {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) { setEditing(false); setValue(String(initial)); return; }
    startTransition(async () => {
      try {
        if (variantId) {
          await updateVariantStockThreshold(productId, variantId, num);
        } else {
          await updateProductStockThreshold(productId, num);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.stock_dialog?.error_failed ?? "Failed");
      } finally {
        setEditing(false);
      }
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && setEditing(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!editing) setEditing(true); } }}
      title={t.stock_overview?.col_threshold}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border text-xs font-bold transition-all select-none",
        editing
          ? "border-amber-500/50 bg-amber-500/10 cursor-default"
          : "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer"
      )}
    >
      {saved ? (
        <Check className="w-3 h-3 text-green-500 shrink-0" />
      ) : (
        <Bell className="w-3 h-3 text-amber-500/70 shrink-0" />
      )}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setValue(String(initial)); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-10 bg-transparent outline-none tabular-nums text-center text-xs font-black text-amber-600 dark:text-amber-400"
          disabled={isPending}
        />
      ) : (
        <span className="tabular-nums text-amber-600/80 dark:text-amber-400/80">{value}</span>
      )}
    </div>
  );
}

export function ProductDetailView({ product, groups }: Props) {
  const t = useProducts();
  const common = useCommon();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [history, setHistory] = useState<HistoryState>({ open: false });

  const category = groups.find((g) => g.id === product.categoryId);

  async function handleDelete() {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", product.name) ?? product.name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteProduct(product.id);
        toast.success(t.success_deleted);
        router.push("/products");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.error_delete_failed);
      }
    });
  }

  const totalInventory = product.totalInventory ?? product.inventory ?? 0;

  return (
    <div className="max-w-4xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Action row */}
      <div className="flex items-center justify-end gap-2.5 sm:gap-3">
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href={`/products/${product.id}/edit`}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
            )}
          >
            <Edit size={14} />
            {t.actions.edit}
          </Link>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isPending}
            className="h-10 px-5 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-500 font-black text-[11px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95"
          >
            <Trash2 size={14} className="me-2" />
            {t.actions.delete}
          </Button>
        </div>
        <Link
          href="/products"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      {/* Hero Glass Card */}
      <div className="group relative glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-premium">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[80px] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 duration-700" />

        <div className="relative z-10 p-5 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
            <div className="flex items-start gap-4 sm:gap-6 flex-1 min-w-0">
              <ProductImageGallery images={product.images} productName={product.name} />

              <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
                <div>
                  <h1 className="text-base sm:text-2xl md:text-3xl font-black text-foreground tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                    {product.name}
                  </h1>
                  <p className="text-[9px] sm:text-xs font-mono text-muted-foreground/50 mt-0.5 uppercase tracking-widest truncate">
                    {product.handle}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={statusToVariant(product.status)} className="py-0.5 px-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm" />
                  {product.sku && (
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/10 uppercase">
                      {product.sku}
                    </span>
                  )}
                  {category && (
                    <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground font-black bg-muted/50 px-2 py-0.5 rounded-lg uppercase tracking-tight">
                      <Tag size={9} className="text-primary/50" />
                      {category.name}
                    </span>
                  )}
                </div>

                {product.description && (
                  <p className="hidden sm:block text-[13px] text-muted-foreground/70 leading-relaxed font-medium line-clamp-2" dir="auto">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-3 shrink-0 lg:w-56">
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                  {t.table.price}
                </p>
                <p className="text-lg sm:text-2xl font-black text-primary font-display tabular-nums leading-none">
                  {formatPrice(product.price, common.currency.symbol)}
                </p>
              </div>
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                  <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                  {t.table.variants}
                </p>
                <p className="text-lg sm:text-2xl font-black text-foreground font-display tabular-nums leading-none">
                  {product.variantsCount ?? product.variants?.length ?? 0}
                </p>
              </div>

              {/* Stock stat card — with history button + threshold editor */}
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                    {t.stock?.in_stock ?? "Stock"}
                  </p>
                  <button
                    onClick={() => setHistory({ open: true })}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-muted/40 hover:bg-primary/10 text-muted-foreground/50 hover:text-primary flex items-center justify-center transition-all active:scale-90"
                    title={t.stock_history?.title}
                  >
                    <History className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
                <p className="text-lg sm:text-2xl font-black text-foreground font-display tabular-nums leading-none">
                  {totalInventory}
                </p>
                {/* Threshold editor: only on sm+ to keep all 3 cards same height on mobile */}
                {!(product.variants?.length) && (
                  <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
                      {t.stock_overview?.threshold_label ?? "Alert at"}:
                    </span>
                    <ThresholdEditor
                      productId={product.id}
                      initial={product.lowStockThreshold ?? 5}
                    />
                  </div>
                )}
              </div>
            </div>

          {/* Mobile-only: description + threshold below the stat cards */}
          <div className="sm:hidden space-y-3 pt-3 border-t border-border/10 mt-1">
            {product.description && (
              <p className="text-xs text-muted-foreground/70 leading-relaxed font-medium line-clamp-3" dir="auto">
                {product.description}
              </p>
            )}
            {!(product.variants?.length) && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  {t.stock_overview?.threshold_label ?? "Alert at"}:
                </span>
                <ThresholdEditor
                  productId={product.id}
                  initial={product.lowStockThreshold ?? 5}
                />
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <div className="lg:col-span-12 space-y-6 sm:space-y-8">

          {/* Product Images Gallery */}
          {product.images && product.images.length > 0 && (
            <Section title={`${t.form?.images_label ?? "Images"} (${product.images.length})`} icon={<ImageIcon size={18} />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {product.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-muted/20 border border-border/10 shadow-sm hover:shadow-md transition-all"
                  >
                    <Image
                      src={image.srcMd || image.src}
                      alt={image.altText || `${product.name} - Image ${index + 1}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                    
                    {/* Image overlay with position indicator */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      #{image.position}
                    </div>
                    
                    {/* Primary image indicator */}
                    {index === 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-primary-foreground text-[9px] font-black rounded-md uppercase tracking-wider">
                        Primary
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Image details */}
              <div className="mt-6 pt-6 border-t border-border/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Total Images</p>
                    <p className="font-bold text-foreground">{product.images.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Primary Image</p>
                    <p className="font-bold text-foreground">{product.images[0]?.altText || "No alt text"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Image Formats</p>
                    <p className="font-bold text-foreground">
                      {product.images.some(img => img.srcLg) ? "Multi-size" : "Single-size"}
                    </p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Pricing Details */}
          <Section title={t.form?.section_pricing ?? "Pricing Matrix"} icon={<DollarSign size={18} />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8">
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form?.base_price_label ?? "Selling Price"}</p>
                <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{formatPrice(product.price, common.currency.symbol)}</p>
              </div>
              {product.compareAtPrice && (
                <div className="space-y-1">
                  <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form?.compare_at_price_label ?? "Compare At"}</p>
                  <p className="text-xl sm:text-2xl font-bold text-muted-foreground/40 line-through tabular-nums">{formatPrice(product.compareAtPrice, common.currency.symbol)}</p>
                </div>
              )}
              {product.costPrice && (
                <div className="space-y-1">
                  <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.form?.cost_price_label ?? "Item Cost"}</p>
                  <p className="text-xl sm:text-2xl font-black text-foreground/80 tabular-nums">{formatPrice(product.costPrice, common.currency.symbol)}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Variants */}
          {(product.variants?.length ?? 0) > 0 ? (
            <Section title={`${t.table.variants} (${product.variants?.length})`} icon={<BarChart3 size={18} />}>

              {/* ── Mobile card list (hidden on sm+) ── */}
              <div className="sm:hidden space-y-2.5">
                {product.variants?.map((variant) => {
                  const label = Object.entries(variant.variations).map(([, v]) => v).join(" / ");
                  return (
                    <div key={variant.id} className="rounded-2xl border border-border/20 bg-muted/10 p-4 space-y-3">
                      {/* Top row: name + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground tracking-tight">{label}</p>
                          {variant.sku && <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 uppercase">{variant.sku}</p>}
                        </div>
                        <StatusBadge status={variant.active ? "available" : "inactive"} className="shrink-0 scale-90 -me-1" />
                      </div>

                      {/* Stats row: price | stock | threshold */}
                      <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border/10">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{t.table.price}</p>
                          <p className="text-sm font-black text-primary tabular-nums">{formatPrice(variant.price, common.currency.symbol)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{t.stock.in_stock}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-foreground tabular-nums">{variant.inventory}</p>
                            <button
                              onClick={() => setHistory({ open: true, variantId: variant.id, variantLabel: label })}
                              className="w-5 h-5 rounded-md bg-muted/40 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all active:scale-90"
                              title={t.stock_history?.title}
                            >
                              <History className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">{t.stock_overview?.col_threshold}</p>
                          <ThresholdEditor
                            productId={product.id}
                            variantId={variant.id}
                            initial={variant.lowStockThreshold ?? 5}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table (hidden on mobile) ── */}
              <div className="hidden sm:block overflow-x-auto no-scrollbar rounded-2xl border border-border/20 shadow-inner">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10">
                    <tr className="border-b border-border/10">
                      <th className="text-start py-3.5 px-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.table.name}</th>
                      <th className="text-center py-3.5 px-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.table.price}</th>
                      <th className="text-center py-3.5 px-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.stock.in_stock}</th>
                      <th className="text-center py-3.5 px-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.stock_overview?.col_threshold}</th>
                      <th className="text-end py-3.5 px-5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t.table.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {product.variants?.map((variant) => {
                      const label = Object.entries(variant.variations).map(([, v]) => v).join(" / ");
                      return (
                        <tr key={variant.id} className="hover:bg-white/[0.02] transition-colors group/row">
                          <td className="py-4 px-5">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-foreground tracking-tight group-hover/row:text-primary transition-colors">{label}</p>
                              {variant.sku && <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 uppercase">{variant.sku}</p>}
                            </div>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className="text-sm font-black text-primary tabular-nums">{formatPrice(variant.price, common.currency.symbol)}</span>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-sm font-black text-foreground tabular-nums">{variant.inventory}</span>
                              <button
                                onClick={() => setHistory({ open: true, variantId: variant.id, variantLabel: label })}
                                className="w-5 h-5 rounded-md bg-muted/40 hover:bg-primary/10 text-muted-foreground/40 hover:text-primary flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all active:scale-90"
                                title={t.stock_history?.title}
                              >
                                <History className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <ThresholdEditor
                              productId={product.id}
                              variantId={variant.id}
                              initial={variant.lowStockThreshold ?? 5}
                            />
                          </td>
                          <td className="py-4 px-5 text-end">
                            <StatusBadge status={variant.active ? "available" : "inactive"} className="scale-90" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : (
            <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 p-10 text-center space-y-3 opacity-60">
              <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto">
                <Info size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40">
                {t.empty_state?.title ?? "No variants configured"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isPending}
            className="flex-none w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-rose-500/20 bg-rose-500/5 text-rose-500 transition-all active:scale-90 shadow-sm"
          >
            <Trash2 size={20} />
          </Button>
          <Link
            href={`/products/${product.id}/edit`}
            className="flex-1 h-12 sm:h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2 font-black text-[10px] sm:text-[11px] uppercase tracking-widest active:scale-95 transition-all"
          >
            <Edit size={16} />
            {t.actions.edit}
          </Link>
        </div>
      </div>

      {ConfirmDialog}

      {/* Stock History Drawer */}
      <StockHistoryDrawer
        productId={product.id}
        variantId={history.variantId}
        productName={product.name}
        variantLabel={history.variantLabel}
        open={history.open}
        onClose={() => setHistory({ open: false })}
      />
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
