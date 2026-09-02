import { describe, expect, it } from "vitest";
import {
  filterOffers,
  formatOfferDate,
  offerErrorMessage,
  offerRuleLabel,
  offerScheduleLabel,
  paginateOffers,
  parseOfferRoute,
  parseOfferStatus,
  parseOfferType,
  sortOffers,
} from "./model";
import type { Offer } from "./types";

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  id: "offer-1",
  name: "Buy 2 Get 1",
  status: "active",
  triggerQuantity: 2,
  rewardQuantity: 1,
  discountType: "free",
  startsAt: null,
  endsAt: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  triggerProduct: { id: "prod-1", name: "Chips", handle: "chips" },
  triggerVariant: null,
  rewardProduct: { id: "prod-2", name: "Soda", handle: "soda" },
  rewardVariant: null,
  ...overrides,
});

const t = (key: string) => key;

describe("offers model", () => {
  it("filters by query, status, and discount type", () => {
    const rows = [offer(), offer({ id: "2", name: "Free Ship", status: "inactive", discountType: "free_shipping", triggerProduct: { id: "prod-3", name: "Snacks", handle: "snacks" } })];
    expect(filterOffers(rows, { query: "chips", status: "all", type: "all" }).map((item) => item.id)).toEqual(["offer-1"]);
    expect(filterOffers(rows, { query: "", status: "inactive", type: "all" }).map((item) => item.id)).toEqual(["2"]);
    expect(filterOffers(rows, { query: "", status: "all", type: "free_shipping" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("sorts and paginates offer collections", () => {
    const rows = [offer({ id: "1", name: "Zed" }), offer({ id: "2", name: "Amel" }), offer({ id: "3", name: "Meriem" })];
    expect(sortOffers(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateOffers(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("builds rule and schedule labels", () => {
    expect(offerRuleLabel(offer(), t)).toBe("buy_x_get_y");
    expect(offerRuleLabel(offer({ discountType: "free_shipping", triggerQuantity: 3 }), t)).toBe("buy_x_free_shipping");
    expect(offerScheduleLabel(offer(), "en")).toBe("—");
    expect(offerScheduleLabel(offer({ startsAt: "2026-08-26T00:00:00.000Z" }), "en")).toBe("من 08/26/2026");
    expect(offerScheduleLabel(offer({ startsAt: "2026-08-26T00:00:00.000Z", endsAt: "2026-08-30T00:00:00.000Z" }), "en")).toBe("08/26/2026 → 08/30/2026");
  });

  it("parses only valid offer routes and enums", () => {
    expect(parseOfferRoute("/offers")).toEqual({ kind: "list" });
    expect(parseOfferRoute("/offers/new/")).toEqual({ kind: "new" });
    expect(parseOfferRoute("/offers/offer%2F1")).toEqual({ kind: "edit", id: "offer/1" });
    expect(parseOfferRoute("/offers/offer-1/extra")).toEqual({ kind: "unknown" });
    expect(parseOfferStatus("active")).toBe("active");
    expect(parseOfferStatus("bogus")).toBeUndefined();
    expect(parseOfferType("free_shipping")).toBe("free_shipping");
    expect(parseOfferType("bogus")).toBeUndefined();
  });

  it("maps business error codes and formats dates", () => {
    expect(offerErrorMessage({ code: "OFFER_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(offerErrorMessage({ code: "OFFER_EXPIRED" }, t)).toBe("error_expired");
    expect(offerErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(formatOfferDate("2026-08-26T00:00:00.000Z", "en")).toBe("8/26/2026");
    expect(formatOfferDate("not-a-date", "en")).toBe("-");
  });
});
