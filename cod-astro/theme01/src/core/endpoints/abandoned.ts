// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Same-origin proxy for abandoned-checkout tracking (browser → this   ║
// ║  endpoint → cod-server POST /store/abandoned). Keeps the store API   ║
// ║  key server-side; the browser script needs no credentials at all.    ║
// ║  Accepts both fetch and navigator.sendBeacon payloads.               ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { upsertAbandonedOrder } from "@/core/api/client";

// Mirrors the cod-server /store/abandoned upsert contract
// (see cod-server/src/endpoints/abandoned-orders/store-routes.ts).
const upsertSchema = z.object({
  sessionId: z.string().uuid(),
  customerName: z.string().min(2).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^[0-9+\s-]+$/),
  wilayaId: z.number().int().min(1).max(58).optional(),
  communeId: z.string().max(200).optional(),
  wilayaName: z.string().max(100).optional(),
  communeName: z.string().max(100).optional(),
  productId: z.string().max(200).optional(),
  productName: z.string().max(200).optional(),
  variantId: z.string().max(200).optional(),
  variantLabel: z.string().max(200).optional(),
  price: z.number().positive().optional(),
  deliveryType: z.enum(["home", "stop_desk"]).optional(),
  fbc: z.string().max(500).optional(),
  fbp: z.string().max(500).optional(),
});

function noContent() {
  return new Response(null, { status: 204 });
}

function badRequest(error: string) {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Reject cross-site submissions: only same-origin pages may track.
 * Mirrors Astro Actions' built-in CSRF check — requests without an Origin
 * header (older browsers, curl, server-to-server) are allowed through.
 */
function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (isCrossOrigin(request)) {
    return new Response(JSON.stringify({ error: "Cross-origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Invalid tracking payload");
  }

  // Forward the shopper's attribution headers so cod-server records the
  // visitor, not this worker. Cloudflare provides CF-Connecting-IP on the
  // incoming request; the User-Agent passes through verbatim.
  const forwardedHeaders: Record<string, string> = {};
  const userAgent = request.headers.get("User-Agent");
  if (userAgent) forwardedHeaders["User-Agent"] = userAgent;
  const clientIp =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (clientIp) forwardedHeaders["X-Forwarded-For"] = clientIp;

  // Fire-and-forget by contract: tracking must never break the storefront.
  // Upstream failures return 502 for debuggability; the browser script
  // ignores response status either way.
  const result = await upsertAbandonedOrder(parsed.data, forwardedHeaders);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return noContent();
};
