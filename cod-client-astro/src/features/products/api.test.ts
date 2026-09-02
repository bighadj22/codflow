import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  adjustProductStock,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  getProduct,
  getStockHistory,
  getStockOverview,
  listProducts,
  listVariants,
  updateProduct,
  updateVariant,
} from "./api";

describe("product API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("always sends explicit pagination and encodes list filters", async () => {
    await listProducts({ categoryId: "cat/1", status: "ACTIVE", search: "T-shirt", limit: 25, offset: 50 });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/products?limit=25&offset=50&categoryId=cat%2F1&status=ACTIVE&search=T-shirt");
  });

  it("uses the product CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "prod/1" } });
    await createProduct({ name: "T-shirt", price: 1500 });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"T-shirt"') }));
    await updateProduct("prod/1", { price: 1800 });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ price: 1800 }) }));
    await deleteProduct("prod/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1", { method: "DELETE" });
  });

  it("manages variants and stock under the product path", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "var/1" }] });
    await expect(listVariants("prod/1")).resolves.toEqual([{ id: "var/1" }]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/products/prod%2F1/variants");
    await createVariant("prod/1", { sku: "TS-RED-M" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1/variants", expect.objectContaining({ method: "POST" }));
    await updateVariant("prod/1", "var/1", { price: 1700 });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1/variants/var%2F1", expect.objectContaining({ method: "PATCH" }));
    await deleteVariant("prod/1", "var/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1/variants/var%2F1", { method: "DELETE" });
  });

  it("fetches stock overview and history with explicit pagination", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { movements: [], total: 0 } });
    await getStockHistory("prod/1", { limit: 20, offset: 40 });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1/stock/history?limit=20&offset=40");
    seam.apiFetch.mockResolvedValue({ success: true, data: { totalSkus: 3 } });
    await expect(getStockOverview()).resolves.toEqual({ totalSkus: 3 });
    seam.apiFetch.mockResolvedValue({ success: true, data: { movement: { id: "m1" }, currentInventory: 10 } });
    await adjustProductStock("prod/1", { type: "PURCHASE", delta: 5, reason: "restock" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/products/prod%2F1/stock/adjust", expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "PURCHASE", delta: 5, reason: "restock" }) }));
  });

  it("unwraps the detail envelope", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "prod/1" } });
    await expect(getProduct("prod/1")).resolves.toEqual({ id: "prod/1" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/products/prod%2F1");
  });
});
