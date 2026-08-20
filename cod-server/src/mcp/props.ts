/**
 * McpProps — the per-session user context handed to the MCP Durable Object.
 *
 * Populated by `bearerToProps()` in `./auth.ts` after verifying the OAuth
 * access token, then stashed on `executionCtx.props` before delegating to
 * `CodMcpAgent`. Every tool execution reads from these fields:
 *   • `scopes` — decides which tools got registered for this session
 *     (see `./registry.ts buildToolsForUser`)
 *   • `role`   — admin wildcard bypass
 *   • `userId` + `name` + `email` — audit-log attribution
 *
 * Stable shape intentional: changes here cascade to the registry, agent,
 * activity log, and every ai-tools factory call site.
 */
export interface McpProps extends Record<string, unknown> {
  /** Better Auth user UUID (JWT `sub` claim). */
  userId: string;
  /** Admin or staff; admins bypass every scope check. */
  role: "admin" | "staff";
  /**
   * Scopes granted to this OAuth token (from JWT `scope` claim, space-separated).
   * Never includes "*" — admin bypass uses `role`, not a wildcard scope.
   */
  scopes: string[];
  /** Display name for audit log attribution. May be empty string if user row lacks it. */
  name: string;
  /** User email — useful for log correlation with the existing activity-log shape. */
  email: string;
}
