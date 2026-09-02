import {
  McpServer,
  createRequestStateCodec,
  type RequestStateCodec,
} from "@modelcontextprotocol/server";
import {
  createMcpHandler,
  getMcpAuthContext,
  type CreateMcpHandlerOptions,
} from "agents/mcp/server";
import { z } from "zod";
import type { Tool } from "ai";
import type { Env } from "@/types/env";
import type { McpProps } from "./props";
import { buildToolsForUser } from "./registry";
import { TOOL_SCHEMAS } from "./schemas";
import { isDangerous } from "./elicit";
import { executeMcpTool, type McpActor } from "./execute-tool";
import { confirmTool, type ConfirmationState } from "./confirm-tool";
import { getDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";

const CONFIRMATION_KEY_MIN_BYTES = 32;

interface ToolRegistration {
  db: ReturnType<typeof getDb>;
  actor: McpActor;
  name: string;
  tool: Tool;
  confirmationCodec: RequestStateCodec<ConfirmationState> | undefined;
}

/**
 * Build a fresh stateless MCP server for one request, registering exactly the
 * tools the verified identity's OAuth scopes allow (registration-time gating —
 * the client's model never sees a tool it cannot run).
 *
 * Identity is read from `getMcpAuthContext().props`, populated by the
 * `@cloudflare/workers-oauth-provider` verified context (the props set at
 * `completeAuthorization`). When no verified identity is present the server
 * registers zero tools — fail closed by construction.
 */
export function createCodMcpServer(env: Env): McpServer {
  const confirmationCodec = createConfirmationCodec(env);
  const server = new McpServer(
    { name: "CodFlow CRM", version: "1.0.0" },
    confirmationCodec ? { requestState: { verify: confirmationCodec.verify } } : undefined,
  );

  const props = getMcpAuthContext()?.props as McpProps | undefined;
  if (!props) {
    return server;
  }

  const db = getDb(env.DB);
  const actor: McpActor = {
    id: props.userId,
    name: props.name || props.email,
    role: props.role,
  };

  const tools = buildToolsForUser(env, props);
  for (const [name, tool] of Object.entries(tools)) {
    registerTool(server, { db, actor, name, tool, confirmationCodec });
  }

  return server;
}

function registerTool(server: McpServer, registration: ToolRegistration): void {
  const { db, actor, name, tool, confirmationCodec } = registration;
  const description =
    typeof tool.description === "string" ? tool.description : `Tool: ${name}`;
  const inputSchema = z.object(TOOL_SCHEMAS[name] ?? {});

  server.registerTool(
    name,
    { description, inputSchema },
    async (args, ctx) => {
      if (!isDangerous(name)) {
        return executeMcpTool({ db, actor, name, tool, args });
      }

      // Dangerous tools run through the two-round `inputRequired` confirmation.
      // Without a configured MCP_REQUEST_STATE_KEY they fail CLOSED — blocking
      // is the audit-safe default over running an unconfirmed dangerous action.
      if (!confirmationCodec) {
        await logActivity(
          db,
          actor,
          ACTIONS.MCP_TOOL_DECLINED,
          { type: "tool", id: name, label: name },
          { via: "mcp", args, reason: "confirmation-unavailable" },
        );
        return {
          content: [
            {
              type: "text",
              text: "This action requires confirmation before it can run, and confirmation is not yet available.",
            },
          ],
          isError: true,
        };
      }

      return confirmTool({ db, actor, name, tool, args, ctx, codec: confirmationCodec });
    },
  );
}

/**
 * Create the HMAC requestState codec for tool confirmation, or `undefined` when
 * confirmation cannot run (missing or too-short key). A short key would throw a
 * RangeError inside `createRequestStateCodec` and take down the whole endpoint,
 * so it is treated as "confirmation unavailable" and dangerous tools fail closed.
 */
function createConfirmationCodec(
  env: Env,
): RequestStateCodec<ConfirmationState> | undefined {
  const key = env.MCP_REQUEST_STATE_KEY;
  if (!key || key.length < CONFIRMATION_KEY_MIN_BYTES) return undefined;
  return createRequestStateCodec<ConfirmationState>({
    key,
    bind: (ctx) => ctx.mcpReq.method,
  });
}

/**
 * Create the stateless SDK v2 handler for this Worker.
 *
 * Identity is supplied by the OAuthProvider's verified context on each request
 * (`ctx.props` → `getMcpAuthContext()`); the handler is built per request to
 * capture `env`, and `legacy: "reject"` serves only stateless traffic.
 */
export function createCodMcpHandler(env: Env) {
  return createMcpHandler(
    () => createCodMcpServer(env),
    {
      route: "/mcp",
      legacy: "reject",
      // Browser Origin validation is wired in Slice 9.
      allowedOriginHostnames: "*",
    } satisfies CreateMcpHandlerOptions,
  );
}
