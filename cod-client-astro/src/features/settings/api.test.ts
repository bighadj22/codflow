import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: seam.apiFetch }));

import { getMyStore, getPixelConfig, savePixelConfig, updateMyStore } from "./api";

describe("settings API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps the store config detail envelope", async () => {
    const store = { id: "store-1", name: "My Store" };
    seam.apiFetch.mockResolvedValue({ success: true, data: store });
    await expect(getMyStore()).resolves.toEqual(store);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/me");
  });

  it("patches the store and unwraps the updated config", async () => {
    const store = { id: "store-1", name: "Renamed" };
    seam.apiFetch.mockResolvedValue({ success: true, data: store });
    await expect(updateMyStore({ name: "Renamed", reviewsEnabled: true })).resolves.toEqual(store);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/me", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed", reviewsEnabled: true }) }));
  });

  it("reads the pixel config (null when absent) and upserts it", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: null });
    await expect(getPixelConfig()).resolves.toBeNull();
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/pixel-config");

    const config = { id: "px1", pixelId: "123", accessToken: "EAAG", testEventCode: null, enabled: true };
    seam.apiFetch.mockResolvedValue({ success: true, data: config });
    await expect(savePixelConfig({ pixelId: "123", accessToken: "EAAG", enabled: true })).resolves.toEqual(config);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/pixel-config", expect.objectContaining({ method: "POST", body: JSON.stringify({ pixelId: "123", accessToken: "EAAG", enabled: true }) }));
  });
});
