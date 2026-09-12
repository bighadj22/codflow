/**
 * Risk classification for MCP tools.
 *
 * DANGEROUS_TOOLS is the hard-coded set of destructive tools — deletes across
 * domains, driver settlements, stock adjustments, order status changes. Risk
 * classification lives in ONE file reviewers can audit at a glance; adding a
 * destructive tool means editing this file in the same change.
 *
 * What this classification drives today: the destructiveHint annotations
 * (./annotations.ts) that tell clients how to frame their own confirmation
 * prompts. Per the platform docs, human confirmation for write actions is the
 * CLIENT's responsibility — "ChatGPT currently requires manual confirmation in
 * any conversation before write actions can be taken" — so the server does not
 * run a duplicate confirmation round; it labels accurately, gates by OAuth
 * scope, validates inputs, and writes the audit trail.
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

  // Landing pages — destructive (refuses with attributed orders, but still irreversible without)
  "deleteLandingPage",
  // Landing pages — destructive (storage object removed on last reference; restore = re-upload)
  "removeLandingPageImage",
  // Landing pages — lifecycle exit (retires the link; the safe alternative to delete)
  "archiveLandingPage",

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
