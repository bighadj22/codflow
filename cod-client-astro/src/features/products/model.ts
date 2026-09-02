import type { Product, ProductStatus, StockAlertItem, StockMovement, VariantOption, VariantOptionFormState } from "./types";

export type ProductSortKey = "name" | "price" | "variantsCount" | "totalInventory" | "reviewCount" | "createdAt";

export type ProductRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "stock" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export interface ProductFilters {
  query: string;
  category: string;
  status: ProductStatus | "all";
}

export const PRODUCT_STATUSES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

export function parseProductStatus(value: string | undefined): ProductStatus | undefined {
  return PRODUCT_STATUSES.includes(value as ProductStatus) ? (value as ProductStatus) : undefined;
}

export function productStatusLabel(status: ProductStatus, t: (key: string) => string) {
  return t(`status_options.${status.toLocaleLowerCase()}`);
}

export function productStockTone(product: Pick<Product, "trackInventory" | "totalInventory" | "inventory">) {
  const total = product.totalInventory ?? product.inventory ?? 0;
  if (!product.trackInventory) return "none" as const;
  if (total === 0) return "out" as const;
  return "ok" as const;
}

export function filterProducts(products: Product[], filters: ProductFilters) {
  const q = filters.query.trim().toLocaleLowerCase();
  return products.filter((product) => {
    if (filters.category !== "all" && product.categoryId !== filters.category) return false;
    if (filters.status !== "all" && product.status !== filters.status) return false;
    if (q && `${product.name} ${product.sku ?? ""} ${product.handle}`.toLocaleLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

export function sortProducts(products: Product[], key: ProductSortKey, direction: "asc" | "desc") {
  return [...products].sort((left, right) => {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateProducts(products: Product[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return products.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function parseProductRoute(pathname: string): ProductRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/products") return { kind: "list" };
  if (path === "/products/new") return { kind: "new" };
  if (path === "/products/stock") return { kind: "stock" };
  const match = path.match(/^\/products\/([^/]+)(\/edit)?$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new" || id === "stock") return { kind: "unknown" };
    return match[2] ? { kind: "edit", id } : { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function productErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "PRODUCT_NOT_FOUND") return t("error_not_found");
  if (code === "PRODUCT_HAS_ORDERS") return t("error_delete_has_orders");
  if (code === "DUPLICATE_SKU") return t("error_duplicate_sku");
  if (code === "INSUFFICIENT_STOCK") return t("error_insufficient_stock");
  return t("error_generic");
}

export function generateCombinations(options: VariantOptionFormState[]): Array<{ key: string; variations: Record<string, string> }> {
  const valid = options.filter((option) => option.name.trim() && option.values.some((value) => value.value.trim()));
  if (!valid.length) return [];
  let result: Record<string, string>[] = [{}];
  for (const option of valid) {
    const values = option.values.filter((value) => value.value.trim());
    result = result.flatMap((existing) => values.map((value) => ({ ...existing, [option.name]: value.value })));
  }
  return result.map((variations) => ({ key: Object.values(variations).join(" / "), variations }));
}

export function variantLabel(variations: Record<string, string>) {
  return Object.entries(variations).map(([, value]) => value).join(" / ");
}

export function toSlug(name: string) {
  return name.toLocaleLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
}

export function calcMargin(price: string, cost: string) {
  const base = Number(price);
  const costValue = Number(cost);
  if (!base || !costValue || costValue >= base) return null;
  return Math.round(((base - costValue) / base) * 100);
}

export function formatMoneyValue(amount: number, locale: "ar" | "en" | "fr", currency = "DA") {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(amount)} ${currency}`;
}

export function stockAlertTone(item: StockAlertItem): "out" | "low" | "ok" {
  if (item.isOutOfStock) return "out";
  if (item.inventory <= item.lowStockThreshold) return "low";
  return "ok";
}

export function groupStockByProduct(items: StockAlertItem[]) {
  const map = new Map<string, { productId: string; productName: string; items: StockAlertItem[] }>();
  for (const item of items) {
    const existing = map.get(item.productId);
    if (existing) existing.items.push(item);
    else map.set(item.productId, { productId: item.productId, productName: item.productName, items: [item] });
  }
  return Array.from(map.values());
}

export function movementIsStockIn(type: StockMovement["type"]) {
  return ["PURCHASE", "ADJUSTMENT_ADD", "ORDER_CANCELLED", "ORDER_RETURNED"].includes(type);
}

export function formatProductDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function apiVariantOptions(options: VariantOptionFormState[]): VariantOption[] {
  return options
    .filter((option) => option.name.trim())
    .map((option) => ({
      name: option.name.trim(),
      values: option.values.filter((value) => value.value.trim()).map((value) => ({ value: value.value.trim(), hexColor: value.hexColor || null })),
    }));
}
