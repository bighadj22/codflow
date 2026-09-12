import {
  McpServer,
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
import { TOOL_SCHEMAS, TOOL_META, TOOL_OUTPUT_SCHEMAS } from "./schemas";
import { TOOL_ANNOTATIONS } from "./annotations";
import { TOOL_TITLES } from "./tool-titles";
import { checkMcpRateLimit, readClientMeta, type ClientMeta } from "./request-context";
import { executeMcpTool, redactForAudit, type McpActor } from "./execute-tool";
import { getDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";

interface ToolRegistration {
  db: ReturnType<typeof getDb>;
  actor: McpActor;
  name: string;
  tool: Tool;
  /** Worker env — reaches the RATE_LIMIT KV binding for the call-rate guard. */
  env: Env;
  /** Rate-limit fallback identity when the client sends no subject hint. */
  fallbackSubject: string;
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
  const server = new McpServer({ name: "CodFlow CRM", version: "1.0.0" });

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
    registerTool(server, {
      db,
      actor,
      name,
      tool,
      env,
      fallbackSubject: props.userId,
    });
  }

  return server;
}

/** Client hints as audit-row fields — short anonymized ids, correlation only. */
function clientMetaAuditFields(clientMeta: ClientMeta): Record<string, string> {
  return {
    ...(clientMeta.subject !== undefined ? { clientSubject: clientMeta.subject } : {}),
    ...(clientMeta.session !== undefined ? { clientSession: clientMeta.session } : {}),
  };
}

function registerTool(server: McpServer, registration: ToolRegistration): void {
  const { db, actor, name, tool, env, fallbackSubject } = registration;
  const description =
    typeof tool.description === "string" ? tool.description : `Tool: ${name}`;
  const inputSchema = z.object(TOOL_SCHEMAS[name] ?? {});
  // Client-specific tool-descriptor extensions (e.g. ChatGPT's
  // openai/fileParams) — absent for tools without an entry in TOOL_META.
  const toolMeta = TOOL_META[name];
  // Advertised output contract — structuredContent on every result is
  // validated against this in executeMcpTool.
  const outputSchema = TOOL_OUTPUT_SCHEMAS[name];

  server.registerTool(
    name,
    {
      description,
      // Human-readable name shown in client UIs; behavior hints that drive
      // client confirmation/safety framing (derived in ./annotations.ts).
      title: TOOL_TITLES[name] ?? name,
      annotations: TOOL_ANNOTATIONS[name],
      inputSchema,
      ...(outputSchema ? { outputSchema } : {}),
      ...(toolMeta ? { _meta: toolMeta } : {}),
    },
    async (args, ctx) => {
      // Client hints (openai/subject, openai/session) — correlation only,
      // never authorization. Subject keys the per-user rate counter.
      const clientMeta = readClientMeta(ctx);
      const rate = await checkMcpRateLimit(env.RATE_LIMIT, clientMeta.subject ?? fallbackSubject);
      if (!rate.allowed) {
        await logActivity(
          db,
          actor,
          ACTIONS.MCP_TOOL_CALLED,
          { type: "tool", id: name, label: name },
          {
            via: "mcp",
            args: redactForAudit(args),
            ok: false,
            error: `rate_limited (retry in ${rate.retryAfterSeconds}s)`,
            ...clientMetaAuditFields(clientMeta),
          },
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error:
                  `Rate limit exceeded — too many tool calls for this user. ` +
                  `Wait ${rate.retryAfterSeconds} seconds, then retry.`,
              }),
            },
          ],
          isError: true,
        };
      }

      // Every tool executes through the shared wrapper — destructive ones
      // included. Human confirmation is the CLIENT's documented job: ChatGPT
      // (and comparable clients) require merchant approval before write
      // actions, framed by our destructiveHint annotations; the server's
      // safety surface is scope gating + validation + the audit trail.
      return executeMcpTool({
        db,
        actor,
        name,
        tool,
        args,
        ...(Object.keys(clientMeta).length > 0 ? { clientMeta } : {}),
      });
    },
  );
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
