import type { Tool } from "ai";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { AppDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";
import { TOOL_OUTPUT_SCHEMAS } from "./schemas";

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
  /**
   * Client-supplied per-request hints (openai/subject, openai/session) —
   * anonymized correlation ids, never authorization-relevant. Merged into the
   * audit row when present.
   */
  clientMeta?: { subject?: string; session?: string };
}

export type McpToolResult = CallToolResult;

/**
 * Cap on any single string value written to the activity log. MCP tool args
 * can carry large payloads (e.g. base64 image bytes in future upload tools);
 * an audit row must never balloon to megabytes. Oversized values are replaced
 * by a size marker — shape is preserved so the audit trail stays readable.
 */
const MAX_AUDIT_STRING_LENGTH = 1024;
/** Defense against pathological nesting; MCP args are JSON so this is generous. */
const MAX_AUDIT_DEPTH = 8;

export function redactForAudit(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > MAX_AUDIT_STRING_LENGTH
      ? `<${value.length} chars elided>`
      : value;
  }
  if (depth >= MAX_AUDIT_DEPTH) return value;
  if (Array.isArray(value)) return value.map((v) => redactForAudit(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactForAudit(v, depth + 1)]),
    );
  }
  return value;
}

/**
 * Run one registered MCP tool and produce its MCP result.
 *
 * Behaviour:
 *   • executes the wrapped Vercel-AI-SDK tool with a stable toolCallId;
 *   • treats `{ success: false, error }` handled failures and thrown errors
 *     identically: an `isError: true` result plus an `ok: false` activity row;
 *   • when the tool declares an output schema, validates the result against
 *     it and attaches it as `structuredContent` (the spec-compliant form
 *     clients validate and models parse; the JSON text block stays for
 *     backwards compatibility). A validation failure means schema drift —
 *     logged loudly, structuredContent omitted, the text result still ships;
 *   • always writes exactly one `mcp.tool_called` audit row (best-effort,
 *     never throws when the log write fails).
 */
export async function executeMcpTool({
  db,
  actor,
  name,
  tool,
  args,
  clientMeta,
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
    {
      via: "mcp",
      args: redactForAudit(args),
      ok,
      ...(errorMessage ? { error: errorMessage } : {}),
      ...(clientMeta?.subject !== undefined ? { clientSubject: clientMeta.subject } : {}),
      ...(clientMeta?.session !== undefined ? { clientSession: clientMeta.session } : {}),
    },
  );

  const structured = structuredContentFor(name, ok ? result : { success: false, error: errorMessage });

  if (!ok) {
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }) }],
      ...(structured !== undefined ? { structuredContent: structured } : {}),
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: safeJSON(result) }],
    ...(structured !== undefined ? { structuredContent: structured } : {}),
  };
}

/**
 * Validate a tool result against its declared output schema and return the
 * structuredContent value, or undefined when the tool declares no schema or
 * the result does not conform (drift — logged; the text fallback still ships
 * so a schema bug can never break a working tool).
 */
function structuredContentFor(name: string, result: unknown): unknown {
  const schema = TOOL_OUTPUT_SCHEMAS[name];
  if (!schema) return undefined;
  const parsed = schema.safeParse(result);
  if (parsed.success) return result;
  console.error(
    `[mcp] structuredContent validation failed for tool ${name} — result does not match its output schema (omitting structuredContent):`,
    parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; "),
  );
  return undefined;
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
