// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Proxy endpoint for the checkout OTP step: verifies the typed code.  ║
// ║  Keeps the store API key server-side (never exposed to the browser). ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { verifyOtp } from "@/core/api/client";

export const POST: APIRoute = async ({ request }) => {
  let body: { phone?: string; requestId?: string; code?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = String(body.phone ?? "");
  const requestId = String(body.requestId ?? "");
  const code = String(body.code ?? "");
  if (!phone || !requestId || !code) {
    return new Response(JSON.stringify({ error: "phone, requestId and code are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await verifyOtp(phone, requestId, code);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: result.error,
        code: result.code,
        attemptsRemaining: result.attemptsRemaining,
        terminal: result.terminal,
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ data: result.data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
