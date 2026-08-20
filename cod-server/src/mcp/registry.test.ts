/**
 * buildToolsForUser — the scope gate. These tests are the canonical proof
 * that a user can ONLY see tools their OAuth scopes authorise.
 *
 * Strategy:
 *   • Mock EVERY ai-tools factory to return distinct, named stubs so
 *     we can assert on tool-name sets directly without DB access.
 *   • Build a few representative sessions (admin, scoped-staff, empty-scope)
 *     and snapshot the tool-name set each one sees.
 *   • Golden tests — if the scope mapping ever drifts, these fail loudly.
 */

import { describe, it, expect, vi } from "vitest";
import type { Tool } from "ai";

// Stubs that are cheap to create and identifiable by name.
const stubTool = (name: string): Tool => ({
  description: name,
  inputSchema: { shape: {} } as unknown as Tool["inputSchema"],
  execute: async () => ({ success: true, name }),
}) as unknown as Tool;

const toolMap = (...names: string[]): Record<string, Tool> =>
  Object.fromEntries(names.map((n) => [n, stubTool(n)]));

// Mock every ai-tools factory BEFORE the registry imports them.
vi.mock("@/endpoints/customers/ai-tools", () => ({
  getCustomerTools: () => toolMap(
    "listCustomers",
    "getCustomerDetails",
    "findCustomerByPhone",
    "createNewCustomer",
    "updateCustomerProfile",
    "getCustomerOrderHistory",
    "getCustomerMemberships",
    "deleteCustomer",
  ),
}));

vi.mock("@/endpoints/drivers/ai-tools", () => ({
  getDriverTools: () => toolMap(
    "listDrivers",
    "getDriverDetails",
    "createNewDriver",
    "updateDriverProfile",
    "updateDriverStatus",
    "deleteDriver",
  ),
}));

vi.mock("@/endpoints/driver-payments/ai-tools", () => ({
  getDriverPaymentTools: () => toolMap(
    "listDriverPayments",
    "getPendingSettlements",
    "createDriverSettlement",
  ),
}));

vi.mock("@/endpoints/products/ai-tools", () => ({
  getProductTools: () => toolMap(
    "listProducts",
    "getProductDetails",
    "createNewProduct",
    "updateProductDetails",
    "updateProductStatus",
    "deleteProduct",
  ),
}));

vi.mock("@/endpoints/product-groups/ai-tools", () => ({
  getProductGroupTools: () => toolMap(
    "listProductGroups",
    "getProductGroupDetails",
    "createProductGroup",
    "updateProductGroup",
    "deleteProductGroup",
    "addCustomerToGroup",
    "removeCustomerFromGroup",
  ),
}));

vi.mock("@/endpoints/offers/ai-tools", () => ({
  getOfferTools: () => toolMap(
    "listOffers",
    "getOfferDetails",
    "createOffer",
    "updateOffer",
    "deleteOffer",
  ),
}));

vi.mock("@/endpoints/variants/ai-tools", () => ({
  getVariantTools: () => toolMap(
    "listProductVariants",
    "getVariantDetails",
    "createProductVariant",
    "updateVariant",
    "deleteProductVariant",
  ),
}));

vi.mock("@/endpoints/wilayas/ai-tools", () => ({
  getWilayaTools: () => toolMap(
    "listWilayas",
    "listWilayaCommunes",
  ),
}));

vi.mock("@/endpoints/stock/ai-tools", () => ({
  getStockTools: () => toolMap(
    "getStockOverview",
    "getStockAlerts",
    "getProductStockHistory",
    "adjustProductStock",
    "adjustVariantStock",
    "updateProductStockThreshold",
    "updateVariantStockThreshold",
  ),
}));

vi.mock("@/endpoints/shipping-profiles/ai-tools", () => ({
  getShippingProfileTools: () => toolMap(
    "listShippingProfiles",
    "getShippingProfile",
    "getDefaultShippingRules",
    "listCommuneOverrides",
    "createShippingProfile",
    "updateShippingProfile",
    "deleteShippingProfile",
    "setShippingProfileRules",
    "setShippingCommuneOverride",
    "resetShippingCommuneOverride",
  ),
}));

vi.mock("@/endpoints/reviews/ai-tools", () => ({
  getReviewTools: () => toolMap(
    "listReviews",
    "moderateReview",
    "deleteReview",
  ),
}));

vi.mock("@/endpoints/customer-groups/ai-tools", () => ({
  getCustomerGroupTools: () => toolMap(
    "listCustomerGroups",
    "getCustomerGroupDetails",
    "createCustomerGroup",
    "updateCustomerGroup",
    "deleteCustomerGroup",
    "addCustomerToGroup",
    "removeCustomerFromGroup",
  ),
}));

vi.mock("@/endpoints/customer-tags/ai-tools", () => ({
  getCustomerTagTools: () => toolMap(
    "listCustomerTags",
    "getCustomerTagDetails",
    "createCustomerTag",
    "updateCustomerTag",
    "deleteCustomerTag",
    "assignTagToCustomer",
    "unassignTagFromCustomer",
  ),
}));

vi.mock("@/endpoints/orders/ai-tools", () => ({
  getOrderTools: () => toolMap(
    "listOrders",
    "getOrderDetails",
    "createOrder",
    "updateOrderStatus",
    "recordOrderProductReturn",
    "assignDriverToOrder",
    "unassignDriverFromOrder",
    "deleteOrder",
  ),
}));

// getDb is called by buildToolsForUser but the stub factories ignore it.
vi.mock("@/db", () => ({
  getDb: () => ({} as never),
}));

import { buildToolsForUser } from "./registry";
import { SCOPES } from "../../../cod-shared/rbac/scopes";
import type { McpProps } from "./props";
import type { Env } from "@/types/env";

