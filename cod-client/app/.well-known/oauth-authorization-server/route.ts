/**
 * OAuth 2.0 Authorization Server Metadata endpoint
 * — `/.well-known/oauth-authorization-server` (RFC 8414).
 *
 * MCP clients first probe `oauth-protected-resource` on the resource
 * server (cod-server) to discover this Authorization Server, then hit this
 * endpoint to get the actual OAuth endpoints (authorize, token, jwks).
 *
 * Must be public (no middleware, no auth). Payload is derived from
 * `lib/auth.ts` → `oauthProvider({...})`.
 */

import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { initAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await initAuth();
  return oauthProviderAuthServerMetadata(auth)(request);
}
