/**
 * Human-in-the-loop (HITL) tool classification.
 *
 * DANGEROUS_TOOLS is the hard-coded allowlist of tools that ALWAYS require
 * user confirmation before executing — deletes across domains, driver
 * settlements, stock adjustments, order status changes. Risk classification
 * lives in ONE file reviewers can audit at a glance; adding a destructive
 * tool means editing this file in the same change.
 *
 * Confirmation policy (Slice 2):
 * The MCP wrapper fails CLOSED for dangerous tools — they refuse to run —
 * until Slice 3 wires SDK v2 `inputRequired` confirmation. Failing closed is
 * strictly safer than the previous SDK v1 `elicitInput` path, which was broken
 * for Streamable HTTP (an empty relatedRequestId never reached a live stream).
 */
export const DANGEROUS_TOOLS: ReadonlySet<string> = new Set<string>([
  // Customers — destructive
  "deleteCustomer",

  // Drivers — destructive
  "deleteDriver",

  // Driver payments — financial
  "createDriverSettlement",

  // Products — destructive
  "deleteProduct",

  // Product groups — destructive
  "deleteProductGroup",

  // Offers — destructive
  "deleteOffer",

  // Variants — destructive
  "deleteProductVariant",

  // Stock — financial / inventory-altering
  "adjustProductStock",
  "adjustVariantStock",

  // Shipping profiles — destructive / broad impact
  "deleteShippingProfile",
  "setShippingProfileRules",
  "setShippingCommuneOverride",
  "resetShippingCommuneOverride",

  // Reviews — destructive
  "deleteReview",

  // Customer groups — destructive
  "deleteCustomerGroup",

  // Customer tags — destructive
  "deleteCustomerTag",

  // Orders — destructive / financially irreversible
  "deleteOrder",
  "updateOrderStatus",
  "recordOrderProductReturn",

  // Variants — direct inventory overwrite bypasses tracked stock movements
  // (the tool's own description warns to prefer the stock adjustment tools)
  "updateVariant",
]);

export function isDangerous(toolName: string): boolean {
  return DANGEROUS_TOOLS.has(toolName);
}
