import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  addCustomerToGroup,
  createCustomerGroup,
  deleteCustomerGroup,
  getCustomerGroup,
  listCustomerGroups,
  removeCustomerFromGroup,
  updateCustomerGroup,
} from "./api";

describe("customer group API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("always sends explicit pagination and encodes search filters", async () => {
    await listCustomerGroups({ limit: 25, offset: 50, search: "VIP Clients" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/customer-groups?limit=25&offset=50&search=VIP+Clients");
  });

  it("uses the group CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "group/1" } });
    await createCustomerGroup({ name: "VIP", description: "Top buyers", color: "#6366f1" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-groups", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"VIP"') }));
    await updateCustomerGroup("group/1", { description: null });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-groups/group%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ description: null }) }));
    await deleteCustomerGroup("group/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-groups/group%2F1", { method: "DELETE" });
  });

  it("requests members on the detail call and manages memberships", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "group/1", members: [] } });
    await expect(getCustomerGroup("group/1")).resolves.toEqual({ id: "group/1", members: [] });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/customer-groups/group%2F1?members=true");
    await addCustomerToGroup("group/1", "customer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-groups/group%2F1/members", expect.objectContaining({ method: "POST", body: JSON.stringify({ customerId: "customer/1" }) }));
    await removeCustomerFromGroup("group/1", "customer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/customer-groups/group%2F1/members/customer%2F1", { method: "DELETE" });
  });
});
