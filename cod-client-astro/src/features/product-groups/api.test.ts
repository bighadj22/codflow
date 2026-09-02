import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import {
  createProductGroup,
  deleteProductGroup,
  getProductGroup,
  getPresignedUploadUrl,
  listProductGroups,
  updateProductGroup,
} from "./api";

describe("product group API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("encodes list filters and omits empty query strings", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "cat/1" }] });
    await listProductGroups({ search: "Electronics", parentId: "cat/1" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/product-groups?search=Electronics&parentId=cat%2F1");
    await expect(listProductGroups()).resolves.toEqual([{ id: "cat/1" }]);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/product-groups");
  });

  it("uses the group CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "cat/1" } });
    await createProductGroup({ name: "Electronics" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/product-groups", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"Electronics"') }));
    await updateProductGroup("cat/1", { description: "New" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/product-groups/cat%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ description: "New" }) }));
    await deleteProductGroup("cat/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/product-groups/cat%2F1", { method: "DELETE" });
  });

  it("unwraps detail and presign envelopes", async () => {
    seam.apiFetch.mockResolvedValueOnce({ success: true, data: { id: "cat/1" } });
    await expect(getProductGroup("cat/1")).resolves.toEqual({ id: "cat/1" });
    expect(seam.apiFetch.mock.calls[0]?.[0]).toBe("/api/product-groups/cat%2F1");
    seam.apiFetch.mockResolvedValueOnce({ success: true, data: { presignedUrl: "https://example.com/x", key: "k", publicUrl: "https://cdn/x" } });
    await expect(getPresignedUploadUrl("image/jpeg")).resolves.toEqual({ presignedUrl: "https://example.com/x", key: "k", publicUrl: "https://cdn/x" });
    expect(seam.apiFetch.mock.calls[1]?.[0]).toBe("/api/images/presign");
  });
});
