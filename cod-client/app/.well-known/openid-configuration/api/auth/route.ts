/**
 * Nested OIDC discovery endpoint — `/.well-known/openid-configuration/api/auth`.
 *
 * Paired with the nested oauth-authorization-server route. Keeps OIDC and
 * OAuth 2.0 discovery addressable at both the root path (MCP spec) and the
 * issuer-relative path (Better Auth / RFC 8414 strict reading).
 */

import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { initAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await initAuth();
  return oauthProviderOpenIdConfigMetadata(auth)(request);
}
