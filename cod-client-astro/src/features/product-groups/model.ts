import type { ProductCategory } from "./types";

export type ProductGroupSortKey = "name" | "productsCount" | "createdAt";

export type ProductGroupRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export function filterGroups(groups: ProductCategory[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return groups;
  return groups.filter((group) => `${group.name} ${group.slug}`.toLocaleLowerCase().indexOf(q) !== -1);
}

export function sortGroups(groups: ProductCategory[], key: ProductGroupSortKey, direction: "asc" | "desc") {
  return [...groups].sort((left, right) => {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateGroups(groups: ProductCategory[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return groups.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function groupCanDelete(group: Pick<ProductCategory, "productsCount">) {
  return (group.productsCount ?? 0) === 0;
}

export function parseProductGroupRoute(pathname: string): ProductGroupRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/product-groups") return { kind: "list" };
  if (path === "/product-groups/new") return { kind: "new" };
  const match = path.match(/^\/product-groups\/([^/]+)\/edit$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    return { kind: "edit", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function productGroupErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "PRODUCT_GROUP_NOT_FOUND") return t("error_not_found");
  if (code === "PRODUCT_GROUP_HAS_PRODUCTS") return t("form.cannot_delete");
  return t("error_generic");
}

export function toSlug(name: string) {
  return name.toLocaleLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
}

export function formatGroupDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`, { year: "numeric", month: "long", day: "numeric" }).format(date);
}
