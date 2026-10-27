/**
 * Meta Conversions API (CAPI) client.
 *
 * Shared by:
 *  - endpoints/store/handlers.ts — inline Lead mirror at order placement
 *  - workflows/capi.ts           — durable Purchase event at delivery
 *
 * All PII is SHA-256 hashed before sending (Meta requirement).
 * Phones are normalised to the Algerian country code 213.
 * Throws on network errors and Meta 5xx (retryable by the Workflow);
 * returns { success: false } on 4xx (Meta rejects the whole batch).
 */

import { sanitizeErrorForLog } from "./redact";

const META_API_VERSION = "v26.0";
const META_API_BASE = "https://graph.facebook.com";
const DZ_COUNTRY_CODE = "213";

async function sha256hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().replace(/\s+/g, ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalisePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  p = p.replace(/^0+/, "");
  if (!p.startsWith(DZ_COUNTRY_CODE)) p = DZ_COUNTRY_CODE + p;
  return p;
}

/** a-z only, diacritics folded — for ct/zp-style values per Meta docs. */
function normaliseAsciiText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Unicode letters only, diacritics folded, lowercased — for fn/ln. */
function normaliseName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "");
}

export interface CapiUserData {
  phone: string;
  /**
   * Captured at checkout when the merchant enables the email field. Optional
   * for the same reason the field is: most stores never ask for one, and an
   * event without it is exactly as valid as it was before.
   */
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  externalId?: string | null;
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
  /** Verified-domain page URL — required by Meta for website events. */
  eventSourceUrl?: string | null;
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
  /** Meta's HTTP status — absent when the request never reached Meta. */
  httpStatus?: number;
}

/**
 * A response Meta answered with 5xx (retryable). Carries the status so the
 * durable workflow can record it without re-parsing the message.
 */
export class CapiHttpError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "CapiHttpError";
  }
}

export async function sendCapiEvent(
  pixelId: string,
  accessToken: string,
  payload: CapiEventPayload,
): Promise<CapiResult> {
  const ud = payload.userData;

  const userData: Record<string, string> = {
    ph: await sha256hex(normalisePhone(ud.phone)),
    country: await sha256hex("dz"),
  };
  // Email is the strongest identifier Meta matches on after the phone, so it is
  // sent whenever the shopper gave one — the whole reason orders.customer_email
  // is worth storing beyond the receipt.
  //
  // Hashed raw, with no helper in front of it: sha256hex already lowercases and
  // strips whitespace, which IS Meta's rule for `em`. The fn/ln normaliser below
  // must not be used here — it strips punctuation, and an address is an
  // identifier rather than a name, so "o'brien@x.com" would be hashed as a
  // mailbox nobody owns and quietly cost the match it was meant to make.
  if (ud.email) userData.em = await sha256hex(ud.email);
  if (ud.firstName) userData.fn = await sha256hex(normaliseName(ud.firstName));
  if (ud.lastName) userData.ln = await sha256hex(normaliseName(ud.lastName));
  if (ud.externalId) userData.external_id = await sha256hex(ud.externalId);
  if (ud.city) userData.ct = await sha256hex(normaliseAsciiText(ud.city));
  if (ud.postalCode) userData.zp = await sha256hex(ud.postalCode);
  if (ud.fbc) userData.fbc = ud.fbc;
  if (ud.fbp) userData.fbp = ud.fbp;
  if (ud.clientIpAddress) userData.client_ip_address = ud.clientIpAddress;
  if (ud.clientUserAgent) userData.client_user_agent = ud.clientUserAgent;

  const eventData: Record<string, unknown> = {
    event_name: payload.eventName,
    event_time: payload.eventTime,
    event_id: payload.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (payload.eventSourceUrl) eventData.event_source_url = payload.eventSourceUrl;

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

  const url = new URL(
    `${META_API_BASE}/${META_API_VERSION}/${encodeURIComponent(pixelId)}/events`
  );
  url.searchParams.set("access_token", accessToken);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Meta CAPI network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const json = (await res.json().catch(() => null)) as any;
  if (res.status >= 500) {
    const detail =
      sanitizeErrorForLog(json?.error?.message, accessToken) ?? "no message";
    throw new CapiHttpError(`Meta CAPI server error ${res.status}: ${detail}`, res.status);
  }
  if (!res.ok) {
    return {
      success: false,
      error: sanitizeErrorForLog(json?.error?.message, accessToken) ?? `HTTP ${res.status}`,
      httpStatus: res.status,
    };
  }

  return {
    success: true,
    fbtrace_id: json?.events_received === 1 ? json?.fbtrace_id : undefined,
    httpStatus: res.status,
  };
}