const env = {} as Env;

function makeProps(overrides: Partial<McpProps>): McpProps {
  return {
    userId: "u",
    role: "staff",
    scopes: [],
    name: "",
    email: "",
    ...overrides,
  };
}

function names(props: McpProps): string[] {
  return Object.keys(buildToolsForUser(env, props)).sort();
}

// The full union of every tool in TOOL_REGISTRY, alpha-sorted.
const ALL_TOOLS = [
  "addCustomerToGroup",
  "adjustProductStock",
  "adjustVariantStock",
  "assignDriverToOrder",
  "assignTagToCustomer",
  "createCustomerGroup",
  "createCustomerTag",
  "createDriverSettlement",
  "createNewCustomer",
  "createNewDriver",
  "createNewProduct",
  "createOffer",
  "createOrder",
  "createProductGroup",
  "createProductVariant",
  "createShippingProfile",
  "deleteCustomer",
  "deleteCustomerGroup",
  "deleteCustomerTag",
  "deleteDriver",
  "deleteOffer",
  "deleteOrder",
  "deleteProduct",
  "deleteProductGroup",
  "deleteProductVariant",
  "deleteReview",
  "deleteShippingProfile",
  "findCustomerByPhone",
  "getCustomerDetails",
  "getCustomerGroupDetails",
  "getCustomerMemberships",
  "getCustomerOrderHistory",
  "getCustomerTagDetails",
  "getDefaultShippingRules",
  "getDriverDetails",
  "getOfferDetails",
  "getOrderDetails",
  "getPendingSettlements",
  "getProductDetails",
  "getProductGroupDetails",
  "getProductStockHistory",
  "getShippingProfile",
  "getStockAlerts",
  "getStockOverview",
  "getVariantDetails",
  "listCommuneOverrides",
  "listCustomerGroups",
  "listCustomerTags",
  "listCustomers",
  "listDriverPayments",
  "listDrivers",
  "listOffers",
  "listOrders",
  "listProductGroups",
  "listProductVariants",
  "listProducts",
  "listReviews",
  "listShippingProfiles",
  "listWilayaCommunes",
  "listWilayas",
  "moderateReview",
  "recordOrderProductReturn",
  "removeCustomerFromGroup",
  "resetShippingCommuneOverride",
  "setShippingCommuneOverride",
  "setShippingProfileRules",
  "unassignDriverFromOrder",
  "unassignTagFromCustomer",
  "updateCustomerGroup",
  "updateCustomerProfile",
  "updateCustomerTag",
  "updateDriverProfile",
  "updateDriverStatus",
  "updateOffer",
  "updateOrderStatus",
  "updateProductDetails",
  "updateProductGroup",
  "updateProductStatus",
  "updateProductStockThreshold",
  "updateShippingProfile",
  "updateVariant",
  "updateVariantStockThreshold",
];

describe("buildToolsForUser — scope gating", () => {
  it("admin sees every registered tool (bypasses scope checks)", () => {
    expect(names(makeProps({ role: "admin" }))).toEqual(ALL_TOOLS);
  });

  it("empty-scope staff sees zero tools", () => {
    expect(names(makeProps({ scopes: [] }))).toEqual([]);
  });

  it("CUSTOMERS_READ alone → read-tier customer + wilaya tools", () => {
    expect(names(makeProps({ scopes: [SCOPES.CUSTOMERS_READ] }))).toEqual([
      "findCustomerByPhone",
      "getCustomerDetails",
      "getCustomerMemberships",
      "getCustomerOrderHistory",
      "listCustomers",
      "listWilayaCommunes",
      "listWilayas",
    ]);
  });

  it("CUSTOMERS_READ + CUSTOMERS_CREATE stacks properly", () => {
    expect(names(makeProps({ scopes: [SCOPES.CUSTOMERS_READ, SCOPES.CUSTOMERS_CREATE] }))).toEqual([
      "createNewCustomer",
      "findCustomerByPhone",
      "getCustomerDetails",
      "getCustomerMemberships",
      "getCustomerOrderHistory",
      "listCustomers",
      "listWilayaCommunes",
      "listWilayas",
    ]);
  });

  it("DELIVERY_READ + DELIVERY_UPDATE grants driver/shipping/wilaya tools", () => {
    expect(names(makeProps({ scopes: [SCOPES.DELIVERY_READ, SCOPES.DELIVERY_UPDATE] }))).toEqual([
      "getDefaultShippingRules",
      "getDriverDetails",
      "getShippingProfile",
      "listCommuneOverrides",
      "listDrivers",
      "listShippingProfiles",
      "listWilayaCommunes",
      "listWilayas",
      "updateDriverProfile",
      "updateDriverStatus",
    ]);
  });

  it("DELIVERY_MANAGE grants the payment + shipping-write suite", () => {
    expect(names(makeProps({ scopes: [SCOPES.DELIVERY_MANAGE] }))).toEqual([
      "createDriverSettlement",
      "createShippingProfile",
      "deleteShippingProfile",
      "getPendingSettlements",
      "listDriverPayments",
      "resetShippingCommuneOverride",
      "setShippingCommuneOverride",
      "setShippingProfileRules",
      "updateShippingProfile",
    ]);
  });

  it("wildcard '*' in scopes acts like admin (matches hasPermission semantics)", () => {
    const tools = names(makeProps({ scopes: ["*"] }));
    // Should include at least one tool from every domain
    expect(tools).toContain("listCustomers");
    expect(tools).toContain("listDrivers");
    expect(tools).toContain("listDriverPayments");
    expect(tools).toContain("deleteCustomer");
  });
});