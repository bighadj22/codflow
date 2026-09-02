/**
 * confirmTool — the two-round SDK v2 `inputRequired` confirmation gate.
 *
 * Contract:
 *   • round 1 (no valid state) → `inputRequired` with a confirmation request
 *     and a minted, operation-bound `requestState`
 *   • round 2 + accepted confirmation → runs the tool via `executeMcpTool`
 *   • round 2 + decline / cancel / unchecked confirm → cancelled + `mcp.tool_declined`
 *   • state bound to a different tool or different args → re-request, never run
 *   • the codec rejects tampered / expired / rebound state
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRequestStateCodec,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import type { Tool } from "ai";

const activity = vi.hoisted(() => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: { MCP_TOOL_CALLED: "mcp.tool_called", MCP_TOOL_DECLINED: "mcp.tool_declined" },
}));

vi.mock("@/lib/activity", () => activity);

import { confirmTool, type ConfirmationState } from "./confirm-tool";
import type { McpActor } from "./execute-tool";

const KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes
const codec = createRequestStateCodec<ConfirmationState>({
  key: KEY,
  bind: (ctx) => ctx.mcpReq.method,
});

const actor: McpActor = { id: "u1", name: "Ada", role: "staff" };
const db = {} as never;

function makeCtx(
  state: ConfirmationState | undefined,
  inputResponses: Record<string, unknown> = {},
): ServerContext {
  return {
    mcpReq: {
      method: "tools/call",
      inputResponses,
      requestState: () => state,
    },
  } as unknown as ServerContext;
}

function stubTool(execute: (args: unknown, ctx: unknown) => unknown): Tool {
  return { description: "stub", execute } as unknown as Tool;
}

const baseArgs = { customerId: "c1" };

function baseInput(overrides: Partial<Parameters<typeof confirmTool>[0]> = {}) {
  return {
    db,
    actor,
    name: "deleteCustomer",
    tool: stubTool(async () => ({ success: true })),
    args: baseArgs,
    ctx: makeCtx(undefined),
    codec,
    ...overrides,
  } satisfies Parameters<typeof confirmTool>[0];
}

async function mintState(name: string, args: unknown): Promise<ConfirmationState> {
  const ctx = makeCtx(undefined);
  const wire = await codec.mint({ tool: name, argsJson: JSON.stringify(args ?? {}) }, ctx);
  return codec.verify(wire, ctx);
}

describe("confirmTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests confirmation on the first round and mints a state", async () => {
    const result = await confirmTool(baseInput());

    expect(result).toMatchObject({ resultType: "input_required" });
    const ir = result as InputRequiredResult;
    expect(ir.inputRequests).toHaveProperty("confirmation");
    expect(typeof ir.requestState).toBe("string");
  });

  it("executes the tool after an accepted confirmation", async () => {
    const execute = vi.fn(async () => ({ success: true }));
    const state = await mintState("deleteCustomer", baseArgs);

    const result = await confirmTool(
      baseInput({
        tool: stubTool(execute),
        ctx: makeCtx(state, { confirmation: { action: "accept", content: { confirmed: true } } }),
      }),
    );

    expect(execute).toHaveBeenCalledWith(baseArgs, { toolCallId: "" });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ success: true }) }],
    });
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "mcp.tool_called",
      expect.objectContaining({ id: "deleteCustomer" }),
      expect.objectContaining({ ok: true }),
    );
  });

  it("treats a decline as a cancel and does not run the tool", async () => {
    const execute = vi.fn(async () => ({ success: true }));
    const state = await mintState("deleteCustomer", baseArgs);

    const result = await confirmTool(
      baseInput({
        tool: stubTool(execute),
        ctx: makeCtx(state, { confirmation: { action: "decline" } }),
      }),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: "text", text: "Action cancelled by user." }] });
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "mcp.tool_declined",
      expect.objectContaining({ id: "deleteCustomer" }),
      expect.objectContaining({ reason: "user-declined" }),
    );
  });

  it("treats an unchecked confirmation as a cancel", async () => {
    const execute = vi.fn(async () => ({ success: true }));
    const state = await mintState("deleteCustomer", baseArgs);

    const result = await confirmTool(
      baseInput({
        tool: stubTool(execute),
        ctx: makeCtx(state, { confirmation: { action: "accept", content: { confirmed: false } } }),
      }),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: "text", text: "Action cancelled by user." }] });
  });

  it("re-requests confirmation when the state was minted for another tool", async () => {
    const state = await mintState("updateOrderStatus", { orderId: "o1" });

    const result = await confirmTool(
      baseInput({
        ctx: makeCtx(state, { confirmation: { action: "accept", content: { confirmed: true } } }),
      }),
    );

    expect(result).toMatchObject({ resultType: "input_required" });
  });

  it("re-requests confirmation when the args changed after minting", async () => {
    const state = await mintState("deleteCustomer", baseArgs);

    const result = await confirmTool(
      baseInput({
        args: { customerId: "c2" },
        ctx: makeCtx(state, { confirmation: { action: "accept", content: { confirmed: true } } }),
      }),
    );

    expect(result).toMatchObject({ resultType: "input_required" });
  });

  it("codec rejects a tampered state", async () => {
    const ctx = makeCtx(undefined);
    const wire = await codec.mint({ tool: "deleteCustomer", argsJson: JSON.stringify(baseArgs) }, ctx);

    await expect(codec.verify(`${wire}xx`, ctx)).rejects.toThrow();
  });
});
