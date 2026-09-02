/**
 * EcoTrack Mock Server — In-Test HTTP Double
 *
 * Satisfies the same HTTP surface as a real *.ecotrack.dz tenant, using the
 * documented responses from the Postman collection (fixtures.ts). This is the
 * testing strategy until real tenant credentials exist: the adapter is driven
 * end-to-end through fetch against faithful route handlers, including the
 * auth quirks (Bearer everywhere EXCEPT get/orders/status + validate/token,
 * which authenticate via the api_token QUERY param).
 *
 * Interface (small by design):
 *   server.fetch        — assign to global.fetch; routes to handlers
 *   server.requests     — every recorded request the adapter made
 *   server.callsFor(p)  — recorded requests for one endpoint path
 *   server.parcel(t)    — internal parcel state (for stateful assertions)
 *   server.override(p)  — replace one route's response (error simulation)
 *   server.reset()      — clear requests, overrides, and parcels
 *
 * Behavior notes:
 *   - Parcels are stateful: create → prete_a_expedier; valid/order →
 *     en_livraison (+ picked activity); ask-return → return flow. update /
 *     delete after validation answer error 10001, exactly like the platform.
 *   - add/maj appends a remark AND a notification_on_order activity event
 *     (observed real behavior, not in official docs).
 *   - wilaya 12 (Tbessa) is not in the active set — create with code_wilaya=12
 *     answers error 10002 (mirrors the collection's wilaya list example).
 */

import type { EcotrackMajEntry, EcotrackTrackingActivity } from "../types";
import {
  ACTIVE_WILAYA_IDS,
  ADD_MAJ_SUCCESS_RESPONSE,
  ASK_RETURN_REFUSED_RESPONSE,
  ASK_RETURN_SUCCESS_RESPONSE,
  COMMUNES_FIXTURE,
  CREATE_REQUIRED_FIELDS,
  CREATE_WILAYA_REFUSED_RESPONSE,
  DELETE_SUCCESS_RESPONSE,
  DESKS_FIXTURE,
  FEES_FIXTURE,
  LABEL_PDF_BYTES,
  MAJ_LIST_FIXTURE,
  NOT_MODIFIABLE_RESPONSE,
  ORDERS_PAGE_FIXTURE,
  ORDERS_STATUS_FIXTURE,
  PRODUCTS_LIST_FIXTURE,
  RETURNS_NOT_ELIGIBLE_RESPONSE,
  RETURNS_VALIDATED_RESPONSE,
  TOKEN_INVALID_RESPONSE,
  TOKEN_VALID_RESPONSE,
  TRACKING_INFO_FIXTURE,
  TRACKING_INVALID_422,
  UNAUTHENTICATED_RESPONSE,
  UPDATE_SUCCESS_RESPONSE,
  VALIDATE_SUCCESS_RESPONSE,
  WILAYAS_FIXTURE,
  validationErrorBag,
} from "./fixtures";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EcotrackRecordedRequest {
  method: string;
  path: string;
  url: string;
  searchParams: URLSearchParams;
  headers: Record<string, string>;
  body?: string;
}

export interface MockParcelState {
  tracking: string;
  reference: string | null;
  validated: boolean;
  returnAsked: boolean;
  status: string;
  params: Record<string, string>;
  activity: EcotrackTrackingActivity[];
  remarks: EcotrackMajEntry[];
}

type RouteResponder = (req: EcotrackRecordedRequest) => Response | Promise<Response>;

export interface EcotrackMockServer {
  readonly baseUrl: string;
  readonly token: string;
  readonly requests: EcotrackRecordedRequest[];
  callsFor(path: string): EcotrackRecordedRequest[];
  parcel(tracking: string): MockParcelState | undefined;
  override(path: string, responder: RouteResponder): void;
  reset(): void;
  fetch(url: string | URL, init?: RequestInit): Promise<Response>;
}

export interface CreateEcotrackMockServerOptions {
  baseUrl?: string;
  token?: string;
  activeWilayaIds?: ReadonlySet<number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pdfResponse(bytes: Uint8Array): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="label.pdf"',
    },
  });
}

function nowDateTime(): { date: string; time: string } {
  const now = new Date().toISOString();
  return { date: now.slice(0, 10), time: now.slice(11, 19) };
}

function parseHeaders(init?: RequestInit): Record<string, string> {
  if (!init?.headers) return {};
  return Object.fromEntries(new Headers(init.headers).entries());
}

