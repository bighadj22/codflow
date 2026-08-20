import { getUserApiKey, getUser } from "@/lib/auth";
import { getWorkerApiUrl } from "@/lib/api-config";

/**
 * GET /api/orders/[id]/label
 *
 * Proxies the shipment label PDF from the worker (which in turn fetches it
 * from the carrier API using the stored Bearer token).
 *
 * The carrier label URL requires a Bearer API token that must never be exposed
 * to the browser. This route keeps the token server-side:
 *   Browser → Next.js route (session auth) → cod-worker → Packers/carrier → PDF
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = await getUserApiKey();
  if (!apiKey) {
    return new Response("No API key configured for this account", { status: 403 });
  }

  const baseUrl = await getWorkerApiUrl();
  const workerUrl = `${baseUrl}/api/orders/${encodeURIComponent(id)}/label`;

  let workerRes: Response;
  try {
    workerRes = await fetch(workerUrl, {
      headers: { "X-API-Key": apiKey },
    });
  } catch {
    return new Response("Failed to reach API server", { status: 502 });
  }

  if (!workerRes.ok) {
    const text = await workerRes.text().catch(() => "");
    return new Response(text || `Carrier returned ${workerRes.status}`, {
      status: workerRes.status,
    });
  }

  const contentType = workerRes.headers.get("Content-Type") ?? "application/pdf";
  const disposition = workerRes.headers.get("Content-Disposition") ?? `inline; filename="label-${id}.pdf"`;

  return new Response(workerRes.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
