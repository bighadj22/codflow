import { describe, expect, it } from "vitest";
import {
  buildRateMap,
  driverErrorMessage,
  driverFullName,
  driverHasActiveOrders,
  driverInitials,
  driverOrderCount,
  filterDrivers,
  filterShippingProfiles,
  formatDeliveryDate,
  formatDeliveryMoney,
  paginateDrivers,
  paginateShippingProfiles,
  parseDriverRoute,
  parseDriverStatus,
  parseShippingProfileRoute,
  shippingErrorMessage,
  sortDrivers,
  sortShippingProfiles,
} from "./model";
import type { Driver, DriverOrder, ShippingProfile, ShippingRule } from "./types";

const driver = (overrides: Partial<Driver> = {}): Driver => ({
  id: "driver-1",
  firstName: "Ahmed",
  lastName: "Benali",
  phone: "0551234567",
  phone2: null,
  vehicleType: "motorcycle",
  status: "available",
  compensationWilayaCount: 3,
  totalDelivered: 10,
  totalEarnings: 12000,
  pendingCash: 5000,
  totalPaid: 7000,
  notes: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const order = (overrides: Partial<DriverOrder> = {}): DriverOrder => ({
  id: "order-1",
  orderNumber: "ORD-1",
  customerName: "Salima",
  phone: "0771234567",
  wilaya: "الجزائر",
  wilayaId: 16,
  price: 9000,
  status: "ready",
  deliveryMethod: "driver",
  driverId: "driver-1",
  deliveryFee: 400,
  driverFee: 300,
  codAmount: 9400,
  codPaymentId: null,
  feePaymentId: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const t = (key: string) => key;

describe("delivery model", () => {
  it("filters drivers by query and status", () => {
    const rows = [driver(), driver({ id: "2", firstName: "Salima", lastName: "Mansouri", phone: "0771234567", status: "inactive" })];
    expect(filterDrivers(rows, { query: "benali", status: "all" }).map((item) => item.id)).toEqual(["driver-1"]);
    expect(filterDrivers(rows, { query: "", status: "inactive" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("sorts and paginates driver collections", () => {
    const rows = [driver({ id: "1", firstName: "Zed" }), driver({ id: "2", firstName: "Amel" }), driver({ id: "3", firstName: "Meriem" })];
    expect(sortDrivers(rows, "firstName", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateDrivers(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("computes active-order state from the orders batch", () => {
    expect(driverHasActiveOrders("driver-1", [order()])).toBe(true);
    expect(driverHasActiveOrders("driver-1", [order({ status: "delivered" })])).toBe(false);
    expect(driverOrderCount("driver-1", [order(), order({ id: "o2", status: "returned" })])).toBe(1);
    expect(driverFullName(driver())).toBe("Ahmed Benali");
    expect(driverInitials(driver())).toBe("AB");
  });

  it("parses only valid driver routes", () => {
    expect(parseDriverRoute("/delivery/drivers")).toEqual({ kind: "list" });
    expect(parseDriverRoute("/delivery/drivers/new/")).toEqual({ kind: "new" });
    expect(parseDriverRoute("/delivery/drivers/driver%2F1")).toEqual({ kind: "detail", id: "driver/1" });
    expect(parseDriverRoute("/delivery/drivers/driver-1/edit")).toEqual({ kind: "edit", id: "driver-1" });
    expect(parseDriverRoute("/delivery/drivers/driver-1/compensations")).toEqual({ kind: "compensations", id: "driver-1" });
    expect(parseDriverRoute("/delivery/drivers/driver-1/unknown")).toEqual({ kind: "unknown" });
    expect(parseDriverStatus("busy")).toBe("busy");
    expect(parseDriverStatus("bogus")).toBeUndefined();
  });

  it("maps business error codes and formats values", () => {
    expect(driverErrorMessage({ code: "DRIVER_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(driverErrorMessage({ code: "DRIVER_HAS_ACTIVE_ORDERS" }, t)).toBe("error_cannot_delete_with_orders");
    expect(driverErrorMessage({ code: "DUPLICATE_PHONE" }, t)).toBe("error_duplicate_phone");
    expect(driverErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(formatDeliveryMoney(9400, "en")).toBe("9,400 DA");
    expect(formatDeliveryMoney(null, "en")).toBe("-");
    expect(formatDeliveryDate("2026-08-26T00:00:00.000Z", "en")).toBe("8/26/2026");
    expect(formatDeliveryDate("not-a-date", "en")).toBe("-");
  });

  it("parses only valid shipping profile routes", () => {
    expect(parseShippingProfileRoute("/delivery/shipping-profiles")).toEqual({ kind: "list" });
    expect(parseShippingProfileRoute("/delivery/shipping-profiles/new/")).toEqual({ kind: "new" });
    expect(parseShippingProfileRoute("/delivery/shipping-profiles/profile-1")).toEqual({ kind: "detail", id: "profile-1" });
    expect(parseShippingProfileRoute("/delivery/shipping-profiles/profile%2F1/edit")).toEqual({ kind: "edit", id: "profile/1" });
    expect(parseShippingProfileRoute("/delivery/shipping-profiles/profile-1/unknown")).toEqual({ kind: "unknown" });
    expect(parseShippingProfileRoute("/delivery/drivers")).toEqual({ kind: "unknown" });
  });

  it("builds a rate map from rules with defaults for missing switches", () => {
    const rule = (overrides: Partial<ShippingRule> = {}): ShippingRule => ({
      id: "rule-1",
      profileId: "profile-1",
      wilayaId: 16,
      wilayaName: "Alger",
      wilayaNameAr: "الجزائر",
      homePrice: 400,
      stopDeskPrice: 300,
      homeEnabled: true,
      stopDeskEnabled: false,
      createdAt: "2026-08-26T00:00:00.000Z",
      ...overrides,
    });
    const map = buildRateMap([rule(), rule({ wilayaId: 31, homeEnabled: false })]);
    expect(map[16]).toEqual({ homePrice: 400, stopDeskPrice: 300, homeEnabled: true, stopDeskEnabled: false });
    expect(map[31]).toEqual({ homePrice: 400, stopDeskPrice: 300, homeEnabled: false, stopDeskEnabled: false });
  });

  it("filters, sorts and paginates shipping profiles", () => {
    const profile = (overrides: Partial<ShippingProfile> = {}): ShippingProfile => ({
      id: "profile-1",
      name: "Standard Rates",
      isDefault: false,
      notes: null,
      ruleCount: 3,
      productCount: 0,
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z",
      ...overrides,
    });
    const rows = [
      profile({ id: "1", name: "Zed" }),
      profile({ id: "2", name: "Amel", isDefault: true }),
      profile({ id: "3", name: "Meriem" }),
    ];
    expect(filterShippingProfiles(rows, "amel").map((item) => item.id)).toEqual(["2"]);
    expect(filterShippingProfiles(rows, "").map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(sortShippingProfiles(rows).map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateShippingProfiles(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("maps shipping profile business error codes", () => {
    expect(shippingErrorMessage({ code: "PROFILE_IN_USE" }, t)).toBe("shipping_profiles.error_profile_in_use");
    expect(shippingErrorMessage({ code: "DEFAULT_PROFILE_REQUIRED" }, t)).toBe("shipping_profiles.error_default_required");
    expect(shippingErrorMessage({ code: "DUPLICATE_WILAYA_RULE" }, t)).toBe("shipping_profiles.error_duplicate_wilaya");
    expect(shippingErrorMessage({ code: "SHIPPING_PROFILE_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(shippingErrorMessage(new Error("boom"), t)).toBe("error_generic");
  });
});
