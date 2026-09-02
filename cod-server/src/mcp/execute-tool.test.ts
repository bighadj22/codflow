/**
 * executeMcpTool — the per-tool MCP wrapper.
 *
 * Contract:
 *   • success → text content, `ok: true` activity row
 *   • handled `{ success: false, error }` → `isError: true` + `ok: false` row
 *   • thrown error / missing execute → `isError: true` + `ok: false` row
 *   • exactly one `mcp.tool_called` row in every path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tool } from "ai";

const activity = vi.hoisted(() => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: { MCP_TOOL_CALLED: "mcp.tool_called", MCP_TOOL_DECLINED: "mcp.tool_declined" },
}));

vi.mock("@/lib/activity", () => activity);

import { executeMcpTool, type McpActor } from "./execute-tool";

const actor: McpActor = { id: "u1", name: "Ada", role: "staff" };
const db = {} as never;

function stubTool(execute: (args: unknown, ctx: unknown) => unknown): Tool {
  return { description: "stub", execute } as unknown as Tool;
}

describe("executeMcpTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the tool result as text and logs success", async () => {
    const execute = vi.fn(async () => ({ success: true, value: 42 }));

    const result = await executeMcpTool({
      db,
      actor,
      name: "listCustomers",
      tool: stubTool(execute),
      args: {},
    });

    expect(execute).toHaveBeenCalledWith({}, { toolCallId: "" });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ success: true, value: 42 }) }],
    });
    expect(activity.logActivity).toHaveBeenCalledWith(
      db,
      actor,
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      { via: "mcp", args: {}, ok: true },
    );
  });

  it("marks handled failures as isError and logs the failure", async () => {
    const execute = vi.fn(async () => ({ success: false, error: "Customer has orders" }));

    const result = await executeMcpTool({
      db,
      actor,
      name: "deleteCustomer",
      tool: stubTool(execute),
      args: { customerId: "c1" },
    });

    expect(result.isError).toBe(true);
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("Customer has orders") }],
    });
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "mcp.tool_called",
      expect.anything(),
      expect.objectContaining({ ok: false, error: "Customer has orders" }),
    );
  });

  it("marks thrown errors as isError and logs the failure", async () => {
    const execute = vi.fn(async () => {
      throw new Error("boom");
    });

    const result = await executeMcpTool({
      db,
      actor,
      name: "createOrder",
      tool: stubTool(execute),
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "mcp.tool_called",
      expect.anything(),
      expect.objectContaining({ ok: false, error: "boom" }),
    );
  });

  it("fails when the tool has no execute function", async () => {
    const result = await executeMcpTool({
      db,
      actor,
      name: "listCustomers",
      tool: stubTool(undefined as never),
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("no execute") }],
    });
    expect(activity.logActivity).toHaveBeenCalledTimes(1);
  });
});
