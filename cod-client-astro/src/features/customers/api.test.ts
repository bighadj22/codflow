import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerOrders,
  listCustomers,
  updateCustomer,
} from "./api";

describe("customer API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("always sends explicit pagination and encodes list filters", async () => {
    await listCustomers({ limit: 25, offset: 50, search: "Ahmed Benali", wilayaId: 16, groupId: "group/1", tagId: "tag 1" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/customers?limit=25&offset=50&search=Ahmed+Benali&wilayaId=16&groupId=group%2F1&tagId=tag+1");
  });

  it("uses the customer CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "customer/1" } });
    await createCustomer({ name: "Ahmed", phone: "0551234567", wilayaId: 16, communeId: "c-16-001" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customers", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"Ahmed"') }));
    await updateCustomer("customer/1", { phone2: null });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customers/customer%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ phone2: null }) }));
    await deleteCustomer("customer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customers/customer%2F1", { method: "DELETE" });
  });

  it("unwraps detail and order-history envelopes", async () => {
    seam.apiFetch.mockResolvedValueOnce({ success: true, data: { id: "customer/1" } }).mockResolvedValueOnce({ success: true, data: [{ id: "order-1" }] });
    await expect(getCustomer("customer/1")).resolves.toEqual({ id: "customer/1" });
    await expect(getCustomerOrders("customer/1")).resolves.toEqual([{ id: "order-1" }]);
    expect(seam.apiFetch.mock.calls[1]?.[0]).toBe("/api/customers/customer%2F1/orders");
  });
});
