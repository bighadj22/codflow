import type { Dispatch, SetStateAction } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { Card, Field, Input, Select } from "@/components/ui";
import { formatMoney } from "@/features/orders/model";
import { useT } from "@/i18n/react";
import type { Product, ProductVariant } from "@/features/orders/types";
import type { Locale } from "@/i18n/config";

export interface LineItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  pricePerUnit: number;
  lineTotal: number;
}

interface NewOrderProductsCardProps {
  products: Product[];
  lines: LineItem[];
  setLines: Dispatch<SetStateAction<LineItem[]>>;
  productId: string;
  setProductId: (id: string) => void;
  variantId: string;
  setVariantId: (id: string) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  errors: Record<string, string>;
  locale: Locale;
  onAddLine: () => void;
}

export function NewOrderProductsCard({
  products,
  lines,
  setLines,
  productId,
  setProductId,
  variantId,
  setVariantId,
  quantity,
  setQuantity,
  errors,
  locale,
  onAddLine,
}: NewOrderProductsCardProps) {
  const t = useT("orders");

  const selectedProduct = products.find((product) => product.id === productId);
  const variants =
    selectedProduct?.variants.filter((variant) => variant.active) ?? [];
  const selectedVariant = variants.find((variant) => variant.id === variantId);

  return (
    <Card title={t("form.products_section")}>
      <div className="space-y-4">
        <Field label={t("form.select_product")}>
          <Select
            value={productId}
            onChange={(event) => {
              setProductId(event.currentTarget.value);
              setVariantId("");
            }}
          >
            <option value="">{t("form.select_product")}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatMoney(product.price, locale)}
              </option>
            ))}
          </Select>
        </Field>
        {variants.length > 0 && (
          <Field label={t("form.select_variation")}>
            <Select
              value={variantId}
              onChange={(event) => setVariantId(event.currentTarget.value)}
            >
              <option value="">{t("form.select_variation")}</option>
              {variants.map((variant: ProductVariant) => (
                <option key={variant.id} value={variant.id}>
                  {Object.values(variant.variations).join(" / ")} ·{" "}
                  {formatMoney(variant.price, locale)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex items-end gap-3">
          <Field label={t("form.quantity_label")}>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(1, Number(event.currentTarget.value) || 1),
                )
              }
            />
          </Field>
          <button
            type="button"
            onClick={onAddLine}
            disabled={
              !selectedProduct ||
              (variants.length > 0 && !selectedVariant)
            }
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            {t("form.add_product")}
          </button>
        </div>
        {selectedProduct?.trackInventory &&
          (!selectedProduct.hasVariants || selectedVariant) &&
          (() => {
            const stock =
              selectedVariant?.inventory ??
              selectedProduct.totalInventory ??
              selectedProduct.inventory;
            const remaining = stock - quantity;
            return (
              <div
                className={`rounded-md border p-3 text-xs font-medium ${
                  remaining < 0
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <span>
                  {t("form.current_stock")}: {stock}
                </span>
                <span className="ms-3">
                  {t("form.remaining_stock")}: {remaining}
                </span>
                {remaining < 0 && (
                  <span className="ms-3 font-semibold">
                    {t("form.insufficient_stock")}
                  </span>
                )}
              </div>
            );
          })()}
        {errors.products && (
          <p className="text-xs font-medium text-destructive">
            {errors.products}
          </p>
        )}
        {lines.length > 0 && (
          <div className="divide-y divide-border rounded-md border border-border">
            {lines.map((line) => (
              <div key={line.id} className="flex items-start gap-3 p-3">
                <Package
                  size={16}
                  className="mt-0.5 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {line.productName}
                  </p>
                  {line.variantLabel && (
                    <p className="text-xs text-muted-foreground">
                      {line.variantLabel}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {line.quantity} ×{" "}
                    {formatMoney(line.pricePerUnit, locale)}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatMoney(line.lineTotal, locale)}
                </span>
                <button
                  type="button"
                  aria-label={t("form.remove_product")}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.id !== line.id),
                    )
                  }
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
