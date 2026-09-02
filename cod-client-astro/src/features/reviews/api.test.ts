import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import { deleteReview, listReviews, updateReviewStatus } from "./api";

describe("review API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [], total: 0, pendingCount: 0 });
  });

  it("always sends explicit pagination and encodes status filters", async () => {
    await listReviews({ status: "pending", limit: 20, offset: 40 });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/reviews?limit=20&offset=40&status=pending");
  });

  it("unwraps the list envelope into rows/total/pendingCount", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "rev-1" }], total: 7, pendingCount: 2 });
    await expect(listReviews({})).resolves.toEqual({ rows: [{ id: "rev-1" }], total: 7, pendingCount: 2 });
  });

  it("updates review status and deletes with URL-encoded ids", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "rev/1", status: "approved" } });
    await updateReviewStatus("rev/1", "approved");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/reviews/rev%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "approved" }) }));
    await deleteReview("rev/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/reviews/rev%2F1", { method: "DELETE" });
  });
});
