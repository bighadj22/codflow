// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Proxy endpoint used by the order form to load communes client-side. ║
// ║  Keeps the API key server-side (never exposed to the browser).       ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { APIRoute } from "astro";
import { fetchCommunes } from "@/core/api/client";

export const GET: APIRoute = async ({ params }) => {
  const wilayaId = parseInt(params.wilayaId ?? "");
  if (isNaN(wilayaId) || wilayaId < 1 || wilayaId > 58) {
    return new Response(JSON.stringify({ error: "Invalid wilaya ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const communes = await fetchCommunes(wilayaId);

  return new Response(JSON.stringify({ data: communes }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
