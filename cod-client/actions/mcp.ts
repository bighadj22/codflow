"use server";

/**
 * Server actions for the /mcp page.
 *
 * READS go straight to D1 via the shared query in cod-shared — MCP
 * connection state is private to this tenant and every caller is already
 * authenticated through the dashboard, so the cod-server HTTP hop would
 * add one TLS round-trip per page load for no gain. Matches how the
 * dashboard brand + store domain helpers read D1 directly (lib/brand.ts).
 *
 * WRITES (revoke) still go through cod-server so the audit log
 * (`MCP_CONNECTION_REVOKED` in activity_log) stays centralised — the
 * dashboard shouldn't have to duplicate that logic.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getUserApiKey, requirePermission, getUser } from "@/lib/auth";
import { getDb } from "@/db";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  listMcpConnections,
  type McpConnection as SharedMcpConnection,
} from "@/../cod-shared/queries/mcp-connections";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
  error?: string;
}

/** Re-export so the page / view don't cross-import cod-shared. */
export type McpConnection = SharedMcpConnection;

/**
 * The MCP URL to paste into Claude Desktop / Claude.ai / etc.
 * Derived from NEXT_PUBLIC_WORKER_URL at the cod-client env layer. Never
 * constructed on the client — we keep it sourced from one place so a future
 * multi-region deploy only has to update the env var.
 */
export interface McpConfig {
  mcpUrl: string;
  /** Brand display name (already branded per tenant). */
  brandName: string;
  /** Current signed-in user; the page embeds the email in the "signed in as" line. */
  currentUserId: string;
  currentUserEmail: string;
  currentUserRole: "admin" | "staff";
}

/**
 * Server-only: return the config the MCP page needs that doesn't
 * require a round-trip to cod-server. Lightning-fast.
 */
export async function getMcpConfig(): Promise<McpConfig> {
  await requirePermission(SCOPES.MCP_VIEW);
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const { env } = await getCloudflareContext({ async: true });
  const mcpUrl = `${(env.NEXT_PUBLIC_WORKER_URL ?? "").replace(/\/+$/, "")}/mcp`;

  // Brand name comes from the dashboard brand helper; the caller can also
  // read it via getDashboardBrand() if richer fields (logo, colors) are
  // needed, but the typical MCP page only wants the display name.
  const brandName = env.NEXT_PUBLIC_APP_URL
    ? new URL(env.NEXT_PUBLIC_APP_URL).hostname
    : "CodFlow";

  return {
    mcpUrl,
    brandName,
    currentUserId:    user.id,
    currentUserEmail: user.email,
    currentUserRole:  user.role,
  };
}

/**
 * Caller's own MCP connections, read directly from D1.
 */
export async function listMyMcpConnections(): Promise<McpConnection[]> {
  await requirePermission(SCOPES.MCP_VIEW);
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return listMcpConnections(db, { userId: user.id });
}

/**
 * Admin-only: every team member's MCP connections.
 * Returns an empty array for non-admins so the UI can cleanly omit the
 * Team Connections section without throwing.
 */
export async function listTeamMcpConnections(): Promise<McpConnection[]> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin") return [];

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return listMcpConnections(db, {});
}

/**
 * Revoke YOUR OWN connection to this MCP client. The server deletes the
 * consent row + all live access and refresh tokens for (you, clientId).
 */
export async function revokeMyMcpConnection(clientId: string): Promise<void> {
  await requirePermission(SCOPES.MCP_VIEW);
  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse<unknown>>(`/api/mcp/connections/${encodeURIComponent(clientId)}`, apiKey);
    revalidatePath("/mcp");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      throw new Error(mapError(error.code, locale, error.context));
    }
    throw error;
  }
}

/**
 * Admin-only: revoke ANOTHER user's connection to an MCP client. Useful when
 * a staff member leaves the team and you don't want their Claude instance
 * to keep talking to your CRM.
 */
export async function revokeUserMcpConnection(clientId: string, userId: string): Promise<void> {
  const user = await getUser();
  if (user?.role !== "admin") throw new Error("Admin access required");

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse<unknown>>(
      `/api/mcp/connections/${encodeURIComponent(clientId)}/users/${encodeURIComponent(userId)}`,
      apiKey,
    );
    revalidatePath("/mcp");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      throw new Error(mapError(error.code, locale, error.context));
    }
    throw error;
  }
}
