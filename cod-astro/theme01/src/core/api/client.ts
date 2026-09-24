// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  All HTTP calls to cod-server live here. Add no fetch logic outside  ║
// ║  this file — pages and components must import from @/lib/api.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { STORE_API_KEY, COD_SERVER_URL as _COD_SERVER_URL } from "astro:env/server";
const COD_SERVER_URL = _COD_SERVER_URL ?? "http://localhost:8787";
import type { StoreConfig, Commune, Review, StorePagePublic } from "./types";

function storeHeaders() {
  return {
    "X-Store-API-Key": STORE_API_KEY!,
    "Content-Type": "application/json",
  };
}

export async function fetchStoreConfig(): Promise<StoreConfig | null> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/config`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: StoreConfig };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Raw fetching functions for Content Loaders
 * These bypass some high-level logic to return the raw data array.
 */
export async function fetchProductsRaw(params?: {
  categoryId?: string;
  featured?: boolean;
  limit?: number;
}): Promise<any[]> {
  try {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set("categoryId", params.categoryId);
    if (params?.featured)   qs.set("featured", "true");
    if (params?.limit)      qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs}` : "";
    const res = await fetch(`${COD_SERVER_URL}/store/products${query}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json as any).data ?? [];
  } catch {
    return [];
  }
}

export async function fetchCategoriesRaw(): Promise<any[]> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/categories`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json as any).data ?? [];
  } catch {
    return [];
  }
}

export async function fetchProductByHandle(handle: string): Promise<any | null> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/products/${encodeURIComponent(handle)}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: any };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a published landing page by its public slug: the ordered image stack,
 * spacing settings, and the linked product in full store-product shape.
 * Draft/archived/unknown slugs resolve to null.
 */
export async function fetchLandingPageBySlug(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/landing-pages/${encodeURIComponent(slug)}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: any };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * A published store page (Terms/Privacy/Refund/Shipping/custom), resolved to
 * the store's own language server-side. Draft/archived/unknown slugs resolve
 * to null — the page (`src/pages/pages/[slug].astro`) 404s on null, never a
 * soft 200 with empty content.
 */
export async function fetchStorePage(slug: string): Promise<StorePagePublic | null> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/pages/${encodeURIComponent(slug)}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: StorePagePublic };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Which Meta pixel an order belongs to, and which browser event to fire.
 *
 * The thank-you page knows the order id and nothing about which landing page
 * the shopper came from. It must not guess: landing-page attribution is
 * best-effort server-side, so a slug read from the URL can name a pixel the
 * server never recorded against this order — and Meta deduplicates per pixel,
 * so a browser and a server that disagree produce two conversions in two ad
 * accounts rather than one.
 *
 * Returns null on any failure, which fires no conversion event at all. Losing
 * one browser event is recoverable; reporting it to the wrong ad account is
 * not — the server mirror still arrives either way.
 */
