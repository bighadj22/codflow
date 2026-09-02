import { describe, expect, it } from "vitest";
import {
  customerTagErrorMessage,
  filterAssigned,
  filterAvailableCustomers,
  filterTags,
  formatTagDate,
  paginateTags,
  parseCustomerTagRoute,
  sortTags,
  tagCanDelete,
} from "./model";
import type { CustomerTag, CustomerTagAssigned } from "./types";

const tag = (overrides: Partial<CustomerTag> = {}): CustomerTag => ({
  id: "tag-1",
  name: "VIP",
  color: "#64748b",
  assignmentCount: 3,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const assigned = (overrides: Partial<CustomerTagAssigned> = {}): CustomerTagAssigned => ({
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

describe("customer-tags model", () => {
  it("filters tags by name", () => {
    const rows = [tag(), tag({ id: "2", name: "Wholesale" })];
    expect(filterTags(rows, "vip").map((item) => item.id)).toEqual(["tag-1"]);
    expect(filterTags(rows, "").map((item) => item.id)).toEqual(["tag-1", "2"]);
  });

  it("sorts and paginates tag collections", () => {
    const rows = [tag({ id: "1", name: "Zed", assignmentCount: 5 }), tag({ id: "2", name: "Amel", assignmentCount: 2 }), tag({ id: "3", name: "Meriem", assignmentCount: 9 })];
    expect(sortTags(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(sortTags(rows, "assignmentCount", "desc").map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(paginateTags(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("guards deletion until the tag has no assignments", () => {
    expect(tagCanDelete(tag({ assignmentCount: 0 }))).toBe(true);
    expect(tagCanDelete(tag({ assignmentCount: 1 }))).toBe(false);
  });

  it("filters assigned customers and available candidates", () => {
    const rows = [assigned(), assigned({ id: "2", name: "Salima", phone: "0771234567" })];
    expect(filterAssigned(rows, "0551").map((item) => item.id)).toEqual(["customer-1"]);
    const candidates = [
      { id: "customer-1", name: "Ahmed", phone: "0551" },
      { id: "customer-2", name: "Meriem", phone: "0777" },
    ];
    expect(filterAvailableCustomers(rows, candidates, "")).toEqual([candidates[1]]);
    expect(filterAvailableCustomers(rows, candidates, "meriem").map((item) => item.id)).toEqual(["customer-2"]);
  });

  it("parses only valid customer-tag routes", () => {
    expect(parseCustomerTagRoute("/customer-tags")).toEqual({ kind: "list" });
    expect(parseCustomerTagRoute("/customer-tags/new/")).toEqual({ kind: "new" });
    expect(parseCustomerTagRoute("/customer-tags/tag%2F1")).toEqual({ kind: "detail", id: "tag/1" });
    expect(parseCustomerTagRoute("/customer-tags/tag-1/edit")).toEqual({ kind: "edit", id: "tag-1" });
    expect(parseCustomerTagRoute("/customer-tags/new/edit")).toEqual({ kind: "unknown" });
    expect(parseCustomerTagRoute("/customer-tags/tag-1/unknown")).toEqual({ kind: "unknown" });
  });

  it("maps business error codes and formats dates", () => {
    expect(customerTagErrorMessage({ code: "TAG_HAS_ASSIGNMENTS" }, t)).toBe("error_tag_has_assignments");
    expect(customerTagErrorMessage({ code: "DUPLICATE_TAG_NAME" }, t)).toBe("error_duplicate_name");
    expect(customerTagErrorMessage({ code: "TAG_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(customerTagErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(formatTagDate("2026-08-26T00:00:00.000Z", "en")).toBe("8/26/2026");
    expect(formatTagDate("not-a-date", "en")).toBe("-");
  });
});
