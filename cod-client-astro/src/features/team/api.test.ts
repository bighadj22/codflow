import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: seam.apiFetch }));

import {
  createTeamMember,
  grantTeamMemberScope,
  listAllTeamMembers,
  listTeamMembers,
  listUserActivityLogs,
  revokeTeamMemberScope,
  rotateTeamMemberApiKey,
  updateTeamMember,
  updateTeamMemberRole,
} from "./api";

describe("team API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("always sends explicit pagination and encodes list filters", async () => {
    await listTeamMembers({ role: "staff", search: "Ahmed", limit: 25, offset: 50 });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/users?limit=25&offset=50&role=staff&search=Ahmed");
  });

  it("pages through every member for the list view", async () => {
    const member = { id: "m1", name: "Ahmed", email: "a@b.dz", role: "staff", status: "active", createdAt: "2026-08-26T00:00:00.000Z", updatedAt: "2026-08-26T00:00:00.000Z", scopes: [] };
    const fullPage = Array.from({ length: 50 }, (_, index) => ({ ...member, id: `m${index}` }));
    seam.apiFetch
      .mockResolvedValueOnce({ success: true, data: fullPage })
      .mockResolvedValueOnce({ success: true, data: [] });
    const rows = await listAllTeamMembers();
    expect(rows.length).toBe(50);
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users?limit=50&offset=50");
  });

  it("creates a member and returns the one-time secrets plus the invite email outcome", async () => {
    seam.apiFetch.mockResolvedValue({
      success: true,
      data: { id: "m1", name: "Ahmed", email: "a@b.dz", role: "staff", status: "active", createdAt: "2026-08-26T00:00:00.000Z", updatedAt: "2026-08-26T00:00:00.000Z", scopes: ["orders:read"] },
      apiKey: "cod_123",
      tempPassword: "abc123",
      emailSent: true,
      emailError: null,
    });
    await expect(createTeamMember({ name: "Ahmed", email: "a@b.dz", role: "staff", scopes: ["orders:read"] })).resolves.toEqual({
      user: expect.objectContaining({ id: "m1" }),
      apiKey: "cod_123",
      tempPassword: "abc123",
      emailSent: true,
      emailError: null,
    });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/users", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Ahmed", email: "a@b.dz", role: "staff", scopes: ["orders:read"] }) }));
  });

  it("sends the invite email language when provided", async () => {
    seam.apiFetch.mockResolvedValue({
      success: true,
      data: { id: "m2", name: "Amina", email: "a@b.dz", role: "staff", status: "active", createdAt: "t", updatedAt: "t", scopes: [] },
      apiKey: "cod_456",
      tempPassword: "def456",
      emailSent: false,
      emailError: "out_of_credits",
    });
    await createTeamMember({ name: "Amina", email: "a@b.dz", role: "staff", language: "ar" });
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/users", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Amina", email: "a@b.dz", role: "staff", language: "ar" }),
    }));
  });

  it("updates members, roles, scopes and rotates API keys with URL-encoded IDs", async () => {
    await updateTeamMember("user/1", { status: "inactive" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users/user%2F1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "inactive" }) }));

    await updateTeamMemberRole("user/1", "admin");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users/user%2F1/role", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "admin" }) }));

    await grantTeamMemberScope("user/1", "orders:read");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users/user%2F1/scopes", expect.objectContaining({ method: "POST", body: JSON.stringify({ scope: "orders:read" }) }));

    await revokeTeamMemberScope("user/1", "orders:read");
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users/user%2F1/scopes/orders%3Aread", { method: "DELETE" });

    seam.apiFetch.mockResolvedValue({ success: true, data: { apiKey: "cod_new" } });
    await expect(rotateTeamMemberApiKey("user/1")).resolves.toEqual({ apiKey: "cod_new" });
    expect(seam.apiFetch).toHaveBeenLastCalledWith("/api/users/user%2F1/api-key/rotate", expect.objectContaining({ method: "POST" }));
  });

  it("unwraps user activity logs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: [{ id: "log1" }] });
    await expect(listUserActivityLogs("user/1", { limit: 30, offset: 60 })).resolves.toEqual([{ id: "log1" }]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/activity-logs/users/user%2F1?limit=30&offset=60");
  });
});
