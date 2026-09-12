/**
 * DANGEROUS_TOOLS — the risk classification feeding destructiveHint
 * annotations. These tests are the audit proof that destructive/financial
 * tools are classified as such and that read/update tools are not.
 */

import { describe, it, expect } from "vitest";
import { DANGEROUS_TOOLS, isDangerous } from "./elicit";

describe("DANGEROUS_TOOLS allowlist", () => {
  it("covers the destructive/financial tools wired in MCP-10", () => {
    expect(isDangerous("deleteCustomer")).toBe(true);
    expect(isDangerous("deleteDriver")).toBe(true);
    expect(isDangerous("createDriverSettlement")).toBe(true);
    expect(isDangerous("deleteProduct")).toBe(true);
    expect(isDangerous("adjustProductStock")).toBe(true);
    expect(isDangerous("deleteOrder")).toBe(true);
    expect(isDangerous("updateOrderStatus")).toBe(true);
    expect(isDangerous("deleteLandingPage")).toBe(true);
    expect(isDangerous("removeLandingPageImage")).toBe(true);
    expect(isDangerous("archiveLandingPage")).toBe(true);
  });

  it("does NOT flag read or normal update tools", () => {
    expect(isDangerous("listCustomers")).toBe(false);
    expect(isDangerous("getCustomerDetails")).toBe(false);
    expect(isDangerous("updateCustomerProfile")).toBe(false);
    expect(isDangerous("listDriverPayments")).toBe(false);
    expect(isDangerous("listLandingPages")).toBe(false);
    expect(isDangerous("publishLandingPage")).toBe(false);
    expect(isDangerous("unpublishLandingPage")).toBe(false);
    expect(isDangerous("reorderLandingPageImages")).toBe(false);
    expect(isDangerous("duplicateLandingPage")).toBe(false);
    expect(isDangerous("uploadLandingPageImage")).toBe(false);
    expect(isDangerous("getLandingPageImageUploadStatus")).toBe(false);
  });

  it("mirrors the allowlist set", () => {
    expect([...DANGEROUS_TOOLS].sort()).toEqual(
      [
        "deleteCustomer",
        "deleteDriver",
        "createDriverSettlement",
        "deleteProduct",
        "deleteProductGroup",
        "deleteOffer",
        "deleteProductVariant",
        "adjustProductStock",
        "adjustVariantStock",
        "deleteShippingProfile",
        "setShippingProfileRules",
        "setShippingCommuneOverride",
        "resetShippingCommuneOverride",
        "deleteReview",
        "deleteCustomerGroup",
        "deleteCustomerTag",
        "deleteOrder",
        "updateOrderStatus",
        "recordOrderProductReturn",
        "updateVariant",
        "deleteLandingPage",
        "removeLandingPageImage",
        "archiveLandingPage",
      ].sort(),
    );
  });
});
