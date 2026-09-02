import { describe, expect, it } from "vitest";
import {
  customerGroupErrorMessage,
  filterAvailableCustomers,
  filterGroups,
  filterMembers,
  formatGroupDate,
  groupCanDelete,
  paginateGroups,
  parseCustomerGroupRoute,
  sortGroups,
} from "./model";
import type { CustomerGroup, CustomerGroupMember } from "./types";

const group = (overrides: Partial<CustomerGroup> = {}): CustomerGroup => ({
  id: "group-1",
  name: "VIP",
  description: "Top buyers",
  color: "#6366f1",
  memberCount: 3,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const member = (overrides: Partial<CustomerGroupMember> = {}): CustomerGroupMember => ({
  id: "customer-1",
  name: "Ahmed Benali",
  phone: "0551234567",
  wilaya: "الجزائر",
  totalOrders: 2,
  totalSpent: 18000,
  assignedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const t = (key: string) => key;

describe("customer-groups model", () => {
  it("filters groups by name and description", () => {
    const rows = [group(), group({ id: "2", name: "Wholesale", description: null })];
    expect(filterGroups(rows, "top buyers").map((item) => item.id)).toEqual(["group-1"]);
    expect(filterGroups(rows, "wholesale").map((item) => item.id)).toEqual(["2"]);
    expect(filterGroups(rows, "").map((item) => item.id)).toEqual(["group-1", "2"]);
  });

  it("sorts and paginates group collections", () => {
    const rows = [group({ id: "1", name: "Zed", memberCount: 5 }), group({ id: "2", name: "Amel", memberCount: 2 }), group({ id: "3", name: "Meriem", memberCount: 9 })];
    expect(sortGroups(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(sortGroups(rows, "memberCount", "desc").map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(paginateGroups(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("guards deletion until the group is empty", () => {
    expect(groupCanDelete(group({ memberCount: 0 }))).toBe(true);
    expect(groupCanDelete(group({ memberCount: 1 }))).toBe(false);
  });

  it("filters members and available customers", () => {
    const rows = [member(), member({ id: "2", name: "Salima", phone: "0771234567" })];
    expect(filterMembers(rows, "0551").map((item) => item.id)).toEqual(["customer-1"]);
    const candidates = [
      { id: "customer-1", name: "Ahmed", phone: "0551" },
      { id: "customer-2", name: "Meriem", phone: "0777" },
    ];
    expect(filterAvailableCustomers(rows, candidates, "")).toEqual([candidates[1]]);
    expect(filterAvailableCustomers(rows, candidates, "meriem").map((item) => item.id)).toEqual(["customer-2"]);
  });

  it("parses only valid customer-group routes", () => {
    expect(parseCustomerGroupRoute("/customer-groups")).toEqual({ kind: "list" });
    expect(parseCustomerGroupRoute("/customer-groups/new/")).toEqual({ kind: "new" });
    expect(parseCustomerGroupRoute("/customer-groups/grp%2F1")).toEqual({ kind: "detail", id: "grp/1" });
    expect(parseCustomerGroupRoute("/customer-groups/grp-1/edit")).toEqual({ kind: "edit", id: "grp-1" });
    expect(parseCustomerGroupRoute("/customer-groups/new/edit")).toEqual({ kind: "unknown" });
    expect(parseCustomerGroupRoute("/customer-groups/grp-1/unknown")).toEqual({ kind: "unknown" });
  });

  it("maps business error codes and formats dates", () => {
    expect(customerGroupErrorMessage({ code: "GROUP_HAS_MEMBERS" }, t)).toBe("error_group_has_members");
    expect(customerGroupErrorMessage({ code: "DUPLICATE_GROUP_NAME" }, t)).toBe("error_duplicate_name");
    expect(customerGroupErrorMessage({ code: "GROUP_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(customerGroupErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(formatGroupDate("2026-08-26T00:00:00.000Z", "en")).toBe("8/26/2026");
    expect(formatGroupDate("not-a-date", "en")).toBe("-");
  });
});
