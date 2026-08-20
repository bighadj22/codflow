/**
 * Meta Conversions API (CAPI) helper.
 *
 * Shared by:
 *  - store/handlers.ts  — inline Lead mirror at order placement
 *  - workflows/capi.ts  — durable Purchase event at delivery
 *
 * All PII is SHA-256 hashed before sending (Meta requirement).
 * Phone is normalised: strip leading 0, prefix country code 213 (Algeria).
 */

const META_API_VERSION = "v18.0";
const META_API_BASE = "https://graph.facebook.com";

async function sha256hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().replace(/\s+/g, ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalisePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("213")) p = "213" + p;
  return p;
}

export interface CapiUserData {
  phone: string;
  city?: string | null;
  postalCode?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface CapiEventPayload {
  eventName: "Lead" | "Purchase";
  eventId: string;
  eventTime: number;
  userData: CapiUserData;
  /** DZD value — required for Purchase */
  value?: number;
  currency?: string;
  contentIds?: string[];
  testEventCode?: string | null;
}

export interface CapiResult {
  success: boolean;
  fbtrace_id?: string;
  error?: string;
}

export async function sendCapiEvent(
  pixelId: string,
  accessToken: string,
  payload: CapiEventPayload,
): Promise<CapiResult> {
  const ph = await sha256hex(normalisePhone(payload.userData.phone));

  const userData: Record<string, string> = { ph };
  if (payload.userData.city) userData.ct = await sha256hex(payload.userData.city);
  if (payload.userData.postalCode) userData.zp = await sha256hex(payload.userData.postalCode);
  if (payload.userData.fbc) userData.fbc = payload.userData.fbc;
  if (payload.userData.fbp) userData.fbp = payload.userData.fbp;
  if (payload.userData.clientIpAddress) userData.client_ip_address = payload.userData.clientIpAddress;
  if (payload.userData.clientUserAgent) userData.client_user_agent = payload.userData.clientUserAgent;
  userData.country = await sha256hex("dz");

  const eventData: Record<string, unknown> = {
    event_name: payload.eventName,
    event_time: payload.eventTime,
    event_id: payload.eventId,
    action_source: "website",
    user_data: userData,
  };

  if (payload.value !== undefined) {
    eventData.custom_data = {
      value: payload.value,
      currency: payload.currency ?? "DZD",
      ...(payload.contentIds?.length ? { content_ids: payload.contentIds, content_type: "product" } : {}),
    };
  }

  const body: Record<string, unknown> = {
    data: [eventData],
  };
  if (payload.testEventCode) body.test_event_code = payload.testEventCode;

  const url = `${META_API_BASE}/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  if (!res.ok) {
    return { success: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  }

  return { success: true, fbtrace_id: json?.events_received === 1 ? json?.fbtrace_id : undefined };
}
