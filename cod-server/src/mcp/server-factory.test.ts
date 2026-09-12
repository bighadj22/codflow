/**
 * createCodMcpServer — scope-gated tool registration on the stateless
 * SDK v2 server, with identity read from the OAuthProvider's verified context.
 *
 * Contract:
 *   • registers exactly the tools `buildToolsForUser` returns for the identity
 *   • no verified identity → zero tools (fail closed)
 *   • every tool — destructive ones included — executes through the shared
 *     wrapper: human confirmation is the CLIENT's documented job, framed by
 *     our destructiveHint annotations; the server gates by scope, validates,
 *     rate-limits, and audits
 *   • client hints (openai/subject, openai/session) reach the audit row
 *   • the per-subject rate limit blocks sustained flooding before execution
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerContext } from "@modelcontextprotocol/server";
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
// TOOL_REGISTRY is stubbed for consumers that derive from it (annotations)
// with an empty array — classification correctness is proven in
// annotations.test.ts against the REAL registry; here we assert wiring only.
vi.mock("./registry", () => ({
  buildToolsForUser: mocks.buildToolsForUser,
  TOOL_REGISTRY: [],
}));
vi.mock("agents/mcp/server", () => ({
  getMcpAuthContext: mocks.getMcpAuthContext,
  createMcpHandler: vi.fn(),
}));

import { createCodMcpServer } from "./server-factory";
import type { McpProps } from "./props";
import type { Env } from "@/types/env";

const props: McpProps = {
  userId: "u1",
  role: "staff",
  scopes: [],
  name: "Ada",
  email: "ada@example.com",
};

const env = { DB: {} } as unknown as Env;

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

function makeCtx(): ServerContext {
  return {
    mcpReq: {
      method: "tools/call",
      inputResponses: {},
      requestState: () => undefined,
    },
  } as unknown as ServerContext;
}

const safeTool = { description: "List customers", execute: vi.fn(async () => ({ success: true })) } as unknown as Tool;
const dangerousTool = { description: "Delete customer", execute: vi.fn(async () => ({ success: true })) } as unknown as Tool;
const dangerousArgs = { customerId: "c1" };

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

  it("attaches TOOL_META extensions to matching tools and to no others", () => {
    mocks.buildToolsForUser.mockReturnValue({
      listCustomers: safeTool,
      uploadLandingPageImage: safeTool,
    });

    const server = createCodMcpServer(env);

    const tools = (
      server as unknown as { _registeredTools: Record<string, Record<string, unknown>> }
    )._registeredTools;
    expect(tools["uploadLandingPageImage"]._meta).toEqual({
      "openai/fileParams": ["image"],
      "openai/toolInvocation/invoking": "Starting background image upload…",
      "openai/toolInvocation/invoked": "Upload job created — poll status until complete",
    });
    expect(tools["listCustomers"]._meta).toBeUndefined();
  });

  it("advertises human-readable titles and behavior annotations on every tool", () => {
    mocks.buildToolsForUser.mockReturnValue({
      listCustomers: safeTool,
      deleteCustomer: dangerousTool,
      uploadLandingPageImage: safeTool,
    });

    const server = createCodMcpServer(env);

    const tools = (
      server as unknown as {
        _registeredTools: Record<
          string,
          { title?: string; annotations?: Record<string, boolean> }
        >;
      }
    )._registeredTools;
    expect(tools["listCustomers"].title).toBe("List customers");
    expect(tools["uploadLandingPageImage"].title).toBe("Upload landing page image");
    // Wiring only: every tool carries a full four-hint annotation object.
    // The VALUES are proven in annotations.test.ts against the real registry.
    for (const name of ["listCustomers", "deleteCustomer", "uploadLandingPageImage"]) {
      expect(tools[name].annotations).toMatchObject({
        readOnlyHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
        idempotentHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
      });
    }
  });

  it("advertises the output schema for schema'd tools and none for others", () => {
    mocks.buildToolsForUser.mockReturnValue({
      listCustomers: safeTool,
      someUnschemaTool: safeTool,
    });

    const server = createCodMcpServer(env);

    const tools = (
      server as unknown as { _registeredTools: Record<string, { outputSchema?: unknown }> }
    )._registeredTools;
    expect(tools["listCustomers"].outputSchema).toBeDefined();
    expect(tools["someUnschemaTool"].outputSchema).toBeUndefined();
  });

  it("executes destructive tools directly through the wrapper — client-side confirmation is the human gate", async () => {
    mocks.buildToolsForUser.mockReturnValue({ deleteCustomer: dangerousTool });

    const server = createCodMcpServer(env);
    const result = await registeredHandler(server, "deleteCustomer")(dangerousArgs, makeCtx());

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

  it("runs safe tools through the execution wrapper", async () => {
    mocks.buildToolsForUser.mockReturnValue({ listCustomers: safeTool });

    const server = createCodMcpServer(env);
    const result = await registeredHandler(server, "listCustomers")({}, makeCtx());

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

  it("threads client hints (subject/session) into the audit row", async () => {
    mocks.buildToolsForUser.mockReturnValue({ listCustomers: safeTool });

    const server = createCodMcpServer(env);
    const ctx = makeCtx();
    (ctx.mcpReq as unknown as Record<string, unknown>)._meta = {
      "openai/subject": "sub-anon-1",
      "openai/session": "sess-anon-2",
    };

    await registeredHandler(server, "listCustomers")({}, ctx);

    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      expect.objectContaining({ ok: true, clientSubject: "sub-anon-1", clientSession: "sess-anon-2" }),
    );
  });

  it("blocks a tool call over the rate limit, before any execution, with a model-readable retry hint", async () => {
    mocks.buildToolsForUser.mockReturnValue({ listCustomers: safeTool });
    const kvStub = {
      get: async () => "9999",
      put: async () => undefined,
    };
    const envWithKv = { DB: {}, RATE_LIMIT: kvStub } as unknown as Env;

    const server = createCodMcpServer(envWithKv);
    const result = (await registeredHandler(server, "listCustomers")(
      {},
      makeCtx(),
    )) as { isError?: boolean; content: Array<{ text: string }> };

    expect(safeTool.execute).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(result.content[0].text).toContain("retry");
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", name: "Ada", role: "staff" },
      "mcp.tool_called",
      { type: "tool", id: "listCustomers", label: "listCustomers" },
      expect.objectContaining({ ok: false, error: expect.stringContaining("rate_limited") }),
    );
  });

  it("rate-limits on the client subject hint when present, not the user id", async () => {
    mocks.buildToolsForUser.mockReturnValue({ listCustomers: safeTool });
    const get = vi.fn(async (key: string) => (key.includes("sub-anon") ? "9999" : null));
    const kvStub = { get, put: async () => undefined };
    const envWithKv = { DB: {}, RATE_LIMIT: kvStub } as unknown as Env;

    const server = createCodMcpServer(envWithKv);
    const ctx = makeCtx();
    (ctx.mcpReq as unknown as Record<string, unknown>)._meta = { "openai/subject": "sub-anon" };

    const result = (await registeredHandler(server, "listCustomers")({}, ctx)) as {
      isError?: boolean;
    };
    expect(get).toHaveBeenCalledWith(expect.stringContaining("sub-anon"));
    expect(result.isError).toBe(true);
  });
});
