/**
 * MCP protocol negotiation — `/mcp` serves both protocol eras.
 *
 * Contract:
 *   • a claim-less `initialize` naming a 2025-era revision — the handshake
 *     every MCP client in wide use sends today — is answered with that
 *     revision, never with the modern-only `-32022 Unsupported protocol
 *     version` rejection
 *   • the handler is built WITHOUT `legacy: "reject"`: that option does not
 *     mean "stateless", it drops the Agents SDK's 2025-era lane and makes the
 *     endpoint modern-only (2026-07-28), failing every client at the handshake
 */

import { describe, it, expect } from "vitest";
import { createCodMcpHandler } from "./server-factory";
import type { Env } from "@/types/env";

/** The exact bytes OpenCode 2.0.27 sends, captured off the wire. */
const OPENCODE_INITIALIZE = JSON.stringify({
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {
      elicitation: { form: { applyDefaults: true }, url: {} },
      roots: {},
    },
    clientInfo: { name: "opencode", version: "2.0.27" },
  },
  jsonrpc: "2.0",
  id: 0,
});

type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Promise<Response>;

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function initialize(headers: Record<string, string> = {}): Request {
  return new Request("https://api.example.com/mcp?codemode=false", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: OPENCODE_INITIALIZE,
  });
}

describe("MCP protocol negotiation", () => {
  it("answers a claim-less 2025-era initialize with that revision", async () => {
    const handler = createCodMcpHandler({} as Env) as unknown as Handler;

    const res = await handler(initialize(), {} as Env, ctx);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('"protocolVersion":"2025-11-25"');
    expect(text).not.toContain("Unsupported protocol version");
  });

  it("answers the same initialize when the client repeats the version header", async () => {
    const handler = createCodMcpHandler({} as Env) as unknown as Handler;

    const res = await handler(
      initialize({ "mcp-protocol-version": "2025-11-25" }),
      {} as Env,
      ctx,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"protocolVersion":"2025-11-25"');
  });
});
