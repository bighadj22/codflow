import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => seam);

import { createOffer, deleteOffer, getOffer, listOffers, updateOffer } from "./api";

describe("offer API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("lists offers and unwraps the envelope", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "offer/1" }] });
    await expect(listOffers()).resolves.toEqual([{ id: "offer/1" }]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/offers");
  });

  it("uses the offer CRUD methods and URL encodes IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "offer/1" } });
    await createOffer({ name: "Buy 2 Get 1", discountType: "free", triggerProductId: "prod/1", triggerQuantity: 2, rewardProductId: "prod/2", rewardQuantity: 1, status: "active" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/offers", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"Buy 2 Get 1"') }));
    await updateOffer("offer/1", { status: "inactive" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/offers/offer%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "inactive" }) }));
    await deleteOffer("offer/1");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/offers/offer%2F1", { method: "DELETE" });
  });

  it("unwraps the detail envelope", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { id: "offer/1" } });
    await expect(getOffer("offer/1")).resolves.toEqual({ id: "offer/1" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/offers/offer%2F1");
  });
});
