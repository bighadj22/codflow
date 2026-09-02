import { describe, expect, it } from "vitest";
import {
  calculateReturnRate,
  customerCanDelete,
  filterCustomers,
  paginateCustomers,
  parseCustomerRoute,
  sortCustomers,
} from "./model";
import type { Customer, CustomerOrderSummary } from "./types";

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "customer-1",
  name: "Ahmed Benali",
  phone: "0551234567",
  phone2: null,
  wilayaId: 16,
  communeId: "c-16-001",
  wilaya: "الجزائر",
  commune: "باب الزوار",
  address: "Alger",
  totalOrders: 2,
  totalSpent: 18000,
  createdAt: "2026-08-26T00:00:00.000Z",
  lastOrderAt: null,
  ...overrides,
});

const order = (status: string): CustomerOrderSummary => ({
  id: crypto.randomUUID(),
  orderNumber: "ORD-001",
  status,
  price: 9000,
  createdAt: "2026-08-26T00:00:00.000Z",
  wilayaId: 16,
  communeId: "c-16-001",
  wilaya: "الجزائر",
  commune: "باب الزوار",
  statusHistory: [],
});

describe("customers model", () => {
  it("filters by customer fields and wilaya", () => {
    expect(filterCustomers([customer(), customer({ id: "2", name: "Salima", phone: "0771234567", wilayaId: 31 })], { query: "0551", wilaya: "all" }).map((item) => item.id)).toEqual(["customer-1"]);
    expect(filterCustomers([customer(), customer({ id: "2", wilayaId: 31 })], { query: "", wilaya: "31" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("sorts and paginates customer collections", () => {
    const rows = [customer({ id: "1", name: "Zed", totalSpent: 100 }), customer({ id: "2", name: "Amel", totalSpent: 300 }), customer({ id: "3", name: "Meriem", totalSpent: 200 })];
    expect(sortCustomers(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(sortCustomers(rows, "totalSpent", "desc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateCustomers(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("calculates return rate and deletion eligibility", () => {
    expect(calculateReturnRate([])).toBe(0);
    expect(calculateReturnRate([order("returned"), order("delivered"), order("returned")])).toBe(67);
    expect(customerCanDelete(customer({ totalOrders: 0 }))).toBe(true);
    expect(customerCanDelete(customer({ totalOrders: 1 }))).toBe(false);
  });

  it("parses only valid customer routes", () => {
    expect(parseCustomerRoute("/customers")).toEqual({ kind: "list" });
    expect(parseCustomerRoute("/customers/new/")).toEqual({ kind: "new" });
    expect(parseCustomerRoute("/customers/cust%2F1")).toEqual({ kind: "detail", id: "cust/1" });
    expect(parseCustomerRoute("/customers/cust-1/edit")).toEqual({ kind: "edit", id: "cust-1" });
    expect(parseCustomerRoute("/customers/new/edit")).toEqual({ kind: "unknown" });
    expect(parseCustomerRoute("/customers/cust-1/unknown")).toEqual({ kind: "unknown" });
  });
});
