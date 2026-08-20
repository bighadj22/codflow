"use client";

import { useState } from "react";
import { Plus, Trash2, Package } from "lucide-react";
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
import { Product, ProductVariant, OrderProduct } from "@/types";
import { useOrders, useCommon } from "@/lib/translations";
import { StockDeductionIndicator } from "./stock-deduction-indicator";
import { formatPrice } from "@/lib/format";

interface Props {
  selectedProducts: OrderProduct[];
  onChange: (products: OrderProduct[]) => void;
  availableProducts: Product[];
  productVariants?: Record<string, ProductVariant[]>;
}

export function OrderProductSelector({
  selectedProducts,
  onChange,
  availableProducts,
  productVariants = {},
}: Props) {
  const common = useCommon();
  const t = useOrders();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);
  const variants = selectedProductId ? (productVariants[selectedProductId] ?? selectedProduct?.variants ?? []) : [];
  const hasVariants = variants.length > 0;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;

  const pricePerUnit = selectedVariant?.price ?? selectedProduct?.price ?? 0;
  const currentStock = selectedVariant?.inventory ?? selectedProduct?.totalInventory ?? selectedProduct?.inventory ?? 0;

  function handleAddProduct() {
    if (!selectedProduct) return;

    const newProduct: OrderProduct = {
      id: `temp-${Date.now()}`,
      orderId: "",
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      variantId: selectedVariant?.id ?? null,
      variantLabel: selectedVariant
        ? Object.entries(selectedVariant.variations).map(([, v]) => v).join(" / ")
        : null,
      quantity,
      pricePerUnit,
      lineTotal: quantity * pricePerUnit,
      status: "fulfilled",
      returnedQuantity: 0,
      createdAt: new Date().toISOString(),
    };

    onChange([...selectedProducts, newProduct]);
    setSelectedProductId("");
    setSelectedVariantId("");
    setQuantity(1);
  }

  function handleRemoveProduct(id: string) {
    onChange(selectedProducts.filter((p) => p.id !== id));
  }

  const totalPrice = selectedProducts.reduce((sum, p) => sum + p.lineTotal, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-foreground">{t.form.products_section}</h3>

      {/* Add Product Form */}
      <div className="bg-muted rounded-xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Product Select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-bold">
              {t.form.select_product}
            </Label>
            <Select
              value={selectedProductId}
              onValueChange={(value) => {
                setSelectedProductId(value ?? "");
                setSelectedVariantId("");
              }}
            >
              <SelectTrigger className="bg-card border-border text-foreground font-semibold">
                <SelectValue placeholder={t.form.select_product} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id} className="font-semibold">
                    <div className="flex items-center gap-2 w-full">
                      <Package size={12} className="text-muted-foreground shrink-0" />
                      <span>{product.name}</span>
                      {!product.hasVariants && (
                        <span className="text-muted-foreground text-xs ms-auto">
                          {formatPrice(product.price, common.currency.symbol)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variant Select */}
          {hasVariants && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-bold">
                {t.form.select_variation}
              </Label>
              <Select
                value={selectedVariantId}
                onValueChange={(value) => setSelectedVariantId(value ?? "")}
              >
                <SelectTrigger className="bg-card border-border text-foreground font-semibold">
                  <SelectValue placeholder={t.form.select_variation} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {variants.map((variant) => {
                    const label = Object.entries(variant.variations).map(([, v]) => v).join(" / ");
                    return (
                      <SelectItem key={variant.id} value={variant.id} className="font-semibold">
                        <div className="flex items-center gap-3 w-full">
                          <span>{label}</span>
                          <span className="text-primary text-xs font-black ms-auto">
                            {formatPrice(variant.price, common.currency.symbol)}
                          </span>
                          {variant.sku && (
                            <span className="font-mono text-muted-foreground text-[10px]">
                              {variant.sku}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price preview + Quantity */}
          {selectedProduct && (!hasVariants || selectedVariant) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-bold">
                {t.form.quantity_label}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="bg-card border-border text-foreground w-24"
                />
                <span className="text-sm text-muted-foreground">
                  ×{" "}
                  <span className="font-black text-primary">
                    {formatPrice(pricePerUnit, common.currency.symbol)}
                  </span>
                  {" = "}
                  <span className="font-black text-foreground">
                    {formatPrice(quantity * pricePerUnit, common.currency.symbol)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Quantity for no-variant products (fallback) */}
          {selectedProduct && hasVariants && !selectedVariant && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-bold">
                {t.form.quantity_label}
              </Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="bg-card border-border text-foreground"
                disabled
              />
            </div>
          )}
        </div>

        {/* Stock Indicator */}
        {selectedProduct && selectedProduct.trackInventory && (!hasVariants || selectedVariant) && (
          <StockDeductionIndicator
            productId={selectedProduct.id}
            variantId={selectedVariantId || null}
            quantity={quantity}
            currentStock={currentStock}
          />
        )}

        {/* Add Button */}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleAddProduct}
            disabled={!selectedProduct || (hasVariants && !selectedVariantId)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black"
          >
            <Plus size={14} className="ms-1" />
            {t.form.add_product}
          </Button>
        </div>
      </div>

      {/* Selected Products List */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          {selectedProducts.map((product) => (
            <div
              key={product.id}
              className="bg-card rounded-xl border border-border p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="font-bold text-foreground">{product.productName}</p>
                {product.variantLabel && (
                  <p className="text-xs text-muted-foreground mt-0.5">{product.variantLabel}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground font-semibold">
                    {t.form.quantity_label}: <span className="font-black text-foreground">{product.quantity}</span>
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {formatPrice(product.pricePerUnit, common.currency.symbol)} × {product.quantity}
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {t.form.line_total}:{" "}
                    <span className="font-black text-primary">
                      {formatPrice(product.lineTotal, common.currency.symbol)}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveProduct(product.id)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}

          {/* Total Price */}
          <div className="bg-primary/10 rounded-xl border border-primary/20 p-3 flex items-center justify-between">
            <span className="text-sm font-black text-foreground">{t.form.order_total}</span>
            <span className="text-lg font-black text-primary">
              {formatPrice(totalPrice, common.currency.symbol)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
