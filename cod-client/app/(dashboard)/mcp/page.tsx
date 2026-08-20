/**
 * /mcp — the AI Agents connection management page.
 *
 * Top-level route (NOT under /settings) so shop owners can find it fast.
 * Server component loads config + connections in parallel and hands them
 * to the client view. Gated by SCOPES.MCP_VIEW (or admin).
 *
 * Two lists:
 *   • Your connections    — visible to everyone with MCP_VIEW
 *   • Team connections    — admin-only; empty array for staff so the
 *                           client can cleanly conditionally-render.
 */

import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { McpPage } from "@/components/mcp/mcp-page";
import {
  getMcpConfig,
  listMyMcpConnections,
  listTeamMcpConnections,
} from "@/actions/mcp";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Connection lookups are best-effort — if D1 hiccups we'd rather show
  // the URL + setup guides (the part shop owners care about most) than
  // crash the whole page. Errors are observable in worker logs.
  const [config, myConnections, teamConnections] = await Promise.all([
    getMcpConfig(),
    listMyMcpConnections().catch(() => []),
    listTeamMcpConnections().catch(() => []),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.MCP_VIEW}>
      <McpPage
        config={config}
        myConnections={myConnections}
        teamConnections={teamConnections}
      />
    </ProtectedRoute>
  );
}
