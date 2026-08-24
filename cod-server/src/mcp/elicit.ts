/**
 * Human-in-the-loop (HITL) confirmation helper.
 *
 * MCP Elicitation is the protocol-level way to ask the end user — not the
 * LLM — for explicit confirmation mid-tool-call. We use it to protect
 * destructive and financially-irreversible actions (deletes, payments,
 * carrier dispatches) from being fired off by a plausible-but-wrong
 * instruction to the agent.
 *
 * Design choice: the DANGEROUS_TOOLS set is a hard-coded allowlist here,
 * not a flag on the tool definition. That keeps risk classification in
 * ONE file reviewers can audit at a glance — instead of scattered across
 * eight `ai-tools.ts` files. When a new domain adds a destructive tool,
 * the contributor edits this file too; there is no way to silently bypass.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Tool names that ALWAYS require user confirmation via MCP elicitation.
 *
 * Criteria for inclusion:
 *   • Financial impact (payments, settlements)
 *   • Destructive (delete* of any domain object)
 *   • Carrier/partner side-effects that are hard to reverse (dispatch,
 *     validate-shipment — not applicable yet, added in MCP-14)
 *
 * NOT in this set:
 *   • Read-only (list/get/find/search) — always safe
 *   • Update of non-financial fields — agent can correct mistakes
 *   • Create of non-financial records — duplicates are cheap to delete
 *
 * Check by name (not by category) so the audit is explicit and complete.
 * Adding a new destructive tool? Add its name here in the same PR.
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

  // Reviews — destructive
  "deleteReview",

  // Customer groups — destructive
  "deleteCustomerGroup",

  // Customer tags — destructive
  "deleteCustomerTag",

  // Orders — destructive / financially irreversible
  "deleteOrder",
  "updateOrderStatus",

  // Further additions land with MCP-14:
  //   "deleteOrder", "cancelOrder", "adjustStock",
  //   "dispatchOrder", "deleteReview", "deleteOffer"
]);

export type ConfirmDecision = "accepted" | "declined";

/**
 * Gate a tool invocation on user confirmation. For tools NOT in
 * DANGEROUS_TOOLS this returns "accepted" immediately (no round-trip to
 * the client). For DANGEROUS_TOOLS it uses MCP elicitation — a structured
 * form the MCP client renders natively so the user sees an in-app
 * confirmation dialog.
 *
 * Returns "declined" when:
 *   • the user clicks Deny (`result.action !== "accept"`)
 *   • the user leaves the `confirmed` field unchecked
 *   • the client times out the elicitation (SDK resolves with cancel)
 *
 * Callers should treat "declined" as a normal outcome: log it, return a
 * terse "Action cancelled by user" message, do NOT throw.
 */
export async function maybeConfirm(
  server: McpServer,
  toolName: string,
  args: unknown,
  requestId: string,
): Promise<ConfirmDecision> {
  if (!DANGEROUS_TOOLS.has(toolName)) return "accepted";

  // elicitInput is on the inner Server instance, not on McpServer directly.
  // Cast preserved here so we don't chain through Promise<typeof server>.
  const inner = (server as unknown as { server: { elicitInput: (
    args: { message: string; requestedSchema: Record<string, unknown> },
    opts?: { relatedRequestId?: string },
  ) => Promise<{ action: string; content?: { confirmed?: boolean; reason?: string } }> } }).server;

  const result = await inner.elicitInput(
    {
      message: `Confirm: ${toolName}`,
      requestedSchema: {
        type: "object",
        required: ["confirmed"],
        properties: {
          confirmed: {
            type: "boolean",
            title: "Proceed with this action",
            description: "This operation is destructive or irreversible. Click to confirm.",
          },
          reason: {
            type: "string",
            title: "Reason (optional)",
            description: "Audit note — why are you taking this action?",
          },
        },
      },
    },
    { relatedRequestId: requestId },
  );

  if (result.action !== "accept") return "declined";
  return result.content?.confirmed === true ? "accepted" : "declined";
}
