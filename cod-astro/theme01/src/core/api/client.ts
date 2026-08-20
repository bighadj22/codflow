// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  All HTTP calls to cod-server live here. Add no fetch logic outside  ║
// ║  this file — pages and components must import from @/lib/api.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { STORE_API_KEY, COD_SERVER_URL as _COD_SERVER_URL } from "astro:env/server";
const COD_SERVER_URL = _COD_SERVER_URL ?? "http://localhost:8787";
import type { StoreConfig, Commune, Review } from "./types";

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
  body: Record<string, unknown>
): Promise<{ success: true; data: { orderNumber: string; orderId: string; total: number } } | { success: false; error: string }> {
  try {
    const res = await fetch(`${COD_SERVER_URL}/store/orders`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json.error ?? "Order failed" };
    return { success: true, data: json.data };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Network error" };
  }
}
