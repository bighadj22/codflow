/**
 * Last-used markers for MCP grants.
 *
 * The OAuth provider stores grants/tokens in OAUTH_KV but exposes no
 * "list tokens by grant" API and no supported way to mutate grant metadata
 * at token-issuance time (the token-exchange callback cannot write metadata
 * back without racing the provider's own grant save). So last-used is
 * tracked in our own marker key, written from the token-exchange callback
 * and read by the /api/mcp management endpoints.
 */

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export type { OAuthHelpers };

export const MCP_LAST_USED_PREFIX = "mcp-last-used:";

/** Outlives the 30-day refresh-token TTL so markers die only after their grant is long gone. */
export const MCP_LAST_USED_TTL_SECONDS = 60 * 60 * 24 * 60;

export function mcpLastUsedKey(userId: string, grantId: string): string {
  return `${MCP_LAST_USED_PREFIX}${userId}:${grantId}`;
}

export async function recordMcpLastUsed(
  kv: KVNamespace,
  userId: string,
  grantId: string,
): Promise<void> {
  await kv.put(mcpLastUsedKey(userId, grantId), new Date().toISOString(), {
    expirationTtl: MCP_LAST_USED_TTL_SECONDS,
  });
}

export async function readMcpLastUsed(
  kv: KVNamespace,
  userId: string,
  grantId: string,
): Promise<string | null> {
  return kv.get(mcpLastUsedKey(userId, grantId));
}

export async function deleteMcpLastUsed(
  kv: KVNamespace,
  userId: string,
  grantId: string,
): Promise<void> {
  await kv.delete(mcpLastUsedKey(userId, grantId));
}
