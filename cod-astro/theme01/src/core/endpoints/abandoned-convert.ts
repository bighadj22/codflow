// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Same-origin proxy marking an abandoned session as converted after   ║
// ║  a successful order (browser → this endpoint → cod-server PATCH      ║
// ║  /store/abandoned/{sessionId}/convert). Keeps the store API key      ║
// ║  server-side.                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { markAbandonedConverted } from "@/core/api/client";

const convertSchema = z.object({
  sessionId: z.string().uuid(),
  orderId: z.string().min(1).max(200),
  orderNumber: z.string().min(1).max(100),
});

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
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = convertSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid conversion payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // cod-server treats conversion as fire-and-forget (always 200, unknown
  // sessions succeed silently), so a 204 here means "received".
  const result = await markAbandonedConverted(
    parsed.data.sessionId,
    parsed.data.orderId,
    parsed.data.orderNumber
  );
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
