/**
 * maybeConfirm — the human-in-the-loop gate.
 *
 * Contract:
 *   • Non-dangerous tool → resolves "accepted" immediately, no elicitation.
 *   • Dangerous tool + user confirms → resolves "accepted".
 *   • Dangerous tool + user declines → resolves "declined".
 *   • Dangerous tool + elicitation times out / cancelled → resolves "declined".
 *
 * We DO NOT mock the MCP SDK — we pass a minimal fake McpServer with just
 * the one nested `server.elicitInput` method the helper touches. Keeps the
 * blast radius of this test file tiny.
 */

import { describe, it, expect, vi } from "vitest";
import { maybeConfirm, DANGEROUS_TOOLS } from "./elicit";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function makeServer(elicitResult: unknown): McpServer {
  const elicitInput = vi.fn().mockResolvedValue(elicitResult);
  return { server: { elicitInput } } as unknown as McpServer;
}

describe("maybeConfirm", () => {
  it("returns 'accepted' immediately for non-dangerous tools", async () => {
    const server = makeServer({ action: "accept", content: { confirmed: true } });
    const result = await maybeConfirm(server, "listCustomers", {}, "req-1");
    expect(result).toBe("accepted");
    const elicitInput = (server as unknown as { server: { elicitInput: ReturnType<typeof vi.fn> } }).server.elicitInput;
    expect(elicitInput).not.toHaveBeenCalled();
  });

  it("elicits for dangerous tools and returns 'accepted' on confirm", async () => {
    const server = makeServer({ action: "accept", content: { confirmed: true } });
    const result = await maybeConfirm(server, "deleteCustomer", { id: "c1" }, "req-2");
    expect(result).toBe("accepted");
    const elicitInput = (server as unknown as { server: { elicitInput: ReturnType<typeof vi.fn> } }).server.elicitInput;
    expect(elicitInput).toHaveBeenCalledOnce();
  });

  it("returns 'declined' when user hits cancel (action !== 'accept')", async () => {
    const server = makeServer({ action: "cancel", content: { confirmed: true } });
    const result = await maybeConfirm(server, "deleteCustomer", {}, "req-3");
    expect(result).toBe("declined");
  });

  it("returns 'declined' when user accepts the dialog but unchecks confirmed", async () => {
    const server = makeServer({ action: "accept", content: { confirmed: false } });
    const result = await maybeConfirm(server, "deleteDriver", {}, "req-4");
    expect(result).toBe("declined");
  });

  it("returns 'declined' when the elicitation content is missing", async () => {
    const server = makeServer({ action: "accept" });
    const result = await maybeConfirm(server, "createDriverSettlement", {}, "req-5");
    expect(result).toBe("declined");
  });

  it("passes the related requestId through for client-side correlation", async () => {
    const server = makeServer({ action: "accept", content: { confirmed: true } });
    await maybeConfirm(server, "deleteCustomer", {}, "req-abc");
    const elicitInput = (server as unknown as { server: { elicitInput: ReturnType<typeof vi.fn> } }).server.elicitInput;
    expect(elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Confirm: deleteCustomer",
        requestedSchema: expect.objectContaining({ required: ["confirmed"] }),
      }),
      { relatedRequestId: "req-abc" },
    );
  });
});

describe("DANGEROUS_TOOLS allowlist", () => {
  it("covers the destructive/financial tools wired in MCP-10", () => {
    expect(DANGEROUS_TOOLS.has("deleteCustomer")).toBe(true);
    expect(DANGEROUS_TOOLS.has("deleteDriver")).toBe(true);
    expect(DANGEROUS_TOOLS.has("createDriverSettlement")).toBe(true);
  });

  it("does NOT flag read or normal update tools", () => {
    expect(DANGEROUS_TOOLS.has("listCustomers")).toBe(false);
    expect(DANGEROUS_TOOLS.has("getCustomerDetails")).toBe(false);
    expect(DANGEROUS_TOOLS.has("updateCustomerProfile")).toBe(false);
    expect(DANGEROUS_TOOLS.has("listDriverPayments")).toBe(false);
  });
});
