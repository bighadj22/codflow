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

interface ApiLikeError {
  code?: string;
  status?: number;
  context?: Record<string, unknown>;
}

function asApiError(cause: unknown): ApiLikeError | null {
  if (!cause || typeof cause !== "object") return null;
  const candidate = cause as ApiLikeError;
  return typeof candidate.code === "string" ? candidate : null;
}

export function productErrorMessage(cause: unknown, t: (key: string) => string) {
  const api = asApiError(cause);
  const code = api?.code ?? "";
  const context = api?.context;

  if (code === "PRODUCT_NOT_FOUND") return t("error_not_found");
  if (code === "PRODUCT_HAS_ORDERS") return t("error_delete_has_orders");
  if (code === "INSUFFICIENT_STOCK") return t("error_insufficient_stock");

  if (code === "DUPLICATE_SKU") {
    const sku = typeof context?.sku === "string" ? context.sku : null;
    return sku
      ? t("error_duplicate_sku_named").replace("{sku}", sku)
      : t("error_duplicate_sku");
  }

  if (code === "VALIDATION_FAILED") {
    const fields = Array.isArray(context?.fields) ? context!.fields : [];
    const lines = fields
      .map((field) => {
        const entry = field as { path?: string; message?: string };
        return entry.path ? `${entry.path}: ${entry.message ?? ""}` : entry.message ?? "";
      })
      .filter(Boolean);
    return lines.length
      ? `${t("error_validation")} — ${lines.join(" · ")}`
      : t("error_validation");
  }

  if (code === "INTERNAL_SERVER_ERROR" || (api?.status ?? 0) >= 500) {
    const requestId =
      typeof context?.requestId === "string" ? context.requestId : null;
    return requestId
      ? t("error_unexpected_id").replace("{id}", requestId)
      : t("error_generic");
  }

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

export type StockGroup = ReturnType<typeof groupStockByProduct>[number];

export type StockSortKey = "inventory" | "name" | "updatedAt";

export const STOCK_SORT_KEYS: StockSortKey[] = ["inventory", "name", "updatedAt"];

export function parseStockSortKey(value: string | null | undefined): StockSortKey {
  return STOCK_SORT_KEYS.includes(value as StockSortKey) ? (value as StockSortKey) : "inventory";
}

export function filterStockItems(items: StockAlertItem[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    `${item.productName} ${item.variantLabel ?? ""} ${item.sku ?? ""}`.toLocaleLowerCase().includes(q),
  );
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function compareStockItems(left: StockAlertItem, right: StockAlertItem, key: StockSortKey) {
  if (key === "inventory") return left.inventory - right.inventory;
  if (key === "updatedAt") return compareText(left.updatedAt, right.updatedAt);
  return compareText(
    `${left.productName} ${left.variantLabel ?? ""}`,
    `${right.productName} ${right.variantLabel ?? ""}`,
  );
}

export function sortStockItems(items: StockAlertItem[], key: StockSortKey, direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => sign * compareStockItems(left, right, key));
}

export function stockGroupInventory(group: StockGroup) {
  return group.items.reduce((total, item) => total + item.inventory, 0);
}

/** Most recent write across the group's SKUs — what "sort by date" ranks a product on. */
export function stockGroupUpdatedAt(group: StockGroup) {
  return group.items.reduce((latest, item) => (item.updatedAt > latest ? item.updatedAt : latest), "");
}

/** Sorts the products and, inside each one, its variant rows by the same key. */
export function sortStockGroups(groups: StockGroup[], key: StockSortKey, direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;
  return groups
    .map((group) => ({ ...group, items: sortStockItems(group.items, key, direction) }))
    .sort((left, right) => {
      if (key === "inventory") return sign * (stockGroupInventory(left) - stockGroupInventory(right));
      if (key === "updatedAt") return sign * compareText(stockGroupUpdatedAt(left), stockGroupUpdatedAt(right));
      return sign * compareText(left.productName, right.productName);
    });
}

export function movementIsStockIn(type: StockMovement["type"]) {
  return ["PURCHASE", "ADJUSTMENT_ADD", "ORDER_CANCELLED", "ORDER_RETURNED"].includes(type);
}

/** Compact row-sized date for the stock table — "15 Jan 2025". */
export function formatStockDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`, { year: "numeric", month: "short", day: "numeric" }).format(date);
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
