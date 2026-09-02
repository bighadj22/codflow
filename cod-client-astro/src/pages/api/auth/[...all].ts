import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createAuth, type AuthEnv } from "@/lib/auth/server";

export const prerender = false;

const ALL: APIRoute = async (ctx) => {
  // Request.cf carries IP/geo metadata only on the Workers runtime.
  const req = ctx.request as Request & { cf?: unknown };
  const auth = createAuth(env as unknown as AuthEnv, { cf: req.cf });
  return auth.handler(ctx.request);
};

export const GET = ALL;
export const POST = ALL;
