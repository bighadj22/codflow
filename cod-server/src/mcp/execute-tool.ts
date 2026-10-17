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
 *     clients validate and models parse; the JSON text block also ships). A
 *     validation failure means schema drift — logged loudly, then surfaced as
 *     an `isError: true` result whose structuredContent is the schema-valid
 *     failure envelope (an advertised outputSchema must always come with
 *     structuredContent, or clients reject the call);
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

  const outcome = structuredContentFor(name, ok ? result : { success: false, error: errorMessage });

  if (!ok) {
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }) }],
      ...(outcome.structuredContent !== undefined
        ? { structuredContent: outcome.structuredContent }
        : {}),
      isError: true,
    };
  }

  if (outcome.driftError !== undefined) {
    // The tool declares an output schema but the result does not conform.
    // MCP clients require structuredContent whenever an outputSchema is
    // advertised, so a text-only fallback is a protocol violation
    // ("Tool <name> has an output schema but no structured content was
    // provided"). Ship the schema-valid failure envelope and keep the raw
    // payload readable in a second text block.
    const envelope = outcome.structuredContent ?? {
      success: false,
      error: outcome.driftError,
    };
    return {
      content: [
        { type: "text", text: safeJSON(envelope) },
        { type: "text", text: `Raw tool output (did not match the declared schema):\n${safeJSON(result)}` },
      ],
      ...(outcome.structuredContent !== undefined
        ? { structuredContent: outcome.structuredContent }
        : {}),
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: safeJSON(result) }],
    ...(outcome.structuredContent !== undefined
      ? { structuredContent: outcome.structuredContent }
      : {}),
  };
}

interface StructuredOutcome {
  /** Schema-valid value to attach as structuredContent, when any. */
  structuredContent?: unknown;
  /** Set when the tool declares an output schema the result fails to satisfy. */
  driftError?: string;
}

/**
 * Validate a tool result against its declared output schema.
 *
 * Returns the value to attach as `structuredContent`:
 *   • the result itself when it conforms;
 *   • the tool's universal failure envelope `{ success: false, error }` when it
 *     does not — that envelope validates against every `toolOutput()` schema,
 *     so a tool that advertises an outputSchema always ships structuredContent
 *     (see executeMcpTool's drift branch);
 *   • nothing when the tool declares no schema (or a hand-rolled one rejects
 *     the failure envelope too).
 *
 * Drift is logged loudly and surfaced as `driftError` so the caller can mark
 * the call as an error instead of silently dropping the structured output.
 */
function structuredContentFor(name: string, result: unknown): StructuredOutcome {
  const schema = TOOL_OUTPUT_SCHEMAS[name];
  if (!schema) return {};
  const parsed = schema.safeParse(result);
  if (parsed.success) return { structuredContent: result };
  const detail = parsed.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
  console.error(
    `[mcp] structuredContent validation failed for tool ${name} — result does not match its output schema (falling back to the schema-valid failure envelope): ${detail}`,
  );
  const driftError =
    `Tool ${name} returned data that does not match its declared output schema (${detail}). ` +
    `This is a server-side schema bug; the raw output is in the next text block.`;
  const fallback = { success: false, error: driftError };
  return schema.safeParse(fallback).success
    ? { structuredContent: fallback, driftError }
    : { driftError };
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
