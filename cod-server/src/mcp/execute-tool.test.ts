/**
 * executeMcpTool — the per-tool MCP wrapper.
 *
 * Contract:
 *   • success → text content, `ok: true` activity row
 *   • handled `{ success: false, error }` → `isError: true` + `ok: false` row
 *   • thrown error / missing execute → `isError: true` + `ok: false` row
 *   • exactly one `mcp.tool_called` row in every path
 *   • oversized string args are elided in the audit row; short args pass intact
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tool } from "ai";

const activity = vi.hoisted(() => ({
  logActivity: vi.fn(
    async (
      _db: unknown,
      _actor: unknown,
      _action: unknown,
      _target: unknown,
      _metadata: unknown,
    ) => {},
  ),
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

  it("returns the tool result as text + structuredContent and logs success", async () => {
    const execute = vi.fn(async () => ({
      success: true,
      count: 0,
      customers: [],
    }));

    const result = await executeMcpTool({
      db,
      actor,
      name: "listCustomers",
      tool: stubTool(execute),
      args: {},
    });

    expect(execute).toHaveBeenCalledWith({}, { toolCallId: "" });
    expect(result).toEqual({
      content: [
        { type: "text", text: JSON.stringify({ success: true, count: 0, customers: [] }) },
      ],
      structuredContent: { success: true, count: 0, customers: [] },
    });
    expect(activity.logActivity).toHaveBeenCalledWith(
      db,
      actor,
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      { via: "mcp", args: {}, ok: true },
    );
  });

  it("marks handled failures as isError with structuredContent and logs the failure", async () => {
    const execute = vi.fn(async () => ({ success: false, error: "Customer has orders" }));

    const result = await executeMcpTool({
      db,
      actor,
      name: "deleteCustomer",
      tool: stubTool(execute),
      args: { customerId: "c1" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ success: false, error: "Customer has orders" });
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

  it("marks thrown errors as isError with a synthesized structuredContent envelope", async () => {
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
    expect(result.structuredContent).toEqual({ success: false, error: "boom" });
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "mcp.tool_called",
      expect.anything(),
      expect.objectContaining({ ok: false, error: "boom" }),
    );
  });

  it("omits structuredContent (but keeps the text result) when the result drifts from the tool's output schema", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await executeMcpTool({
        db,
        actor,
        name: "listCustomers",
        tool: stubTool(async () => ({ success: true, value: 42 })),
        args: {},
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toBeUndefined();
      expect(result).toMatchObject({
        content: [{ type: "text", text: expect.stringContaining("42") }],
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("listCustomers"),
        expect.any(String),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("never attaches structuredContent for a tool without an output schema", async () => {
    const result = await executeMcpTool({
      db,
      actor,
      name: "someUnschemaTool",
      tool: stubTool(async () => ({ success: true })),
      args: {},
    });

    expect(result.structuredContent).toBeUndefined();
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("success") }],
    });
  });

  it("merges client hints (subject/session) into the audit row on success", async () => {
    await executeMcpTool({
      db,
      actor,
      name: "listCustomers",
      tool: stubTool(async () => ({ success: true, count: 0, customers: [] })),
      args: {},
      clientMeta: { subject: "sub-anon-1", session: "sess-anon-2" },
    });

    expect(activity.logActivity).toHaveBeenCalledWith(
      db,
      actor,
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      expect.objectContaining({
        via: "mcp",
        ok: true,
        clientSubject: "sub-anon-1",
        clientSession: "sess-anon-2",
      }),
    );
  });

  it("omits client hint fields entirely when no hints were provided", async () => {
    await executeMcpTool({
      db,
      actor,
      name: "listCustomers",
      tool: stubTool(async () => ({ success: true, count: 0, customers: [] })),
      args: {},
    });

    const loggedMetadata = activity.logActivity.mock.calls[0][4];
    expect(loggedMetadata).not.toHaveProperty("clientSubject");
    expect(loggedMetadata).not.toHaveProperty("clientSession");
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

  describe("audit-log redaction (oversized string args)", () => {
    it("elides a multi-megabyte string argument before the audit write", async () => {
      const huge = "a".repeat(2_000_000);

      await executeMcpTool({
        db,
        actor,
        name: "uploadLandingPageImage",
        tool: stubTool(async () => ({
          success: true,
          uploadJobId: "lpimg-elidedtest000000000000000000000",
          status: "processing" as const,
          r2Key: "landing/elidedtest0000000000000000000000.png",
          src: "https://media.example.com/landing/x.png",
          note: "n",
        })),
        args: { landingPageId: "lp-1", imageBase64: huge },
      });

      const loggedMetadata = activity.logActivity.mock.calls[0][4];
      expect(loggedMetadata).toMatchObject({
        via: "mcp",
        ok: true,
        args: {
          landingPageId: "lp-1",
          imageBase64: "<2000000 chars elided>",
        },
      });
      expect(JSON.stringify(loggedMetadata).length).toBeLessThan(500);
    });

    it("elides oversized strings nested inside arrays and objects", async () => {
      const huge = "b".repeat(5_000);

      await executeMcpTool({
        db,
        actor,
        name: "someTool",
        tool: stubTool(async () => ({ success: true })),
        args: { items: [{ data: huge }], keep: "short" },
      });

      const loggedMetadata = activity.logActivity.mock.calls[0][4];
      expect(loggedMetadata).toMatchObject({
        args: {
          items: [{ data: "<5000 chars elided>" }],
          keep: "short",
        },
      });
    });

    it("keeps short arguments byte-for-byte intact", async () => {
      await executeMcpTool({
        db,
        actor,
        name: "deleteCustomer",
        tool: stubTool(async () => ({ success: true, message: "Customer deleted" })),
        args: { customerId: "c1", note: "VIP — handle with care" },
      });

      const loggedMetadata = activity.logActivity.mock.calls[0][4];
      expect(loggedMetadata).toMatchObject({
        args: { customerId: "c1", note: "VIP — handle with care" },
      });
    });
  });
});
