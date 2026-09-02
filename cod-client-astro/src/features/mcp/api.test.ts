import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: seam.apiFetch }));

import {
  listMyMcpConnections,
  listTeamMcpConnections,
  revokeMyMcpConnection,
  revokeUserMcpConnection,
} from "./api";

describe("mcp API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.apiFetch.mockResolvedValue({ success: true, data: [] });
  });

  it("unwraps the caller's connections", async () => {
    const connection = { clientId: "claude", scopes: ["orders:read"] };
    seam.apiFetch.mockResolvedValue({ success: true, data: [connection] });
    await expect(listMyMcpConnections()).resolves.toEqual([connection]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/mcp/me");
  });

  it("lists the team view from the admin endpoint", async () => {
    await expect(listTeamMcpConnections()).resolves.toEqual([]);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/mcp/team");
  });

  it("revokes self and team connections with URL-encoded IDs", async () => {
    seam.apiFetch.mockResolvedValue({ success: true, data: { clientId: "claude", userId: "user/1" } });
    await revokeMyMcpConnection("claude/app");
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/mcp/connections/claude%2Fapp", { method: "DELETE" });

    await revokeUserMcpConnection("claude/app", "user/1");
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/mcp/connections/claude%2Fapp/users/user%2F1", { method: "DELETE" });
  });
});
