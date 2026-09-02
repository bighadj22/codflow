import {
  acceptedContent,
  inputRequired,
  type CallToolResult,
  type InputRequiredResult,
  type RequestStateCodec,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Tool } from "ai";
import type { AppDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";
import { executeMcpTool, type McpActor } from "./execute-tool";

/**
 * State sealed into the multi-round-trip `requestState` for one confirmation.
 * The tool name and a stable JSON form of the args are bound so an echoed state
 * can only authorise the exact operation that was confirmed (the args the user
 * saw), never a different tool or a mutated payload.
 */
export interface ConfirmationState {
  tool: string;
  argsJson: string;
}

export const CONFIRMATION_KEY = "confirmation";

const confirmationSchema = z.object({ confirmed: z.boolean() });

export interface ConfirmToolInput {
  db: AppDb;
  actor: McpActor;
  name: string;
  tool: Tool;
  args: unknown;
  ctx: ServerContext;
  codec: RequestStateCodec<ConfirmationState>;
}

/**
 * Two-round confirmation gate for a dangerous tool (SDK v2 stateless
 * elicitation):
 *
 *   round 1 — no valid `requestState`: return `inputRequired` with a form-mode
 *             confirmation and a freshly minted, integrity-protected state.
 *   round 2 — the client echoes the state and an `inputResponses` entry; the
 *             server has already verified the state via the codec's `verify`
 *             hook, so here we only re-check the operation binding, validate
 *             the accepted content, and either run the tool or treat any
 *             decline / cancel / missing content as a normal cancel.
 */
export async function confirmTool(
  input: ConfirmToolInput,
): Promise<CallToolResult | InputRequiredResult> {
  const { db, actor, name, tool, args, ctx, codec } = input;

  const currentArgsJson = JSON.stringify(args ?? {});
  const state = ctx.mcpReq.requestState<ConfirmationState>();

  if (!state || state.tool !== name || state.argsJson !== currentArgsJson) {
    return inputRequired({
      inputRequests: {
        [CONFIRMATION_KEY]: inputRequired.elicit({
          message: confirmationMessage(name, args),
          requestedSchema: {
            type: "object",
            properties: {
              confirmed: {
                type: "boolean",
                title: "I confirm",
                description: "Proceed with this action.",
              },
            },
            required: ["confirmed"],
          },
        }),
      },
      requestState: await codec.mint({ tool: name, argsJson: currentArgsJson }, ctx),
    });
  }

  const confirmation = acceptedContent(
    ctx.mcpReq.inputResponses,
    CONFIRMATION_KEY,
    confirmationSchema,
  );
  if (!confirmation?.confirmed) {
    await logActivity(
      db,
      actor,
      ACTIONS.MCP_TOOL_DECLINED,
      { type: "tool", id: name, label: name },
      { via: "mcp", args, reason: "user-declined" },
    );
    return { content: [{ type: "text", text: "Action cancelled by user." }] };
  }

  return executeMcpTool({ db, actor, name, tool, args });
}

function confirmationMessage(name: string, args: unknown): string {
  return `Confirm ${name} with these arguments?\n${safeJSON(args)}`;
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
