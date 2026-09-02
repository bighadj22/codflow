import type {
  Driver,
  DriverOrder,
  DriverPaymentType,
  DriverStatus,
  ShippingProfile,
  ShippingRateEntry,
  ShippingRateMap,
  ShippingRule,
  VehicleType,
} from "./types";

export type DriverSortKey = "firstName" | "phone" | "status" | "compensationWilayaCount" | "totalDelivered" | "totalEarnings";

export type DriverRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "compensations"; id: string }
  | { kind: "unknown" };

export type DeliveryCompanyRoute =
  | { kind: "list" }
  | { kind: "detail"; code: string }
  | { kind: "credentials"; code: string }
  | { kind: "stopDesks"; code: string }
  | { kind: "unknown" };

export interface DriverFilters {
  query: string;
  status: DriverStatus | "all";
}

export const DRIVER_STATUSES: DriverStatus[] = ["available", "busy", "inactive"];
export const VEHICLE_TYPES: VehicleType[] = ["motorcycle", "car", "van"];

export function parseDriverStatus(value: string | undefined): DriverStatus | undefined {
  return DRIVER_STATUSES.includes(value as DriverStatus) ? (value as DriverStatus) : undefined;
}

export function driverFullName(driver: Pick<Driver, "firstName" | "lastName">) {
  return `${driver.firstName} ${driver.lastName}`.trim();
}

export function driverInitials(driver: Pick<Driver, "firstName" | "lastName">) {
  return (driver.firstName.charAt(0) + driver.lastName.charAt(0)).toUpperCase();
}

export function filterDrivers(drivers: Driver[], filters: DriverFilters) {
  const q = filters.query.trim().toLocaleLowerCase();
  return drivers.filter((driver) => {
    if (filters.status !== "all" && driver.status !== filters.status) return false;
    if (q && `${driverFullName(driver)} ${driver.phone} ${driver.phone2 ?? ""}`.toLocaleLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

export function sortDrivers(drivers: Driver[], key: DriverSortKey, direction: "asc" | "desc") {
  return [...drivers].sort((left, right) => {
    const leftValue = key === "firstName" ? driverFullName(left) : (left[key] ?? "");
    const rightValue = key === "firstName" ? driverFullName(right) : (right[key] ?? "");
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateDrivers(drivers: Driver[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return drivers.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function driverHasActiveOrders(driverId: string, orders: DriverOrder[]) {
  return orders.some((order) => order.driverId === driverId && !["delivered", "returned", "cancelled"].includes(order.status));
}

export function driverOrderCount(driverId: string, orders: DriverOrder[]) {
  return orders.filter((order) => order.driverId === driverId && !["delivered", "returned", "cancelled"].includes(order.status)).length;
}

export function parseDriverRoute(pathname: string): DriverRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/delivery/drivers") return { kind: "list" };
  if (path === "/delivery/drivers/new") return { kind: "new" };
  const match = path.match(/^\/delivery\/drivers\/([^/]+)(?:\/(edit|compensations))?$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    if (match[2] === "edit") return { kind: "edit", id };
    if (match[2] === "compensations") return { kind: "compensations", id };
    return { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function driverErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "DRIVER_NOT_FOUND") return t("error_not_found");
  if (code === "DRIVER_HAS_ACTIVE_ORDERS") return t("error_cannot_delete_with_orders");
  if (code === "DUPLICATE_PHONE") return t("error_duplicate_phone");
  if (code === "PAYMENT_ALREADY_SETTLED") return t("error_already_settled");
  if (code === "ORDER_NOT_FOUND") return t("error_order_not_found");
  return t("error_generic");
}

export function formatDeliveryMoney(amount: number | null | undefined, locale: "ar" | "en" | "fr") {
  if (amount == null) return "-";
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(amount)} DA`;
}

export function formatDeliveryDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(date);
}

export function settlementLabel(type: DriverPaymentType, t: (key: string) => string) {
  return t(`payments.type_${type}`);
}

export function parseDeliveryCompanyRoute(pathname: string): DeliveryCompanyRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/delivery/companies") return { kind: "list" };
  const match = path.match(/^\/delivery\/companies\/([^/]+)(?:\/(credentials|stop-desks))?$/);
  if (!match) return { kind: "unknown" };
  try {
    const code = decodeURIComponent(match[1]);
    if (!code) return { kind: "unknown" };
    if (match[2] === "credentials") return { kind: "credentials", code };
    if (match[2] === "stop-desks") return { kind: "stopDesks", code };
    return { kind: "detail", code };
  } catch {
    return { kind: "unknown" };
  }
}

// ─── Shipping Profiles ────────────────────────────────────────────────────────

export type ShippingProfileRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export function parseShippingProfileRoute(pathname: string): ShippingProfileRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/delivery/shipping-profiles") return { kind: "list" };
  if (path === "/delivery/shipping-profiles/new") return { kind: "new" };
  const match = path.match(/^\/delivery\/shipping-profiles\/([^/]+)(?:\/(edit))?$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    if (match[2] === "edit") return { kind: "edit", id };
    return { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function defaultRateEntry(): ShippingRateEntry {
  return { homePrice: 0, stopDeskPrice: 0, homeEnabled: true, stopDeskEnabled: false };
}

export function buildRateMap(rules: ShippingRule[]): ShippingRateMap {
  const map: ShippingRateMap = {};
  for (const rule of rules) {
    map[rule.wilayaId] = {
      homePrice: rule.homePrice,
      stopDeskPrice: rule.stopDeskPrice,
      homeEnabled: rule.homeEnabled ?? true,
      stopDeskEnabled: rule.stopDeskEnabled ?? false,
    };
  }
  return map;
}

export function filterShippingProfiles(profiles: ShippingProfile[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return profiles;
  return profiles.filter(
    (profile) =>
      profile.name.toLocaleLowerCase().includes(q) ||
      (profile.notes ?? "").toLocaleLowerCase().includes(q),
  );
}

export function sortShippingProfiles(profiles: ShippingProfile[]) {
  return [...profiles].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export function paginateShippingProfiles(profiles: ShippingProfile[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return profiles.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function shippingErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "SHIPPING_PROFILE_NOT_FOUND") return t("error_not_found");
  if (code === "PROFILE_IN_USE") return t("shipping_profiles.error_profile_in_use");
  if (code === "DEFAULT_PROFILE_REQUIRED") return t("shipping_profiles.error_default_required");
  if (code === "DUPLICATE_WILAYA_RULE") return t("shipping_profiles.error_duplicate_wilaya");
  return t("error_generic");
}
