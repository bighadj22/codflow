/**
 * Customer MCP tools — output-schema conformance for nullable display names.
 *
 * Same defect class as the listOrders bug: `commune` comes from a nullable
 * source (the stored snapshot column on customers) and order-history
 * `wilaya`/`commune` come from LEFT-JOINed nameAr columns. Declaring those
 * non-nullable made any row with an unset commune fail its declared schema,
 * which dropped structuredContent and made MCP clients reject the call
 * ("has an output schema but no structured content was provided").
 *
 * `wilaya` (customers.wilaya), `totalSpent` and `totalOrders` are NOT NULL and
 * always present, so the schema declares them required — this test locks both
 * directions: null display names are accepted where the DB allows them, and a
 * null wilaya is rejected because the column cannot hold one.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const customerQueries = vi.hoisted(() => ({
  getAllCustomers: vi.fn(),
  getOrdersByCustomerId: vi.fn(),
}));

vi.mock("./queries", () => customerQueries);

import { getCustomerTools, CUSTOMER_TOOL_OUTPUT_SCHEMAS } from "./ai-tools";

type Executable = { execute: (args: unknown, options: unknown) => Promise<unknown> };

function tool(name: string): Executable {
  const tools = getCustomerTools({} as never) as unknown as Record<string, Executable>;
  const found = tools[name];
  if (!found) throw new Error(`${name} tool is not registered`);
  return found;
}

const customerRow = (overrides: Record<string, unknown> = {}) => ({
  id: "cust_1",
  name: "Fatima Zahra",
  phone: "0661234567",
  wilaya: "الجزائر",
  commune: null as string | null,
  totalSpent: 0,
  totalOrders: 0,
  lastOrderAt: null as string | null,
  ...overrides,
});

describe("customer tool output-schema conformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCustomers accepts an empty result set", async () => {
    customerQueries.getAllCustomers.mockResolvedValue([]);

    const result = await tool("listCustomers").execute({}, { toolCallId: "t" });

    const parsed = CUSTOMER_TOOL_OUTPUT_SCHEMAS["listCustomers"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(result).toMatchObject({ success: true, count: 0, customers: [] });
  });

  it("listCustomers accepts multiple customers, including a null commune", async () => {
    customerQueries.getAllCustomers.mockResolvedValue([
      customerRow(),
      customerRow({
        id: "cust_2",
        name: "Bare Buyer",
        phone: "0661234568",
        commune: "باب الزوار",
        totalSpent: 12000,
        totalOrders: 3,
        lastOrderAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);

    const result = await tool("listCustomers").execute({}, { toolCallId: "t" });

    const parsed = CUSTOMER_TOOL_OUTPUT_SCHEMAS["listCustomers"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const payload = result as { customers: Array<{ commune: string | null }> };
    expect(payload.customers[0]!.commune).toBeNull();
  });

  it("listCustomers output schema rejects a null wilaya — customers.wilaya is NOT NULL", async () => {
    customerQueries.getAllCustomers.mockResolvedValue([customerRow({ wilaya: null })]);

    const result = await tool("listCustomers").execute({}, { toolCallId: "t" });

    const parsed = CUSTOMER_TOOL_OUTPUT_SCHEMAS["listCustomers"]!.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it("getCustomerOrderHistory accepts an empty result set", async () => {
    customerQueries.getOrdersByCustomerId.mockResolvedValue([]);

    const result = await tool("getCustomerOrderHistory").execute(
      { customerId: "6f0c9b8e-3d2a-4e5f-8a7b-9c1d2e3f4a5b" },
      { toolCallId: "t" },
    );

    const parsed = CUSTOMER_TOOL_OUTPUT_SCHEMAS["getCustomerOrderHistory"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("getCustomerOrderHistory accepts orders whose LEFT-JOINed wilaya/commune are null", async () => {
    customerQueries.getOrdersByCustomerId.mockResolvedValue([
      {
        id: "ord_1",
        orderNumber: "ORD-001",
        status: "new",
        price: 2500,
        createdAt: "2026-01-01T00:00:00.000Z",
        wilaya: null,
        commune: null,
      },
      {
        id: "ord_2",
        orderNumber: "ORD-002",
        status: "delivered",
        price: 4100,
        createdAt: "2026-01-02T00:00:00.000Z",
        wilaya: "الجزائر",
        commune: "باب الزوار",
      },
    ]);

    const result = await tool("getCustomerOrderHistory").execute(
      { customerId: "6f0c9b8e-3d2a-4e5f-8a7b-9c1d2e3f4a5b" },
      { toolCallId: "t" },
    );

    const parsed = CUSTOMER_TOOL_OUTPUT_SCHEMAS["getCustomerOrderHistory"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
});
