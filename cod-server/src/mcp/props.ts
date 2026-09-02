/**
 * McpProps — the per-request identity snapshot handed to the MCP server.
 *
 * Populated at OAuth `completeAuthorization` time by the
 * `@cloudflare/workers-oauth-provider` default handler and carried into the
 * stateless SDK v2 handler as the provider's application props, read via
 * `getMcpAuthContext()` inside `createCodMcpServer` (`./server-factory.ts`).
 * Every tool execution reads from these fields:
 *   • `scopes` — decides which tools got registered for this request
 *     (see `./registry.ts buildToolsForUser`)
 *   • `role`   — admin wildcard bypass
 *   • `userId` + `name` + `email` — audit-log attribution
 *
 * Stable shape intentional: changes here cascade to the registry, server
 * factory, activity log, and every ai-tools factory call site.
 */
export interface McpProps extends Record<string, unknown> {
  /** Better Auth user UUID. */
  userId: string;
  /** Admin or staff; admins bypass every scope check. */
  role: "admin" | "staff";
  /**
   * Scopes granted to this OAuth grant. Never includes "*" — admin bypass uses
   * `role`, not a wildcard scope.
   */
  scopes: string[];
  /** Display name for audit log attribution. May be empty string if user row lacks it. */
  name: string;
  /** User email — useful for log correlation with the existing activity-log shape. */
  email: string;
}
