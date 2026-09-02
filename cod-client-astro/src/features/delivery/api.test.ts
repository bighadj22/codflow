import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn(), listOrders: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: seam.apiFetch }));
vi.mock("@/features/orders/api", () => ({ listOrders: seam.listOrders }));

import {
  createDriver,
  createDriverPayment,
  createShippingProfile,
  deleteCommuneOverride,
  deleteDriver,
  deleteDriverCompensation,
  deleteShippingProfile,
  getDriver,
  getShippingProfile,
  listDriverCompensations,
  listDriverPayments,
  listDrivers,
  listPendingSettlementOrders,
  listShippingProfiles,
  listShippingRuleCommunes,
  reconcileCompanyOrders,
  setCommuneOverride,
  setDriverCompensation,
  setShippingRules,
  testCompanyConnection,
  updateDriver,
  updateDriverStatus,
  updateShippingProfile,
} from "./api";

describe("driver API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
    seam.listOrders.mockResolvedValue({ success: true, data: [], count: 0 });
  });

  it("always sends explicit pagination and encodes list filters", async () => {
    await listDrivers({ status: "available", search: "Ahmed", limit: 25, offset: 50 });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/drivers?limit=25&offset=50&status=available&search=Ahmed");
  });

  it("uses the driver CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "driver/1" } });
    await createDriver({ firstName: "Ahmed", lastName: "Benali", phone: "0551234567" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers", expect.objectContaining({ method: "POST", body: expect.stringContaining('"firstName":"Ahmed"') }));
    await updateDriver("driver/1", { phone2: null });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers/driver%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ phone2: null }) }));
    await updateDriverStatus("driver/1", "busy");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers/driver%2F1/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "busy" }) }));
    await deleteDriver("driver/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers/driver%2F1", { method: "DELETE" });
  });

  it("manages compensations and payments", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ wilayaId: 16, feePerDelivery: 300 }] });
    await expect(listDriverCompensations("driver/1")).resolves.toEqual([{ wilayaId: 16, feePerDelivery: 300 }]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/drivers/driver%2F1/compensations");
    await setDriverCompensation("driver/1", 16, 350);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers/driver%2F1/compensations/16", expect.objectContaining({ method: "PUT", body: JSON.stringify({ feePerDelivery: 350 }) }));
    await deleteDriverCompensation("driver/1", 16);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/drivers/driver%2F1/compensations/16", { method: "DELETE" });
    await createDriverPayment({ driverId: "driver/1", type: "cod_remittance", orderIds: ["o1"], notes: "batch" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/driver-payments", expect.objectContaining({ method: "POST", body: JSON.stringify({ driverId: "driver/1", type: "cod_remittance", orderIds: ["o1"], notes: "batch" }) }));
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "p1" }] });
    await expect(listDriverPayments("driver/1")).resolves.toEqual([{ id: "p1" }]);
    await expect(listPendingSettlementOrders("driver/1")).resolves.toEqual([{ id: "p1" }]);
  });

  it("unwraps the detail envelope and pages through orders", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "driver/1" } });
    await expect(getDriver("driver/1")).resolves.toEqual({ id: "driver/1" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/drivers/driver%2F1");
  });
});

describe("shipping profile API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("lists, reads, creates, updates and deletes profiles with URL-encoded IDs", async () => {
    await expect(listShippingProfiles()).resolves.toEqual([]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/shipping-profiles");

    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "profile/1", rules: [] } });
    await expect(getShippingProfile("profile/1")).resolves.toEqual({ id: "profile/1", rules: [] });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/shipping-profiles/profile%2F1");

    await createShippingProfile({ name: "Standard", isDefault: true });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Standard", isDefault: true }) }));

    await updateShippingProfile("profile/1", { name: "Rates" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles/profile%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Rates" }) }));

    await deleteShippingProfile("profile/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles/profile%2F1", { method: "DELETE" });
  });

  it("replaces rules and manages commune overrides", async () => {
    await setShippingRules("profile/1", [{ wilayaId: 16, homePrice: 400, stopDeskPrice: 300, homeEnabled: true, stopDeskEnabled: true }]);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles/profile%2F1/rules", expect.objectContaining({ method: "PUT", body: JSON.stringify({ rules: [{ wilayaId: 16, homePrice: 400, stopDeskPrice: 300, homeEnabled: true, stopDeskEnabled: true }] }) }));

    seam.apiFetch.mockResolvedValue({ success: true, data: [{ communeId: "c1", hasOverride: false }] });
    await expect(listShippingRuleCommunes("profile/1", 16)).resolves.toEqual([{ communeId: "c1", hasOverride: false }]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/shipping-profiles/profile%2F1/rules/16/communes");

    await setCommuneOverride("profile/1", 16, "c1", { homePrice: 500 });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles/profile%2F1/rules/16/communes/c1", expect.objectContaining({ method: "PUT", body: JSON.stringify({ homePrice: 500 }) }));

    await deleteCommuneOverride("profile/1", 16, "c1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/shipping-profiles/profile%2F1/rules/16/communes/c1", { method: "DELETE" });
  });
});

describe("carrier connection API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs test-connection and unwraps the check result", async () => {
    const check = {
      companyId: "comp/1",
      companyName: "DHD Livraison",
      companyCode: "dhd_ecotrack",
      ok: true,
      code: "valid",
      message: "Token is valid",
      details: { servedWilayaIds: [1, 16], servedWilayaCount: 2 },
    };
    seam.apiFetch.mockResolvedValue({ success: true, data: check });

    await expect(testCompanyConnection("comp/1")).resolves.toEqual(check);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/delivery-companies/comp%2F1/test-connection", { method: "POST" });
  });

  it("POSTs reconcile-orders with an optional maxPages query", async () => {
    const summary = {
      pagesFetched: 2, ordersSeen: 80, updated: 5, unchanged: 70,
      notFound: 3, skippedUnmapped: 2, unmappedSamples: ["mystery"],
      morePagesRemain: false,
    };
    seam.apiFetch.mockResolvedValue({ success: true, data: summary });

    await expect(reconcileCompanyOrders("comp/1")).resolves.toEqual(summary);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/delivery-companies/comp%2F1/reconcile-orders", { method: "POST" });

    await reconcileCompanyOrders("comp/1", 5);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/delivery-companies/comp%2F1/reconcile-orders?maxPages=5", { method: "POST" });
  });
});
