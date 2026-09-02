import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createAuth, type AuthEnv } from "@/lib/auth/server";
import {
  mintLoginTicket,
  LOGIN_TICKET_MIN_KEY_BYTES,
} from "../../../../../cod-shared/lib/login-ticket";

export const prerender = false;

/**
 * MCP OAuth login relay.
 *
 * cod-server redirects an unauthenticated `/authorize` here after the user
 * signs in on this dashboard. This endpoint confirms the Better Auth session,
 * mints a short-lived HMAC login ticket for the signed-in user, and redirects
 * back to the MCP authorize URL with the ticket appended. cod-server verifies
 * the ticket before rendering consent.
 */
const ALL: APIRoute = async (ctx) => {
  const req = ctx.request as Request & { cf?: unknown };
  const authEnv = env as unknown as AuthEnv;
  const secret = authEnv.MCP_LOGIN_TICKET_SECRET;

  if (!secret || secret.length < LOGIN_TICKET_MIN_KEY_BYTES) {
    return new Response("MCP OAuth relay not configured", { status: 503 });
  }

  const next = ctx.url.searchParams.get("next");
  if (!next || !isAuthorizeUrl(next, authEnv.PUBLIC_API_URL)) {
    return new Response("Invalid next URL", { status: 400 });
  }

  const auth = createAuth(authEnv, { cf: req.cf });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    const back = `${ctx.url.pathname}?next=${encodeURIComponent(next)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: `/sign-in?next=${encodeURIComponent(back)}` },
    });
  }

  const ticket = await mintLoginTicket(secret, session.user.id);
  const target = new URL(next);
  target.searchParams.set("ticket", ticket);
  return new Response(null, { status: 302, headers: { Location: target.toString() } });
};

function isAuthorizeUrl(value: string, apiBase: string): boolean {
  try {
    const url = new URL(value);
    const base = new URL("/", apiBase);
    return (
      url.protocol === base.protocol &&
      url.hostname === base.hostname &&
      url.pathname === "/authorize"
    );
  } catch {
    return false;
  }
}

export const GET = ALL;
