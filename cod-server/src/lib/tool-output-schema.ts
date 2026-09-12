/**
 * Output-schema envelope for MCP tools.
 *
 * Every tool in every ai-tools domain returns one of exactly two shapes:
 *   • { success: true,  ...payload } — the call's data
 *   • { success: false, error }     — a handled failure the model can act on
 *
 * toolOutput() builds the Zod union describing both, so the advertised
 * outputSchema (tools/list) and the structuredContent validation (tools/call,
 * see src/mcp/execute-tool.ts) share one definition — same drift-proof
 * invariant as the input schemas.
 *
 * Payload objects are LOOSE (additionalProperties allowed): declared fields
 * are validated and documented for the model; undeclared fields pass through
 * instead of failing the whole result. Entity passthroughs (DB rows) should
 * declare only fields whose presence is guaranteed; uncertain fields stay
 * undeclared or optional so a row-shape change can never silently strip a
 * tool's structured output.
 */
import { z } from "zod";

export function toolOutput<P extends z.ZodRawShape>(payload: P) {
  return z.union([
    z.looseObject({
      success: z.literal(true).describe("The call succeeded"),
      ...payload,
    }),
    z.looseObject({
      success: z.literal(false).describe("The call failed"),
      error: z.string().describe("What went wrong and how to recover — fix the inputs and retry when possible"),
    }),
  ]);
}

/** ISO-8601 timestamp string (all dates in tool results are stored as such). */
export const timestampSchema = z.string().describe("ISO-8601 timestamp");
