/**
 * Tool annotations — derived, not hand-maintained.
 *
 * The MCP `ToolAnnotations` hints (readOnlyHint, destructiveHint,
 * idempotentHint, openWorldHint) tell clients like ChatGPT how cautious to be
 * with each tool: they drive confirmation framing and safety behavior.
 * OpenAI's plugin reference marks them Required; mislabeling is a documented
 * rejection reason.
 *
 * Instead of 96 hand-written entries that drift, annotations are DERIVED from
 * the two classifications the platform already owns:
 *   • scope gating (TOOL_REGISTRY) — a tool registered ONLY under `*:read`
 *     scopes cannot mutate anything, so it is read-only and idempotent
 *   • risk classification (DANGEROUS_TOOLS) — every confirmation-gated tool
 *     is destructive
 *
 * Explicit overrides cover the few tools whose annotation differs from what
 * scope-gating alone would imply. The consistency invariants are proven by
 * tests in annotations.test.ts — a new registry tool automatically gets
 * correct annotations, and a misclassified one fails CI.
 */
import type { ToolAnnotations } from "@modelcontextprotocol/server";
import { TOOL_REGISTRY } from "./registry";
import { TOOL_NAMES, TOOL_SCHEMAS } from "./schemas";
import { DANGEROUS_TOOLS } from "./elicit";

/**
 * Read-only despite being registered under a manage scope. These are pure
 * reads gated more tightly on purpose (e.g. upload-status polling is only
 * useful to callers who can upload).
 */
const READ_ONLY_OVERRIDES: ReadonlySet<string> = new Set([
  "getLandingPageImageUploadStatus",
]);

/**
 * Tools that reach the open internet. `openWorldHint` is true only for these;
 * everything else touches a bounded private workspace (the merchant's store).
 */
const OPEN_WORLD_TOOLS: ReadonlySet<string> = new Set([
  "uploadLandingPageImage", // fetches agent-supplied public image URLs
]);

/**
 * Write tools documented as safe to repeat with the same arguments — the
 * group/tag membership operations are idempotent by design (onConflictDoNothing
 * / silent removal). All read-only tools are idempotent by derivation.
 */
const IDEMPOTENT_WRITE_TOOLS: ReadonlySet<string> = new Set([
  "addCustomerToGroup",
  "removeCustomerFromGroup",
  "assignTagToCustomer",
  "unassignTagFromCustomer",
]);

/** A registry entry gates read-only access when every required scope is a read scope. */
function isReadScopeEntry(entry: (typeof TOOL_REGISTRY)[number]): boolean {
  return entry.requires.every((scope) => scope.endsWith(":read"));
}

/** Tools selected by at least one write-scope entry — everything the read set does not cover. */
function writeScopeToolNames(): Set<string> {
  const out = new Set<string>();
  for (const entry of TOOL_REGISTRY) {
    if (!isReadScopeEntry(entry)) {
      for (const name of Object.keys(entry.build({} as never, {} as never, {} as never))) {
        out.add(name);
      }
    }
  }
  return out;
}

const WRITE_SCOPE_TOOLS = writeScopeToolNames();

function deriveAnnotations(name: string): ToolAnnotations {
  const isReadOnly = READ_ONLY_OVERRIDES.has(name) || !WRITE_SCOPE_TOOLS.has(name);
  return {
    readOnlyHint: isReadOnly,
    destructiveHint: !isReadOnly && DANGEROUS_TOOLS.has(name),
    idempotentHint: isReadOnly || IDEMPOTENT_WRITE_TOOLS.has(name),
    openWorldHint: OPEN_WORLD_TOOLS.has(name),
  };
}

export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = Object.fromEntries(
  TOOL_NAMES.map((name) => [name, deriveAnnotations(name)]),
);

export { READ_ONLY_OVERRIDES, OPEN_WORLD_TOOLS, IDEMPOTENT_WRITE_TOOLS, WRITE_SCOPE_TOOLS };
