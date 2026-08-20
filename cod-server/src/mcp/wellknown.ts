/**
 * Protected-Resource discovery endpoint — `/.well-known/oauth-protected-resource`.
 *
 * MCP clients (Claude Desktop, Claude.ai, ChatGPT, custom agents) hit this
 * URL first to learn:
 *   • which Authorization Server issues tokens for this resource
 *   • which bearer-auth mechanisms are supported
 *   • which scopes this resource recognises
 *
 * The response shape follows RFC 9728 (OAuth 2.0 Protected Resource Metadata).
 * Keep this file tiny and public — no auth, no middleware, short TTL.
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import { ALL_SCOPES } from "../../../cod-shared/rbac/scopes";

export async function protectedResourceMetadata(c: Context<AppContext>) {
  const body = {
    resource: c.env.WORKER_SELF_URL,
    authorization_servers: [c.env.BETTER_AUTH_URL],
    bearer_methods_supported: ["header"],
    // Includes standard OIDC scopes so MCP clients know to request them too.
    scopes_supported: [
      "openid", "profile", "email", "offline_access",
      ...ALL_SCOPES,
    ],
  };

  return c.json(body, 200, {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
  });
}
