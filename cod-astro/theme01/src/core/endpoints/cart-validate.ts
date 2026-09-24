// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Same-origin proxy for cart validation (browser → this endpoint →    ║
// ║  cod-server POST /store/cart/validate). Keeps the store API key      ║
// ║  server-side; the browser script needs no credentials at all.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { validateCart } from "@/core/api/client";

/**
 * Mirrors the cod-server contract (cod-server/src/endpoints/store/validation.ts).
 * Bounds are enforced here too so a malformed basket is rejected at the edge
 * rather than spending a round trip to be rejected upstream.
 */
const itemSchema = z.object({
  productId: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  variantId: z.string().min(1).max(200).optional(),
  variantLabel: z.string().max(100).optional(),
  quantity: z.number().int().min(1).max(100),
  pricePerUnit: z.number().nonnegative().optional(),
});

const requestSchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Reject cross-site submissions: only same-origin pages may validate a cart.
 * Mirrors Astro Actions' built-in CSRF check and the abandoned-order proxy —
 * requests without an Origin header (older browsers, curl, server-to-server)
 * are allowed through.
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
    return json({ error: "Cross-origin not allowed" }, 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Invalid cart payload" }, 400);
  }

  const result = await validateCart(parsed.data);
  if (!result.success) {
    // The cart drawer treats any failure as "keep showing what we have", so a
    // 502 here degrades to the optimistic view rather than an empty basket.
    return json({ error: result.error }, 502);
  }

  return json({ success: true, data: result.data }, 200);
};