// Endpoints that authenticate via the api_token QUERY param instead of Bearer.
// validate/token is EXCLUDED from the auth gate entirely: its documented job
// is to evaluate ANY token and answer VALID_TOKEN / INVALID_TOKEN /
// TOKEN_NOT_ALLOWED on HTTP 200 — an invalid token is a valid response there.
const QUERY_AUTH_PATHS = new Set<string>(["/api/v1/get/orders/status"]);

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createEcotrackMockServer(
  options: CreateEcotrackMockServerOptions = {}
): EcotrackMockServer {
  const baseUrl = options.baseUrl ?? "https://packers.ecotrack.dz";
  const token = options.token ?? "ecotrack-test-token";
  const activeWilayaIds = options.activeWilayaIds ?? ACTIVE_WILAYA_IDS;

  const requests: EcotrackRecordedRequest[] = [];
  const overrides = new Map<string, RouteResponder>();
  const parcels = new Map<string, MockParcelState>();
  let trackingCounter = 0;

  function nextTracking(): string {
    trackingCounter += 1;
    return `ECMOCK${String(trackingCounter).padStart(10, "0")}`;
  }

  function createParcel(params: Record<string, string>): MockParcelState {
    const { date, time } = nowDateTime();
    const tracking = nextTracking();
    const parcel: MockParcelState = {
      tracking,
      reference: params.reference || null,
      validated: false,
      returnAsked: false,
      status: "prete_a_expedier",
      params,
      activity: [
        { date, time, status: "order_information_received_by_carrier", station: "" },
      ],
      remarks: [],
    };
    parcels.set(tracking, parcel);
    return parcel;
  }

  function toOrderRow(parcel: MockParcelState) {
    return {
      tracking: parcel.tracking,
      reference: parcel.reference,
      client: parcel.params.nom_client,
      phone: parcel.params.telephone,
      phone_2: parcel.params.telephone_2 ?? null,
      adresse: parcel.params.adresse,
      commune: parcel.params.commune,
      wilaya_id: Number(parcel.params.code_wilaya),
      montant: parcel.params.montant,
      tarif_prestation: "400",
      tarif_retour: "200",
      type_id: Number(parcel.params.type ?? 1),
      created_at: parcel.activity[0]?.date ?? nowDateTime().date,
      payment_id: null,
      return_id: null,
      status: parcel.status,
      products: parcel.params.produit ?? null,
    };
  }

  function missingCreateFields(query: URLSearchParams): string[] {
    return CREATE_REQUIRED_FIELDS.filter((field) => !query.get(field));
  }

  // ─── Route handlers ────────────────────────────────────────────────────────

  const routes: Record<string, RouteResponder> = {
    "GET /api/v1/validate/token": (req) => {
      const apiToken = req.searchParams.get("api_token");
      if (apiToken === token) return jsonResponse(TOKEN_VALID_RESPONSE);
      return jsonResponse(TOKEN_INVALID_RESPONSE);
    },

    "POST /api/v1/create/order": (req) => {
      const missing = missingCreateFields(req.searchParams);
      if (missing.length > 0) return jsonResponse(validationErrorBag(missing), 422);

      const wilayaId = Number(req.searchParams.get("code_wilaya"));
      if (!activeWilayaIds.has(wilayaId)) {
        return jsonResponse(CREATE_WILAYA_REFUSED_RESPONSE);
      }

      const params = Object.fromEntries(req.searchParams.entries());
      const parcel = createParcel(params);
      return jsonResponse({ success: true, tracking: parcel.tracking });
    },

    "POST /api/v1/create/orders": (req) => {
      let body: { orders?: Record<string, Record<string, unknown>> };
      try {
        body = JSON.parse(req.body ?? "{}");
      } catch {
        return jsonResponse(validationErrorBag(["orders"]), 422);
      }
      const orders = body.orders ?? {};
      const results: Record<string, unknown> = {};

      for (const [key, order] of Object.entries(orders)) {
        const asQuery = new URLSearchParams();
        for (const [field, value] of Object.entries(order)) {
          if (value != null) asQuery.set(field, String(value));
        }
        const missing = missingCreateFields(asQuery);
        const resultKey = typeof order.reference === "string" && order.reference ? order.reference : key;
        if (missing.length > 0) {
          results[resultKey] = validationErrorBag(missing).errors;
          continue;
        }
        if (!activeWilayaIds.has(Number(asQuery.get("code_wilaya")))) {
          results[resultKey] = CREATE_WILAYA_REFUSED_RESPONSE;
          continue;
        }
        const parcel = createParcel(Object.fromEntries(asQuery.entries()));
        results[resultKey] = { success: true, tracking: parcel.tracking };
      }

      return jsonResponse({ results });
    },

    "POST /api/v1/update/order": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);
      if (parcel.validated) return jsonResponse(NOT_MODIFIABLE_RESPONSE);

      for (const [field, value] of req.searchParams.entries()) {
        if (field !== "tracking") parcel.params[field] = value;
      }
      return jsonResponse(UPDATE_SUCCESS_RESPONSE);
    },

    "DELETE /api/v1/delete/order": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);
      if (parcel.validated) return jsonResponse(NOT_MODIFIABLE_RESPONSE);

      parcels.delete(tracking!);
      return jsonResponse(DELETE_SUCCESS_RESPONSE);
    },

    "POST /api/v1/valid/order": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);

      parcel.validated = true;
      parcel.status = "en_livraison";
      const { date, time } = nowDateTime();
      parcel.activity.push({ date, time, status: "picked", station: "" });
      return jsonResponse(VALIDATE_SUCCESS_RESPONSE);
    },

    "POST /api/v1/valid/returns": (req) => {
      let body: { trackings?: string[] };
      try {
        body = JSON.parse(req.body ?? "{}");
      } catch {
        body = {};
      }
      if (!Array.isArray(body.trackings) || body.trackings.length === 0) {
        return jsonResponse(
          {
            message: "The trackings field is required.",
            errors: { trackings: ["The trackings field is required."] },
          },
          422
        );
      }
      const allKnown = body.trackings.every((t) => parcels.has(t));
      return jsonResponse(allKnown ? RETURNS_VALIDATED_RESPONSE : RETURNS_NOT_ELIGIBLE_RESPONSE);
    },

    "GET /api/v1/get/order/label": (req) => {
      const tracking = req.searchParams.get("tracking");
      if (!tracking || !parcels.has(tracking)) {
        return jsonResponse(TRACKING_INVALID_422, 422);
      }
      return pdfResponse(LABEL_PDF_BYTES);
    },

    "POST /api/v1/add/maj": (req) => {
      const tracking = req.searchParams.get("tracking");
      const content = req.searchParams.get("content");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);
      if (!content) return jsonResponse(validationErrorBag(["content"]), 422);

      const { date, time } = nowDateTime();
      parcel.remarks.push({
        remarque: `Test Shop : ${content}`,
        commentaires: "",
        station: "",
        livreur: "",
        created_at: `${date} ${time}`,
        tracking: parcel.tracking,
      });
      parcel.activity.push({ date, time, status: "notification_on_order", station: "" });
      return jsonResponse(ADD_MAJ_SUCCESS_RESPONSE);
    },

    "GET /api/v1/get/maj": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);
      return jsonResponse(parcel.remarks.length > 0 ? parcel.remarks : MAJ_LIST_FIXTURE);
    },

    "POST /api/v1/ask/for/order/return": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel || !parcel.validated) return jsonResponse(ASK_RETURN_REFUSED_RESPONSE);

      parcel.returnAsked = true;
      parcel.status = "retour_chez_livreur";
      const { date, time } = nowDateTime();
      parcel.activity.push({ date, time, status: "return_asked", station: "" });
      return jsonResponse(ASK_RETURN_SUCCESS_RESPONSE);
    },

    "GET /api/v1/get/tracking/info": (req) => {
      const tracking = req.searchParams.get("tracking");
      const parcel = tracking ? parcels.get(tracking) : undefined;
      if (!parcel) return jsonResponse(TRACKING_INVALID_422, 422);

      return jsonResponse({
        recipientName: parcel.params.nom_client,
        shippedBy: "Test Shop",
        originCity: 16,
        destLocationCity: Number(parcel.params.code_wilaya),
        currentStation: "",
        activity: parcel.activity,
        reasons: [],
      });
    },

    "GET /api/v1/get/trackings/info": (req) => {
      const trackings = req.searchParams.getAll("trackings[]");
      const data: Record<string, unknown> = {};
      for (const tracking of trackings) {
        const parcel = parcels.get(tracking);
        if (parcel) {
          data[tracking] = {
            status: parcel.status,
            activity: parcel.activity,
          };
        }
      }
      return jsonResponse({ data });
    },

    "GET /api/v1/get/orders": (req) => {
      const tracking = req.searchParams.get("tracking");
      const page = Number(req.searchParams.get("page") ?? "1");

      let rows: unknown[];
      if (tracking) {
        const parcel = parcels.get(tracking);
        rows = parcel ? [toOrderRow(parcel)] : [];
      } else {
        rows = parcels.size > 0 ? [...parcels.values()].map(toOrderRow) : [...ORDERS_PAGE_FIXTURE.data];
      }

      return jsonResponse({
        current_page: page,
        data: rows,
        from: rows.length > 0 ? (page - 1) * 40 + 1 : null,
        last_page: Math.max(1, Math.ceil(rows.length / 40)),
        per_page: 40,
        to: rows.length > 0 ? (page - 1) * 40 + rows.length : null,
        total: rows.length,
      });
    },

    "GET /api/v1/get/orders/status": (req) => {
      const trackings = (req.searchParams.get("trackings") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const data: Record<string, unknown> = {};
      for (const tracking of trackings) {
        const parcel = parcels.get(tracking);
        data[tracking] = parcel
          ? {
              status: parcel.status,
              order_id: "",
              desk_phone: "",
              desk_commune: "",
              desk_map_link: "",
              desk_address: "",
              activity: [],
            }
          : (ORDERS_STATUS_FIXTURE.data as Record<string, unknown>)[tracking] ?? {
              status: "all",
              activity: [],
            };
      }
      return jsonResponse({ data });
    },

    "GET /api/v1/get/wilayas": () => jsonResponse(WILAYAS_FIXTURE),

    "GET /api/v1/get/desks": () => jsonResponse(DESKS_FIXTURE),

    "GET /api/v1/get/communes": (req) => {
      const wilayaId = req.searchParams.get("wilaya_id");
      if (!wilayaId) return jsonResponse(COMMUNES_FIXTURE);
      const filtered: Record<string, unknown> = {};
      let index = 0;
      for (const entry of Object.values(COMMUNES_FIXTURE)) {
        if (entry.wilaya_id === Number(wilayaId)) {
          filtered[String(index++)] = entry;
        }
      }
      return jsonResponse(filtered);
    },

    "GET /api/v1/get/fees": () => jsonResponse(FEES_FIXTURE),

    "GET /api/v1/get/products/list": () => jsonResponse(PRODUCTS_LIST_FIXTURE),
  };

  // ─── fetch implementation ──────────────────────────────────────────────────

  const server: EcotrackMockServer = {
    baseUrl,
    token,
    requests,

    callsFor(path) {
      return requests.filter((r) => r.path === path);
    },

    parcel(tracking) {
      return parcels.get(tracking);
    },

    override(path, responder) {
      overrides.set(path, responder);
    },

    reset() {
      requests.length = 0;
      overrides.clear();
      parcels.clear();
      trackingCounter = 0;
    },

    async fetch(url, init) {
      const fullUrl = new URL(url.toString(), baseUrl);
      const recorded: EcotrackRecordedRequest = {
        method: (init?.method ?? "GET").toUpperCase(),
        path: fullUrl.pathname,
        url: fullUrl.toString(),
        searchParams: new URLSearchParams(fullUrl.search),
        headers: parseHeaders(init),
        body: typeof init?.body === "string" ? init.body : undefined,
      };
      requests.push(recorded);

      const authHeader = recorded.headers["authorization"];
      const hasBearer = authHeader === `Bearer ${token}`;
      const hasQueryToken = recorded.searchParams.get("api_token") === token;

      // validate/token always reaches its handler — the handler itself answers
      // VALID_TOKEN / INVALID_TOKEN for any token (mirrors the real API).
      const isTokenValidation = recorded.path === "/api/v1/validate/token";
      const authenticated = isTokenValidation
        ? true
        : QUERY_AUTH_PATHS.has(recorded.path)
          ? hasQueryToken
          : hasBearer;
      if (!authenticated) {
        return jsonResponse(UNAUTHENTICATED_RESPONSE, 401);
      }

      const override = overrides.get(recorded.path);
      if (override) return override(recorded);

      const handler = routes[`${recorded.method} ${recorded.path}`];
      if (handler) return handler(recorded);

      return jsonResponse({ message: "Not Found" }, 404);
    },
  };

  return server;
}
