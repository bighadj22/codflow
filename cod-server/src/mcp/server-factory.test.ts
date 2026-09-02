/**
 * createCodMcpServer — scope-gated tool registration on the stateless
 * SDK v2 server, with identity read from the OAuthProvider's verified context.
 *
 * Contract:
 *   • registers exactly the tools `buildToolsForUser` returns for the identity
 *   • no verified identity → zero tools (fail closed)
 *   • dangerous tools run the two-round `inputRequired` confirmation: first
 *     round prompts, second round executes only on an accepted confirmation
 *   • dangerous tools fail CLOSED when no confirmation key is configured
 *   • safe tools run through the shared execution wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRequestStateCodec,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import type { Tool } from "ai";

const mocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: { MCP_TOOL_CALLED: "mcp.tool_called", MCP_TOOL_DECLINED: "mcp.tool_declined" },
  buildToolsForUser: vi.fn(),
  getDb: vi.fn(() => ({})),
  getMcpAuthContext: vi.fn<() => { props: unknown } | undefined>(() => undefined),
}));

vi.mock("@/lib/activity", () => ({
  logActivity: mocks.logActivity,
  ACTIONS: mocks.ACTIONS,
}));
vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("./registry", () => ({ buildToolsForUser: mocks.buildToolsForUser }));
vi.mock("./elicit", () => ({
  isDangerous: (name: string) => name === "deleteCustomer",
}));
vi.mock("agents/mcp/server", () => ({
  getMcpAuthContext: mocks.getMcpAuthContext,
  createMcpHandler: vi.fn(),
}));

import { createCodMcpServer } from "./server-factory";
import type { ConfirmationState } from "./confirm-tool";
import type { McpProps } from "./props";
import type { Env } from "@/types/env";

const props: McpProps = {
  userId: "u1",
  role: "staff",
  scopes: [],
  name: "Ada",
  email: "ada@example.com",
};

const KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes
const env = { DB: {}, MCP_REQUEST_STATE_KEY: KEY } as unknown as Env;
const envWithoutKey = { DB: {} } as unknown as Env;

interface RegisteredToolEntry {
  handler: (args: unknown, ctx: unknown) => unknown;
}

function registeredToolNames(server: unknown): string[] {
  const tools = (server as { _registeredTools: Record<string, unknown> })._registeredTools;
  return Object.keys(tools).sort();
}

function registeredHandler(server: unknown, name: string): RegisteredToolEntry["handler"] {
  const tools = (server as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
  return tools[name]!.handler;
}

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

const safeTool = { description: "List customers", execute: vi.fn(async () => ({ success: true })) } as unknown as Tool;
const dangerousTool = { description: "Delete customer", execute: vi.fn(async () => ({ success: true })) } as unknown as Tool;
const dangerousArgs = { customerId: "c1" };

async function confirmThrough(server: unknown, ctx: ServerContext): Promise<unknown> {
  const handler = registeredHandler(server, "deleteCustomer");
  const first = await handler(dangerousArgs, ctx);
  const codec = createRequestStateCodec<ConfirmationState>({
    key: KEY,
    bind: (c) => c.mcpReq.method,
  });
  const decoded = await codec.verify((first as InputRequiredResult).requestState!, ctx);
  return handler(dangerousArgs, makeCtx(decoded, ctx.mcpReq.inputResponses));
}

describe("createCodMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMcpAuthContext.mockReturnValue({ props });
  });

  it("registers zero tools without a verified identity", () => {
    mocks.getMcpAuthContext.mockReturnValue(undefined);

    const server = createCodMcpServer(env);

    expect(registeredToolNames(server)).toEqual([]);
  });

  it("registers exactly the tools buildToolsForUser returns", () => {
    mocks.buildToolsForUser.mockReturnValue({
      listCustomers: safeTool,
      deleteCustomer: dangerousTool,
    });

    const server = createCodMcpServer(env);

    expect(registeredToolNames(server)).toEqual(["deleteCustomer", "listCustomers"]);
  });

  it("prompts for confirmation on a dangerous tool and executes after acceptance", async () => {
    mocks.buildToolsForUser.mockReturnValue({ deleteCustomer: dangerousTool });
    const server = createCodMcpServer(env);

    const result = await confirmThrough(
      server,
      makeCtx(undefined, { confirmation: { action: "accept", content: { confirmed: true } } }),
    );

    expect(dangerousTool.execute).toHaveBeenCalledWith(dangerousArgs, { toolCallId: "" });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ success: true }) }] });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_called",
      { type: "tool", id: "deleteCustomer", label: "deleteCustomer" },
      expect.objectContaining({ ok: true }),
    );
  });

  it("does not execute a dangerous tool on decline", async () => {
    mocks.buildToolsForUser.mockReturnValue({ deleteCustomer: dangerousTool });
    const server = createCodMcpServer(env);

    const result = await confirmThrough(server, makeCtx(undefined, { confirmation: { action: "decline" } }));

    expect(dangerousTool.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: "text", text: "Action cancelled by user." }] });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_declined",
      { type: "tool", id: "deleteCustomer", label: "deleteCustomer" },
      expect.objectContaining({ reason: "user-declined" }),
    );
  });

  it("fails closed for dangerous tools when no confirmation key is configured", async () => {
    mocks.buildToolsForUser.mockReturnValue({ deleteCustomer: dangerousTool });

    const server = createCodMcpServer(envWithoutKey);
    const result = await registeredHandler(server, "deleteCustomer")(dangerousArgs, {});

    expect(dangerousTool.execute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_declined",
      { type: "tool", id: "deleteCustomer", label: "deleteCustomer" },
      expect.objectContaining({ reason: "confirmation-unavailable" }),
    );
  });

  it("runs safe tools through the execution wrapper", async () => {
    mocks.buildToolsForUser.mockReturnValue({ listCustomers: safeTool });

    const server = createCodMcpServer(env);
    const result = await registeredHandler(server, "listCustomers")({}, makeCtx(undefined, {}));

    expect(safeTool.execute).toHaveBeenCalledWith({}, { toolCallId: "" });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ success: true }) }] });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      expect.objectContaining({ ok: true }),
    );
  });
});
