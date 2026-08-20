/**
 * OIDC Discovery endpoint — `/.well-known/openid-configuration`.
 *
 * Returns the OpenID Connect discovery metadata for this Authorization
 * Server. MCP clients (Claude Desktop, Claude.ai, ChatGPT, etc.) hit this
 * URL during their OAuth handshake to learn our `authorization_endpoint`,
 * `token_endpoint`, `jwks_uri`, supported scopes, etc.
 *
 * Must be public (no middleware, no auth). The `@better-auth/oauth-provider`
 * plugin derives the JSON payload from the `oauthProvider(...)` config in
 * `lib/auth.ts` — we just expose its handler.
 */

import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { initAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await initAuth();
  return oauthProviderOpenIdConfigMetadata(auth)(request);
}
