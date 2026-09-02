/**
 * /api/mcp — endpoints for the MCP management page.
 *
 *   GET    /api/mcp/me                      — the caller's connections
 *   GET    /api/mcp/team                    — admin-only: everyone's connections
 *   DELETE /api/mcp/connections/:clientId   — revoke the caller's grants
 *   DELETE /api/mcp/connections/:clientId/users/:userId  — admin: revoke for anyone
 *   DELETE /api/mcp/clients/:clientId       — admin: delete client + all its grants
 *
 * Data source is the OAuth provider's KV model (NOT the legacy D1 oauth
 * tables, which the provider never writes):
 *   • grants        — `listUserGrants(userId)`; one grant per authorization
 *                     (provider default keeps a single grant per user+client)
 *   • client info   — `lookupClient(clientId)`, falling back to the grant
 *                     metadata recorded at consent time (covers CIMD clients
 *                     whose metadata document cannot be re-fetched)
 *   • lastUsedAt    — the `mcp-last-used:` marker written by the token
 *                     exchange callback on every token issuance; null means
 *                     "no token issued since tracking began" (honest, no
 *                     bogus timestamps)
 *   • active        — the grant exists and is not expired; revocation
 *                     removes the grant entirely so listed = live
 *
 * Revocation strategy (provider-native):
 *   `revokeGrant(grantId, userId)` deletes the grant AND every access token
 *   under it; the provider's token validation rejects tokens whose grant is
 *   gone, so live sessions die immediately. Our last-used markers are
 *   deleted alongside.
 */

import type { Context } from "hono";
import { CimdFetchError } from "@cloudflare/workers-oauth-provider";
import type {
  ClientInfo,
  GrantSummary,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";

import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { NotFoundError } from "@/lib/errors/classes";
import { ACTIONS, logActivity } from "@/lib/activity";
import { deleteMcpLastUsed, readMcpLastUsed } from "@/mcp/last-used";

export interface McpConnection {
  clientId: string;
  clientName: string | null;
  clientIconUrl: string | null;
  clientHomepageUrl: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  active: boolean;
  /** Only populated when listing every user (team view). */
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ClientMeta {
  clientName: string | null;
  clientIconUrl: string | null;
  clientHomepageUrl: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function helpers(c: Context<AppContext>): OAuthHelpers {
  const h = c.env.OAUTH_PROVIDER;
  if (!h) throw new Error("authorization_not_configured");
  return h;
}

/** All grants for a user, following cursor pagination to the end. */
async function listAllGrants(h: OAuthHelpers, userId: string): Promise<GrantSummary[]> {
  const out: GrantSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await h.listUserGrants(userId, { limit: 1000, cursor });
    out.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return out;
}

async function clientMeta(
  h: OAuthHelpers,
  clientId: string,
  grants: GrantSummary[],
): Promise<ClientMeta> {
  let client: ClientInfo | null = null;
  try {
    client = await h.lookupClient(clientId);
  } catch (error) {
    // CIMD clients are not stored in KV — fall back to grant metadata below.
    if (!(error instanceof CimdFetchError)) throw error;
  }
  if (client) {
    return {
      clientName: client.clientName ?? null,
      clientIconUrl: client.logoUri ?? null,
      clientHomepageUrl: client.clientUri ?? null,
    };
  }
  const withName = grants.find((g) => g.metadata?.clientName);
  return {
    clientName: withName?.metadata?.clientName ?? null,
    clientIconUrl: null,
    clientHomepageUrl: null,
  };
}

/** Build one McpConnection per (userId, clientId) from that pair's grants. */
async function buildConnection(
  c: Context<AppContext>,
  h: OAuthHelpers,
  userId: string,
  clientId: string,
  grants: GrantSummary[],
  user?: McpConnection["user"],
): Promise<McpConnection> {
  const meta = await clientMeta(h, clientId, grants);

  let connectedAt = "";
  const scopes = new Set<string>();
  let lastUsedAt: string | null = null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  let active = false;
  for (const grant of grants) {
    if (grant.expiresAt === undefined || grant.expiresAt > nowSeconds) active = true;
    const createdAtIso = new Date(grant.createdAt * 1000).toISOString();
    if (!connectedAt || createdAtIso < connectedAt) connectedAt = createdAtIso;
    for (const scope of grant.scope) scopes.add(scope);
    const marker = await readMcpLastUsed(c.env.OAUTH_KV, userId, grant.id);
    if (marker && (!lastUsedAt || marker > lastUsedAt)) lastUsedAt = marker;
  }

  return {
    clientId,
    clientName: meta.clientName,
    clientIconUrl: meta.clientIconUrl,
    clientHomepageUrl: meta.clientHomepageUrl,
    scopes: [...scopes].sort(),
    connectedAt,
    lastUsedAt,
    active,
    ...(user ? { user } : {}),
  };
}

async function buildConnectionsForUser(
  c: Context<AppContext>,
  h: OAuthHelpers,
  userId: string,
  user?: McpConnection["user"],
): Promise<McpConnection[]> {
  const grants = await listAllGrants(h, userId);
  const byClient = new Map<string, GrantSummary[]>();
  for (const grant of grants) {
    const list = byClient.get(grant.clientId);
    if (list) list.push(grant);
    else byClient.set(grant.clientId, [grant]);
  }
  const connections: McpConnection[] = [];
  for (const [clientId, clientGrants] of byClient) {
    connections.push(await buildConnection(c, h, userId, clientId, clientGrants, user));
  }
  return connections.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aT = a.lastUsedAt ?? a.connectedAt;
    const bT = b.lastUsedAt ?? b.connectedAt;
    return bT.localeCompare(aT);
  });
}

async function loadUsers(db: ReturnType<typeof getDb>) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .all();
}

