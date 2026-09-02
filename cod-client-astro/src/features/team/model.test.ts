import { describe, expect, it } from "vitest";
import {
  activityActionLabel,
  activityEntityLabel,
  filterTeamMembers,
  formatRelativeTime,
  formatTeamDate,
  paginateTeamMembers,
  parseActivityMeta,
  parseTeamRoute,
  sortTeamMembers,
  teamErrorMessage,
  teamScopeCount,
} from "./model";
import type { TeamMember } from "./types";

const member = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  id: "user-1",
  name: "Ahmed Benali",
  email: "ahmed@codflow.dz",
  role: "staff",
  status: "active",
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  scopes: ["orders:read", "orders:update"],
  ...overrides,
});

const t = (key: string) => key;

describe("team model", () => {
  it("filters members by query, role and status", () => {
    const rows = [
      member(),
      member({ id: "2", name: "Salima", role: "admin", status: "inactive", scopes: ["*"] }),
    ];
    expect(filterTeamMembers(rows, { query: "benali", role: "all", status: "all" }).map((item) => item.id)).toEqual(["user-1"]);
    expect(filterTeamMembers(rows, { query: "", role: "admin", status: "all" }).map((item) => item.id)).toEqual(["2"]);
    expect(filterTeamMembers(rows, { query: "", role: "all", status: "inactive" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("sorts and paginates team collections", () => {
    const rows = [member({ id: "1", name: "Zed" }), member({ id: "2", name: "Amel" }), member({ id: "3", name: "Meriem" })];
    expect(sortTeamMembers(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateTeamMembers(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("counts effective scopes", () => {
    expect(teamScopeCount(member())).toBe(2);
    expect(teamScopeCount(member({ role: "admin", scopes: ["*"] }))).toBeGreaterThan(0);
  });

  it("parses only valid team routes", () => {
    expect(parseTeamRoute("/team")).toEqual({ kind: "list" });
    expect(parseTeamRoute("/team/user-1")).toEqual({ kind: "detail", id: "user-1" });
    expect(parseTeamRoute("/team/user%2F1")).toEqual({ kind: "detail", id: "user/1" });
    expect(parseTeamRoute("/team/")).toEqual({ kind: "list" });
    expect(parseTeamRoute("/orders")).toEqual({ kind: "unknown" });
  });

  it("maps business error codes", () => {
    expect(teamErrorMessage({ code: "USER_NOT_FOUND" }, t)).toBe("error_member_not_found");
    expect(teamErrorMessage({ code: "DUPLICATE_EMAIL" }, t)).toBe("error_duplicate_email");
    expect(teamErrorMessage({ code: "PERMISSION_DENIED" }, t)).toBe("error_permission_denied");
    expect(teamErrorMessage(new Error("boom"), t)).toBe("error_generic");
  });

  it("labels activity actions and entity types with fallbacks", () => {
    expect(activityActionLabel("order.status_changed", t)).toBe("order.status_changed");
    expect(activityActionLabel("order.status_changed", () => "Changed order status")).toBe("Changed order status");
    expect(activityEntityLabel("order", () => "Orders")).toBe("Orders");
    expect(activityEntityLabel("mcp", t)).toBe("mcp");
  });

  it("parses activity metadata and formats values", () => {
    expect(parseActivityMeta('{"role":"admin"}')).toEqual({ role: "admin" });
    expect(parseActivityMeta("not-json")).toBeNull();
    expect(parseActivityMeta(null)).toBeNull();
    expect(formatTeamDate("2026-08-26T00:00:00.000Z", "en")).toBe("8/26/2026");
    expect(formatTeamDate("not-a-date", "en")).toBe("-");
    expect(formatRelativeTime("not-a-date", "en")).toBe("-");
  });
});
