/**
 * Nested discovery endpoint — `/.well-known/oauth-authorization-server/api/auth`.
 *
 * Better Auth mounts its handler at `/api/auth`, so the OAuth issuer URL is
 * `${baseURL}/api/auth`. Per RFC 8414 the discovery metadata belongs at
 * `${baseURL}/.well-known/oauth-authorization-server${issuer-path}` — this
 * file serves that exact location so Better Auth's own client registration
 * + consent flows resolve the issuer cleanly. The root-level route at
 * `/.well-known/oauth-authorization-server` exists separately for MCP
 * clients that use the spec's recommended top-level discovery path.
 */

import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { initAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await initAuth();
  return oauthProviderAuthServerMetadata(auth)(request);
}
