import type { CustomerTag, CustomerTagAssigned } from "./types";

export type CustomerTagSortKey = "name" | "assignmentCount" | "createdAt";

export type CustomerTagRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export function filterTags(tags: CustomerTag[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return tags;
  return tags.filter((tag) => tag.name.toLocaleLowerCase().indexOf(q) !== -1);
}

export function sortTags(tags: CustomerTag[], key: CustomerTagSortKey, direction: "asc" | "desc") {
  return [...tags].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateTags(tags: CustomerTag[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return tags.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function tagCanDelete(tag: Pick<CustomerTag, "assignmentCount">) {
  return tag.assignmentCount === 0;
}

export function filterAssigned(customers: CustomerTagAssigned[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return customers;
  return customers.filter((customer) => `${customer.name} ${customer.phone}`.toLocaleLowerCase().indexOf(q) !== -1);
}

export function filterAvailableCustomers(assigned: CustomerTagAssigned[], customers: Array<{ id: string; name: string; phone: string }>, query: string) {
  const assignedIds = new Set(assigned.map((customer) => customer.id));
  const q = query.trim().toLocaleLowerCase();
  return customers.filter((customer) => {
    if (assignedIds.has(customer.id)) return false;
    if (!q) return true;
    return `${customer.name} ${customer.phone}`.toLocaleLowerCase().indexOf(q) !== -1;
  });
}

export function parseCustomerTagRoute(pathname: string): CustomerTagRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/customer-tags") return { kind: "list" };
  if (path === "/customer-tags/new") return { kind: "new" };
  const match = path.match(/^\/customer-tags\/([^/]+)(\/edit)?$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    return match[2] ? { kind: "edit", id } : { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function customerTagErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "TAG_HAS_ASSIGNMENTS") return t("error_tag_has_assignments");
  if (code === "DUPLICATE_TAG_NAME") return t("error_duplicate_name");
  if (code === "TAG_NOT_FOUND") return t("error_not_found");
  return t("error_generic");
}

export function formatTagDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(date);
}
