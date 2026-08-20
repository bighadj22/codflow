/**
 * Aggregate query for the /mcp page.
 *
 * Called from both cod-server (`/api/mcp/me`, `/api/mcp/team`) and cod-client's
 * server component — keeping it here lets the page render directly from D1
 * without a cod-server round-trip. Revocation still lives on cod-server so
 * the audit log stays centralised.
 *
 * "Connection" is a synthetic aggregate per (userId, clientId):
 *   • scopes     — union of scopes from all consent rows
 *   • connectedAt — earliest consent.createdAt for that pair
 *   • lastUsedAt — max(accessToken.createdAt) for that pair (a proxy,
 *                  since access tokens are short-lived and re-minted)
 *   • active     — at least one non-expired access or refresh token
 *   • clientName / clientIconUrl / clientHomepageUrl — from oauthClients
 *   • user       — only populated when filter.userId is absent (team view)
 *
 * Sort order: active connections first, then by lastUsedAt desc, then
 * connectedAt desc. Deterministic so the UI can snapshot-test against it.
 */

import { eq, max, sql } from "drizzle-orm";
import {
  oauthClients,
  oauthConsents,
  oauthAccessTokens,
  oauthRefreshTokens,
  users,
} from "../db/schema";
import type { AppDb } from "../db/client";

export interface McpConnection {
  clientId:          string;
  clientName:        string | null;
  clientIconUrl:     string | null;
  clientHomepageUrl: string | null;
  scopes:            string[];
  connectedAt:       string;
  lastUsedAt:        string | null;
  active:            boolean;
  /** Only populated when listing every user (team view). */
  user?: {
    id:    string;
    name:  string;
    email: string;
  };
}

export interface ListMcpConnectionsFilter {
  /**
   * If set, restrict to this user's connections (my-view).
   * If absent, every user's connections are returned with `user` populated
   * (team/admin view).
   */
  userId?: string;
}

export async function listMcpConnections(
  db: AppDb,
  filter: ListMcpConnectionsFilter = {},
): Promise<McpConnection[]> {
  // D1's bind layer rejects Date — pass milliseconds (integer) so the
  // comparison stays int-vs-int and matches the timestamp_ms column type.
  const nowMs = Date.now();

  const consentWhere = filter.userId
    ? eq(oauthConsents.userId, filter.userId)
    : undefined;

  const consents = await db
    .select({
      userId:      oauthConsents.userId,
      clientId:    oauthConsents.clientId,
      scopes:      oauthConsents.scopes,
      connectedAt: oauthConsents.createdAt,
      clientName:  oauthClients.name,
      clientIcon:  oauthClients.icon,
      clientUri:   oauthClients.uri,
    })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthConsents.clientId, oauthClients.clientId))
    .where(consentWhere)
    .all();

  if (consents.length === 0) return [];

  const lastAccess = await db
    .select({
      userId:    oauthAccessTokens.userId,
      clientId:  oauthAccessTokens.clientId,
      latest:    max(oauthAccessTokens.createdAt),
      liveCount: sql<number>`SUM(CASE WHEN ${oauthAccessTokens.expiresAt} > ${nowMs} THEN 1 ELSE 0 END)`,
    })
    .from(oauthAccessTokens)
    .where(filter.userId ? eq(oauthAccessTokens.userId, filter.userId) : undefined)
    .groupBy(oauthAccessTokens.userId, oauthAccessTokens.clientId)
    .all();

  const liveRefresh = await db
    .select({
      userId:    oauthRefreshTokens.userId,
      clientId:  oauthRefreshTokens.clientId,
      liveCount: sql<number>`SUM(CASE WHEN ${oauthRefreshTokens.expiresAt} > ${nowMs} AND ${oauthRefreshTokens.revoked} IS NULL THEN 1 ELSE 0 END)`,
    })
    .from(oauthRefreshTokens)
    .where(filter.userId ? eq(oauthRefreshTokens.userId, filter.userId) : undefined)
    .groupBy(oauthRefreshTokens.userId, oauthRefreshTokens.clientId)
    .all();

  const userRows = !filter.userId
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .all()
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const accessIdx = new Map<string, (typeof lastAccess)[number]>();
  for (const row of lastAccess) accessIdx.set(`${row.userId ?? ""}::${row.clientId}`, row);
  const refreshIdx = new Map<string, (typeof liveRefresh)[number]>();
  for (const row of liveRefresh) refreshIdx.set(`${row.userId}::${row.clientId}`, row);

  // Multiple consent rows for the same (user, client) happen when scopes were
  // incrementally granted. Collapse by union-of-scopes + oldest createdAt.
  const merged = new Map<string, McpConnection>();
  for (const c of consents) {
    if (!c.userId) continue;
    const key = `${c.userId}::${c.clientId}`;
    const parsedScopes = parseScopeArray(c.scopes);
    const existing = merged.get(key);
    const access = accessIdx.get(key);
    const refresh = refreshIdx.get(key);
    const active = (access?.liveCount ?? 0) > 0 || (refresh?.liveCount ?? 0) > 0;

    const entry: McpConnection = existing ?? {
      clientId:          c.clientId,
      clientName:        c.clientName,
      clientIconUrl:     c.clientIcon,
      clientHomepageUrl: c.clientUri,
      scopes:            [],
      connectedAt:       toIso(c.connectedAt),
      lastUsedAt:        access?.latest ? toIso(access.latest) : null,
      active,
      ...(filter.userId
        ? {}
        : { user: userMap.get(c.userId) ?? { id: c.userId, name: "?", email: "" } }),
    };

    entry.scopes = [...new Set([...entry.scopes, ...parsedScopes])];
    const candidateConnectedAt = toIso(c.connectedAt);
    if (candidateConnectedAt < entry.connectedAt) entry.connectedAt = candidateConnectedAt;
    merged.set(key, entry);
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aT = a.lastUsedAt ?? a.connectedAt;
    const bT = b.lastUsedAt ?? b.connectedAt;
    return bT.localeCompare(aT);
  });
}

function parseScopeArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : raw.split(/\s+/).filter(Boolean);
    } catch {
      return raw.split(/\s+/).filter(Boolean);
    }
  }
  return [];
}

function toIso(v: Date | string | number | null | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
