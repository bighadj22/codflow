import { useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle } from "lucide-react";
import {
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { ProductOptionsManager } from "@/features/products/components/ProductOptionsManager";
import type {
  ProductImage,
  VariantOptionFormState,
} from "@/features/products/types";

export interface VariantRow {
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

interface ProductVariantsCardProps {
  hasVariantsSwitch: boolean;
  onToggleVariants: (checked: boolean) => void | Promise<void>;
  variantOptions: VariantOptionFormState[];
  setVariantOptions: Dispatch<SetStateAction<VariantOptionFormState[]>>;
  variantRows: VariantRow[];
  setVariantRows: Dispatch<SetStateAction<VariantRow[]>>;
  existingImages: ProductImage[];
  errors: Record<string, string>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  busy: boolean;
  showImageCol: boolean;
}

export function ProductVariantsCard({
  hasVariantsSwitch,
  onToggleVariants,
  variantOptions,
  setVariantOptions,
  variantRows,
  setVariantRows,
  existingImages,
  errors,
  setErrors,
  busy,
  showImageCol,
}: ProductVariantsCardProps) {
  const t = useT("products");
  const common = useT("common");

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [openImagePickerRow, setOpenImagePickerRow] = useState<number | null>(
    null,
  );

  function updateVariantRow(
    index: number,
    field: "price" | "sku" | "inventory" | "lowStockThreshold" | "active",
    value: string | boolean,
  ) {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function updateVariantImageId(index: number, imageId: string | null) {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, imageId } : row)),
    );
  }

  const hasVariants = variantRows.length > 0;

  return (
    <>
      <Card title={t("form.section_options")}>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("form.has_variants_label")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("form.has_variants_hint")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={hasVariantsSwitch}
            onChange={(event) =>
              void onToggleVariants(event.currentTarget.checked)
            }
            disabled={busy}
            className="size-5 accent-primary"
          />
        </label>
        {hasVariantsSwitch && (
          <div className="mt-6 space-y-4 border-t border-border pt-5">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("form.options_hint")}
            </p>
            <ProductOptionsManager
              options={variantOptions}
              onChange={setVariantOptions}
              disabled={busy}
            />
          </div>
        )}
      </Card>

      {hasVariantsSwitch && hasVariants && (
        <Card title={`${t("form.variants_label")} (${variantRows.length})`}>
          <div className="space-y-5">
            {errors.variantRowsSku && (
              <p className="flex items-center gap-1 text-xs font-bold text-destructive">
                <AlertCircle size={12} />
                {errors.variantRowsSku}
              </p>
            )}
            <p className="text-xs font-semibold text-muted-foreground">
              {t("form.variants_hint")}
            </p>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <span className="me-1 self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {t("form.bulk_fill")}:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={bulkPrice}
                  onChange={(event) =>
                    setBulkPrice(event.currentTarget.value)
                  }
                  placeholder={t("form.bulk_price_placeholder")}
                  className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-xs font-bold"
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => {
                    const value = Number(bulkPrice);
                    if (value > 0)
                      setVariantRows((prev) =>
                        prev.map((row) => ({ ...row, price: String(value) })),
                      );
                  }}
                >
                  {t("form.bulk_price_apply")}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  value={bulkSkuPrefix}
                  onChange={(event) =>
                    setBulkSkuPrefix(event.currentTarget.value)
                  }
                  placeholder={t("form.bulk_sku_placeholder")}
                  className="h-8 w-28 rounded-lg border border-border bg-card px-2 font-mono text-[11px] font-bold"
                  disabled={busy}
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => {
                    const prefix = bulkSkuPrefix.trim();
                    if (prefix) {
                      setVariantRows((prev) =>
                        prev.map((row, i) => ({
                          ...row,
                          sku: `${prefix}-${String(i + 1).padStart(3, "0")}`,
                        })),
                      );
                      setErrors((prev) => ({ ...prev, variantRowsSku: "" }));
                    }
                  }}
                >
                  {t("form.bulk_sku_auto")}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={bulkStock}
                  onChange={(event) =>
                    setBulkStock(event.currentTarget.value)
                  }
                  placeholder={t("form.bulk_stock_placeholder")}
                  className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-xs font-bold"
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => {
                    if (bulkStock !== "" && !Number.isNaN(Number(bulkStock)))
                      setVariantRows((prev) =>
                        prev.map((row) => ({
                          ...row,
                          inventory: String(Number(bulkStock)),
                        })),
                      );
                  }}
                >
                  {t("form.bulk_stock_apply")}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <div
                className={showImageCol ? "min-w-[800px]" : "min-w-[680px]"}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">
                        {t("form.variant_label")}
                      </TableHead>
                      <TableHead className="text-start">
                        {t("form.variant_price")} ({common("currency.symbol")}
                        )
                      </TableHead>
                      <TableHead className="text-start">
                        {t("form.variant_sku")} *
                      </TableHead>
                      <TableHead className="text-start">
                        {t("form.variant_stock")}
                      </TableHead>
                      <TableHead className="text-start">
                        {t("form.variant_threshold")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("form.variant_active")}
                      </TableHead>
                      {showImageCol && (
                        <TableHead className="text-center">
                          {t("form.variant_image")}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantRows.map((row, i) => (
                      <TableRow key={row.key} className="hover:bg-muted/20">
                        <TableCell>
                          <p className="text-[13px] font-bold text-foreground">
                            {row.key}
                          </p>
                          {row.existingId && (
                            <span className="text-[9px] font-bold uppercase tracking-tighter text-violet-600">
                              {t("form.variant_saved_badge")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            value={row.price}
                            onChange={(event) =>
                              updateVariantRow(
                                i,
                                "price",
                                event.currentTarget.value,
                              )
                            }
                            className="h-9 w-28 rounded-lg border border-border bg-card px-2 text-xs font-bold tabular-nums"
                            disabled={busy}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            value={row.sku}
                            onChange={(event) => {
                              updateVariantRow(
                                i,
                                "sku",
                                event.currentTarget.value,
                              );
                              setErrors((prev) => ({
                                ...prev,
                                variantRowsSku: "",
                              }));
                            }}
                            placeholder={t("form.sku_placeholder")}
                            className="h-9 w-28 rounded-lg border border-border bg-card px-2 font-mono text-[11px] font-bold"
                            disabled={busy}
                            dir="ltr"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            value={row.inventory}
                            onChange={(event) =>
                              updateVariantRow(
                                i,
                                "inventory",
                                event.currentTarget.value,
                              )
                            }
                            className="h-9 w-20 rounded-lg border border-border bg-card px-2 text-xs font-bold tabular-nums"
                            disabled={busy}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            value={row.lowStockThreshold}
                            onChange={(event) =>
                              updateVariantRow(
                                i,
                                "lowStockThreshold",
                                event.currentTarget.value,
                              )
                            }
                            className="h-9 w-20 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 text-xs font-bold tabular-nums"
                            disabled={busy}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={row.active}
                            onChange={(event) =>
                              updateVariantRow(
                                i,
                                "active",
                                event.currentTarget.checked,
                              )
                            }
                            disabled={busy}
                            className="size-5 accent-primary"
                          />
                        </TableCell>
                        {showImageCol && (
                          <TableCell className="text-center">
                            {row.imageId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  updateVariantImageId(i, null);
                                  setOpenImagePickerRow(null);
                                }}
                                className="grid size-10 place-items-center overflow-hidden rounded-lg border-2 border-primary"
                              >
                                <img
                                  src={
                                    existingImages.find(
                                      (img) => img.id === row.imageId,
                                    )?.src ?? ""
                                  }
                                  alt=""
                                  className="size-full object-cover"
                                />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenImagePickerRow(
                                    openImagePickerRow === i ? null : i,
                                  )
                                }
                                className="mx-auto grid size-10 place-items-center rounded-lg border-2 border-dashed border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
                                aria-label={t("form.variant_image_select")}
                              >
                                +
                              </button>
                            )}
                            {openImagePickerRow === i && (
                              <div className="absolute z-10 mt-2 space-y-2 rounded-lg border border-border bg-card p-2 shadow-lg">
                                <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                  {t("form.variant_image_select")}
                                </p>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {existingImages.map((img) => (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => {
                                        updateVariantImageId(
                                          i,
                                          row.imageId === img.id
                                            ? null
                                            : img.id,
                                        );
                                        setOpenImagePickerRow(null);
                                      }}
                                      className={`size-14 overflow-hidden rounded-lg border-2 ${
                                        row.imageId === img.id
                                          ? "border-primary shadow-md"
                                          : "border-transparent opacity-70 hover:opacity-100"
                                      }`}
                                    >
                                      <img
                                        src={img.src}
                                        alt=""
                                        className="size-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