/**
 * Revoke every grant the user holds against a client. Returns the number of
 * grants revoked (0 = the connection does not exist).
 */
async function revokeGrantsForClient(
  c: Context<AppContext>,
  h: OAuthHelpers,
  userId: string,
  clientId: string,
): Promise<number> {
  const grants = (await listAllGrants(h, userId)).filter((g) => g.clientId === clientId);
  for (const grant of grants) {
    await h.revokeGrant(grant.id, userId);
    await deleteMcpLastUsed(c.env.OAUTH_KV, userId, grant.id);
  }
  return grants.length;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /api/mcp/me
 * Returns the caller's own MCP connections. Gated by SCOPES.MCP_VIEW (route level).
 */
export async function listMyConnections(c: Context<AppContext>) {
  const h = helpers(c);
  const user = c.get("user")!;
  const connections = await buildConnectionsForUser(c, h, user.id);
  return c.json({ success: true, data: connections, count: connections.length });
}

/**
 * GET /api/mcp/team
 * Admin-only. Returns every user's MCP connections, each decorated with
 * their user info so the UI can group by teammate.
 */
export async function listTeamConnections(c: Context<AppContext>) {
  const h = helpers(c);
  const db = getDb(c.env.DB);
  const allUsers = await loadUsers(db);
  const connections: McpConnection[] = [];
  for (const u of allUsers) {
    connections.push(...(await buildConnectionsForUser(c, h, u.id, u)));
  }
  return c.json({ success: true, data: connections, count: connections.length });
}

/**
 * DELETE /api/mcp/connections/:clientId
 * Revoke the CALLER's grants against this client (grant + all its tokens).
 */
export async function revokeMyConnection(c: Context<AppContext>) {
  const h = helpers(c);
  const user = c.get("user")!;
  const clientId = c.req.param("clientId")!;
  return revokeConnection(c, h, user.id, clientId);
}

/**
 * DELETE /api/mcp/connections/:clientId/users/:userId
 * Admin-only. Revoke ANY user's grants against this client.
 */
export async function revokeUserConnection(c: Context<AppContext>) {
  const h = helpers(c);
  const targetUserId = c.req.param("userId")!;
  const clientId = c.req.param("clientId")!;
  return revokeConnection(c, h, targetUserId, clientId, { actorRole: "admin" });
}

/**
 * DELETE /api/mcp/clients/:clientId
 * Admin-only. Deletes the registered client entirely: revokes every user's
 * grants against it first, then removes the client record itself.
 */
export async function deleteMcpClient(c: Context<AppContext>) {
  const h = helpers(c);
  const db = getDb(c.env.DB);
  const actor = c.get("user")!;
  const clientId = c.req.param("clientId")!;

  let client: ClientInfo | null = null;
  try {
    client = await h.lookupClient(clientId);
  } catch {
    // CIMD clients are not stored in KV — the delete below still applies to
    // their grants, and an unknown client id fails the same NotFound path.
    client = null;
  }

  let revokedForUsers = 0;
  const allUsers = await loadUsers(db);
  for (const u of allUsers) {
    revokedForUsers += await revokeGrantsForClient(c, h, u.id, clientId);
  }

  const existed = client !== null || revokedForUsers > 0;
  if (!existed) {
    throw new NotFoundError("MCP client", clientId);
  }

  await h.deleteClient(clientId);
  await logActivity(
    db,
    actor,
    ACTIONS.MCP_CLIENT_DELETED,
    { type: "oauthClient", id: clientId, label: client?.clientName ?? clientId },
    { revokedForUsers },
  );

  return c.json({ success: true, data: { clientId, revokedForUsers } });
}

async function revokeConnection(
  c: Context<AppContext>,
  h: OAuthHelpers,
  targetUserId: string,
  clientId: string,
  meta?: { actorRole?: "admin" },
) {
  const revoked = await revokeGrantsForClient(c, h, targetUserId, clientId);
  if (revoked === 0) {
    throw new NotFoundError("MCP connection", `${targetUserId}:${clientId}`);
  }

  const actor = c.get("user")!;
  const db = getDb(c.env.DB);
  await logActivity(
    db,
    actor,
    ACTIONS.MCP_CONNECTION_REVOKED,
    { type: "oauthClient", id: clientId, label: clientId },
    { targetUserId, byAdmin: meta?.actorRole === "admin" },
  );

  return c.json({ success: true, data: { clientId, userId: targetUserId } });
}
