/**
 * /api/mcp — endpoints for the MCP management page in cod-client.
 *
 * Three handlers:
 *   GET    /api/mcp/me                      — the caller's connections
 *   GET    /api/mcp/team                    — admin-only: everyone's connections
 *   DELETE /api/mcp/connections/:clientId   — revoke the caller's grant
 *   DELETE /api/mcp/connections/:clientId/users/:userId  — admin: revoke for anyone
 *
 * "Connection" is a synthetic aggregate we compute per (userId, clientId):
 *   • scopes       — flattened union of scopes from all active access tokens
 *   • lastUsedAt   — max(accessToken.createdAt) (proxy: tokens are short-lived
 *                    and re-minted on refresh, so freshest token ≈ last use)
 *   • createdAt    — min(consent.createdAt) for that pair
 *   • clientName   — from oauthClients.name
 *   • clientIcon   — from oauthClients.icon
 *
 * Data sources:
 *   oauthConsents        one row per (user, client, scope-set) — the permission grant
 *   oauthAccessTokens    issued bearer tokens; has createdAt + expiresAt
 *   oauthRefreshTokens   issued refresh tokens; has revoked, expiresAt
 *   oauthClients         the requesting app's display metadata
 *
 * Revocation strategy:
 *   1. Delete the consent row(s) for (userId, clientId)
 *   2. Delete all refresh tokens for (userId, clientId)
 *   3. Delete all access tokens for (userId, clientId)
 *   This severs every path Claude could use to keep talking to our /mcp.
 *   Deletion is transactionless (D1 limit); we run three sequential deletes.
 *   If any step fails we return 500 and the caller can retry — idempotent.
 */

import type { Context } from "hono";
import { and, eq } from "drizzle-orm";

import type { AppContext } from "@/types";
import { getDb } from "@/db";
import {
  oauthConsents,
  oauthAccessTokens,
  oauthRefreshTokens,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors/classes";
import { ACTIONS, logActivity } from "@/lib/activity";
import { listMcpConnections } from "../../../../cod-shared/queries/mcp-connections";

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /api/mcp/me
 * Returns the caller's own MCP connections. Gated by SCOPES.MCP_VIEW (route level).
 */
export async function listMyConnections(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const user = c.get("user")!;
  const connections = await listMcpConnections(db, { userId: user.id });
  return c.json({ success: true, data: connections, count: connections.length });
}

/**
 * GET /api/mcp/team
 * Admin-only. Returns every user's MCP connections, each decorated with
 * their user info so the UI can group by teammate.
 */
export async function listTeamConnections(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const connections = await listMcpConnections(db, {});
  return c.json({ success: true, data: connections, count: connections.length });
}

/**
 * DELETE /api/mcp/connections/:clientId
 * Revoke the CALLER's grant against this client. Deletes consent + tokens.
 */
export async function revokeMyConnection(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const user = c.get("user")!;
  const clientId = c.req.param("clientId")!;
  return revokeConnection(c, db, user.id, user.name ?? user.email, clientId);
}

/**
 * DELETE /api/mcp/connections/:clientId/users/:userId
 * Admin-only. Revoke ANY user's grant against this client.
 */
export async function revokeUserConnection(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const targetUserId = c.req.param("userId")!;
  const clientId = c.req.param("clientId")!;
  const actor = c.get("user")!;
  return revokeConnection(c, db, targetUserId, actor.name ?? actor.email, clientId, { actorRole: "admin" });
}

async function revokeConnection(
  c: Context<AppContext>,
  db: ReturnType<typeof getDb>,
  targetUserId: string,
  actorDisplayName: string,
  clientId: string,
  meta?: { actorRole?: "admin" },
) {
  // Guard: the grant must exist before we claim to revoke anything.
  const existing = await db
    .select({ clientId: oauthConsents.clientId })
    .from(oauthConsents)
    .where(and(eq(oauthConsents.userId, targetUserId), eq(oauthConsents.clientId, clientId)))
    .get();
  if (!existing) {
    throw new NotFoundError("MCP connection", `${targetUserId}:${clientId}`);
  }

  // Sequential deletes — D1 does not support transactions (feedback memory).
  // Order matters: tokens reference the consent implicitly via client_id;
  // clearing tokens first kills live sessions immediately so a racing MCP
  // call can't squeeze through while we're still deleting the consent.
  await db.delete(oauthAccessTokens).where(
    and(eq(oauthAccessTokens.userId, targetUserId), eq(oauthAccessTokens.clientId, clientId)),
  );
  await db.delete(oauthRefreshTokens).where(
    and(eq(oauthRefreshTokens.userId, targetUserId), eq(oauthRefreshTokens.clientId, clientId)),
  );
  await db.delete(oauthConsents).where(
    and(eq(oauthConsents.userId, targetUserId), eq(oauthConsents.clientId, clientId)),
  );

  const actor = c.get("user")!;
  await logActivity(
    db,
    actor,
    ACTIONS.MCP_CONNECTION_REVOKED,
    { type: "oauthClient", id: clientId, label: clientId },
    { targetUserId, byAdmin: meta?.actorRole === "admin" },
  );

  return c.json({ success: true, data: { clientId, userId: targetUserId } });
}
