import { initAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

// The dashboard layout redirects to GET /sign-out.
// We forward it as a POST to better-auth's sign-out endpoint, carry the
// Set-Cookie (session deletion) header back, then redirect home.
export async function GET(request: NextRequest) {
  const auth = await initAuth();

  const signOutReq = new Request(
    new URL("/api/auth/sign-out", request.url).toString(),
    { method: "POST", headers: request.headers }
  );
  const signOutRes = await auth.handler(signOutReq);

  const responseHeaders = new Headers(signOutRes.headers);
  responseHeaders.set("Location", "/");
  return new Response(null, { status: 302, headers: responseHeaders });
}