export async function fetchOrderTracking(
  orderId: string,
): Promise<{ pixelId: string | null; event: "Purchase" | "Lead" | null } | null> {
  if (!orderId) return null;
  try {
    const res = await fetch(
      `${COD_SERVER_URL}/store/orders/${encodeURIComponent(orderId)}/tracking`,
      { headers: storeHeaders() },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: { pixelId: string | null; event: "Purchase" | "Lead" | null };
    };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchShippingRates(): Promise<Record<string, { home: number; stopDesk: number }>> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/shipping-rates`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { data: Record<string, { home: number; stopDesk: number }> };
    return json.data ?? {};
  } catch {
    return {};
  }
}

export async function fetchCommunes(wilayaId: number): Promise<Commune[]> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/communes/${wilayaId}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: Commune[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchProductReviews(
  productId: string,
  limit = 20,
  offset = 0
): Promise<{ rows: Review[]; total: number }> {
  try {
    const qs = new URLSearchParams({ productId, limit: String(limit), offset: String(offset) });
    const res = await fetch(`${COD_SERVER_URL}/store/reviews?${qs}`, {
      headers: storeHeaders(),
    });
    if (!res.ok) return { rows: [], total: 0 };
    const json = (await res.json()) as { data: Review[]; total: number };
    return { rows: json.data ?? [], total: json.total ?? 0 };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function submitReview(
  body: { orderNumber: string; productId: string; rating: number; title?: string; body: string }
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/reviews`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json.error ?? "Submission failed" };
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

export async function placeOrder(
  body: Record<string, unknown>,
  forwardedHeaders?: Record<string, string>
): Promise<{ success: true; data: { orderNumber: string; orderId: string; total: number } } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/orders`, {
      method: "POST",
      headers: { ...storeHeaders(), ...forwardedHeaders },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json.error ?? "Order failed" };
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

/**
 * Send a WhatsApp OTP for the storefront checkout verification step.
 * Mirrors POST /store/otp/send on cod-server. On "unavailable" the server
 * returns a signed bypassToken — checkout proceeds unverified (fail-open).
 */
export async function sendOtp(
  phone: string
): Promise<
  | { success: true; data: { status: "sent"; requestId: string; expiresAt: number; maxAttempts: number } }
  | { success: true; data: { status: "unavailable"; reason: string; bypassToken: string } }
  | { success: false; error: string; code?: string; windowSeconds?: number }
> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/otp/send`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ phone }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) {
      return {
        success: false,
        error: json.error ?? json.message ?? "Could not send the code",
        code: json.code,
        windowSeconds: json.context?.windowSeconds,
      };
    }
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

/**
 * Verify the WhatsApp OTP code the customer typed.
 * Mirrors POST /store/otp/verify on cod-server. On success returns the
 * signed otpToken that travels with the order submission.
 */
export async function verifyOtp(
  phone: string,
  requestId: string,
  code: string
): Promise<
  | { success: true; data: { status: "verified"; otpToken: string } }
  | { success: false; error: string; code?: string; attemptsRemaining?: number; terminal?: boolean }
> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/otp/verify`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ phone, requestId, code }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) {
      return {
        success: false,
        error: json.error ?? json.message ?? "Could not verify the code",
        code: json.code,
        attemptsRemaining: json.context?.attemptsRemaining,
        terminal: json.context?.terminal,
      };
    }
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

/**
 * Upsert an abandoned-checkout record (storefront abandonment tracking).
 * Mirrors POST /store/abandoned on cod-server — fire-and-forget semantics.
 * `forwardedHeaders` carries the shopper's User-Agent / forwarding headers so
 * attribution captured by cod-server reflects the visitor, not this worker.
 */
/**
 * Re-price and re-check a basket against the live catalog.
 *
 * Read-only upstream: nothing is written and no stock is reserved, so a
 * failure here is safe to swallow. The cart drawer keeps showing its
 * optimistic view and checkout re-validates everything regardless.
 */
export async function validateCart(
  body: { items: Array<Record<string, unknown>> }
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/cart/validate`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json.error ?? "Cart validation failed" };
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

export async function upsertAbandonedOrder(
  body: Record<string, unknown>,
  forwardedHeaders?: Record<string, string>
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/abandoned`, {
      method: "POST",
      headers: { ...storeHeaders(), ...forwardedHeaders },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json.error ?? "Tracking failed" };
    return { success: true, data: { id: json.id } };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}

/**
 * Mark an abandoned-checkout session as converted after a successful order.
 * Mirrors PATCH /store/abandoned/{sessionId}/convert — the server treats this
 * as fire-and-forget (always 200, errors swallowed server-side).
 */
export async function markAbandonedConverted(
  sessionId: string,
  orderId: string,
  orderNumber: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/abandoned/${encodeURIComponent(sessionId)}/convert`, {
      method: "PATCH",
      headers: storeHeaders(),
      body: JSON.stringify({ orderId, orderNumber }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as any;
      return { success: false, error: json.error ?? "Conversion failed" };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}
