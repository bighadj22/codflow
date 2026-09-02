// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Proxy endpoint for the checkout OTP step: sends a WhatsApp code.    ║
// ║  Keeps the store API key server-side (never exposed to the browser). ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { sendOtp } from "@/core/api/client";

export const POST: APIRoute = async ({ request }) => {
  let phone = "";
  try {
    const body = (await request.json()) as { phone?: string };
    phone = String(body.phone ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!phone) {
    return new Response(JSON.stringify({ error: "Phone is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await sendOtp(phone);

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error, code: result.code, windowSeconds: result.windowSeconds }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // "unavailable" (bypass) is a 200 — the storefront decides to proceed.
  return new Response(JSON.stringify({ data: result.data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
