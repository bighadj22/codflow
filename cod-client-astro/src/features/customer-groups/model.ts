import type { CustomerGroup, CustomerGroupMember } from "./types";

export type CustomerGroupSortKey = "name" | "memberCount" | "createdAt";

export type CustomerGroupRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export function filterGroups(groups: CustomerGroup[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return groups;
  return groups.filter((group) => `${group.name} ${group.description ?? ""}`.toLocaleLowerCase().indexOf(q) !== -1);
}

export function sortGroups(groups: CustomerGroup[], key: CustomerGroupSortKey, direction: "asc" | "desc") {
  return [...groups].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateGroups(groups: CustomerGroup[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return groups.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function groupCanDelete(group: Pick<CustomerGroup, "memberCount">) {
  return group.memberCount === 0;
}

export function filterMembers(members: CustomerGroupMember[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return members;
  return members.filter((member) => `${member.name} ${member.phone}`.toLocaleLowerCase().indexOf(q) !== -1);
}

export function filterAvailableCustomers(members: CustomerGroupMember[], customers: Array<{ id: string; name: string; phone: string }>, query: string) {
  const memberIds = new Set(members.map((member) => member.id));
  const q = query.trim().toLocaleLowerCase();
  return customers.filter((customer) => {
    if (memberIds.has(customer.id)) return false;
    if (!q) return true;
    return `${customer.name} ${customer.phone}`.toLocaleLowerCase().indexOf(q) !== -1;
  });
}

export function parseCustomerGroupRoute(pathname: string): CustomerGroupRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/customer-groups") return { kind: "list" };
  if (path === "/customer-groups/new") return { kind: "new" };
  const match = path.match(/^\/customer-groups\/([^/]+)(\/edit)?$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    return match[2] ? { kind: "edit", id } : { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function customerGroupErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "GROUP_HAS_MEMBERS") return t("error_group_has_members");
  if (code === "DUPLICATE_GROUP_NAME") return t("error_duplicate_name");
  if (code === "GROUP_NOT_FOUND") return t("error_not_found");
  return t("error_generic");
}

export function formatGroupDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(date);
}
