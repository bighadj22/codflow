import type { Tool } from "ai";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { AppDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";

/** Audit attribution for one MCP tool call. Mirrors the activity-log actor shape. */
export interface McpActor {
  id: string;
  name: string;
  role: "admin" | "staff";
}

export interface ExecuteToolInput {
  db: AppDb;
  actor: McpActor;
  name: string;
  tool: Tool;
  args: unknown;
}

export type McpToolResult = CallToolResult;

/**
 * Run one registered MCP tool and produce its MCP text result.
 *
 * Behaviour:
 *   • executes the wrapped Vercel-AI-SDK tool with a stable toolCallId;
 *   • treats `{ success: false, error }` handled failures and thrown errors
 *     identically: an `isError: true` result plus an `ok: false` activity row;
 *   • always writes exactly one `mcp.tool_called` audit row (best-effort, never
 *     throws when the log write fails).
 */
export async function executeMcpTool({
  db,
  actor,
  name,
  tool,
  args,
}: ExecuteToolInput): Promise<McpToolResult> {
  let ok = true;
  let errorMessage: string | undefined;
  let result: unknown;

  try {
    const execute = (tool as { execute?: (args: unknown, ctx: unknown) => unknown }).execute;
    if (typeof execute !== "function") {
      throw new Error(`Tool ${name} has no execute()`);
    }
    result = await execute(args, { toolCallId: "" });
    if (result && typeof result === "object" && (result as { success?: boolean }).success === false) {
      ok = false;
      errorMessage = (result as { error?: string }).error;
    }
  } catch (err) {
    ok = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await logActivity(
    db,
    actor,
    ACTIONS.MCP_TOOL_CALLED,
    { type: "tool", id: name, label: name },
    { via: "mcp", args, ok, ...(errorMessage ? { error: errorMessage } : {}) },
  );

  if (!ok) {
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }) }],
      isError: true,
    };
  }

  return { content: [{ type: "text", text: safeJSON(result) }] };
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
