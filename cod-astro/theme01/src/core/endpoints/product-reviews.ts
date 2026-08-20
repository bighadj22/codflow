import type { APIRoute } from "astro";
import { fetchProductReviews } from "@/core/api/client";

export const GET: APIRoute = async ({ params, request }) => {
  const { productId } = params;
  if (!productId) {
    return new Response(JSON.stringify({ error: "productId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);

  const { rows, total } = await fetchProductReviews(productId, limit, offset);

  return new Response(JSON.stringify({ data: rows, total }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
