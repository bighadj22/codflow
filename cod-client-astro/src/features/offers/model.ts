import type { Offer, OfferDiscountType, OfferStatus } from "./types";

export type OfferSortKey = "name" | "status" | "createdAt" | "triggerQuantity";

export type OfferRoute =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  | { kind: "unknown" };

export interface OfferFilters {
  query: string;
  status: OfferStatus | "all";
  type: OfferDiscountType | "all";
}

export const OFFER_STATUSES: OfferStatus[] = ["active", "inactive"];
export const OFFER_TYPES: OfferDiscountType[] = ["free", "free_shipping"];

export function parseOfferStatus(value: string | undefined): OfferStatus | undefined {
  return OFFER_STATUSES.includes(value as OfferStatus) ? (value as OfferStatus) : undefined;
}

export function parseOfferType(value: string | undefined): OfferDiscountType | undefined {
  return OFFER_TYPES.includes(value as OfferDiscountType) ? (value as OfferDiscountType) : undefined;
}

export function filterOffers(offers: Offer[], filters: OfferFilters) {
  const q = filters.query.trim().toLocaleLowerCase();
  return offers.filter((offer) => {
    if (filters.status !== "all" && offer.status !== filters.status) return false;
    if (filters.type !== "all" && offer.discountType !== filters.type) return false;
    if (q && `${offer.name} ${offer.triggerProduct?.name ?? ""} ${offer.rewardProduct?.name ?? ""}`.toLocaleLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

export function sortOffers(offers: Offer[], key: OfferSortKey, direction: "asc" | "desc") {
  return [...offers].sort((left, right) => {
    const leftValue = left[key] ?? "";
    const rightValue = right[key] ?? "";
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateOffers(offers: Offer[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return offers.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

export function offerRuleLabel(offer: Pick<Offer, "discountType" | "triggerQuantity" | "rewardQuantity">, t: (key: string) => string) {
  if (offer.discountType === "free_shipping") {
    return t("buy_x_free_shipping").replace("{x}", String(offer.triggerQuantity));
  }
  return t("buy_x_get_y").replace("{x}", String(offer.triggerQuantity)).replace("{y}", String(offer.rewardQuantity));
}

export function offerScheduleLabel(offer: Pick<Offer, "startsAt" | "endsAt">, locale: "ar" | "en" | "fr") {
  if (!offer.startsAt && !offer.endsAt) return "—";
  const fmt = (value: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  if (offer.startsAt && offer.endsAt) return `${fmt(offer.startsAt)} → ${fmt(offer.endsAt)}`;
  if (offer.startsAt) return offer.startsAt ? `من ${fmt(offer.startsAt)}` : "—";
  return `حتى ${fmt(offer.endsAt ?? "")}`;
}

export function parseOfferRoute(pathname: string): OfferRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/offers") return { kind: "list" };
  if (path === "/offers/new") return { kind: "new" };
  const match = path.match(/^\/offers\/([^/]+)$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id || id === "new") return { kind: "unknown" };
    return { kind: "edit", id };
  } catch {
    return { kind: "unknown" };
  }
}

export function offerErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "OFFER_NOT_FOUND") return t("error_not_found");
  if (code === "OFFER_EXPIRED") return t("error_expired");
  if (code === "OFFER_NOT_ACTIVE") return t("error_not_active");
  return t("error_generic");
}

export function formatOfferDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(date);
}
