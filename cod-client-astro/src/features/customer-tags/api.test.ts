import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  assignCustomerTag,
  createCustomerTag,
  deleteCustomerTag,
  getCustomerTag,
  listCustomerTags,
  unassignCustomerTag,
  updateCustomerTag,
} from "./api";

describe("customer tag API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("always sends explicit pagination and encodes search filters", async () => {
    await listCustomerTags({ limit: 25, offset: 50, search: "VIP" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/customer-tags?limit=25&offset=50&search=VIP");
  });

  it("uses the tag CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "tag/1" } });
    await createCustomerTag({ name: "VIP", color: "#64748b" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-tags", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"VIP"') }));
    await updateCustomerTag("tag/1", { color: "#f97316" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-tags/tag%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ color: "#f97316" }) }));
    await deleteCustomerTag("tag/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-tags/tag%2F1", { method: "DELETE" });
  });

  it("requests assigned customers on the detail call and manages assignments", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "tag/1", customers: [] } });
    await expect(getCustomerTag("tag/1")).resolves.toEqual({ id: "tag/1", customers: [] });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/customer-tags/tag%2F1?customers=true");
    await assignCustomerTag("tag/1", "customer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-tags/tag%2F1/assignments", expect.objectContaining({ method: "POST", body: JSON.stringify({ customerId: "customer/1" }) }));
    await unassignCustomerTag("tag/1", "customer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-tags/tag%2F1/assignments/customer%2F1", { method: "DELETE" });
  });
});
