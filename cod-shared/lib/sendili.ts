/**
 * Sendili transactional email API client
 *
 * One deep module: two methods (send, getAccount) hiding the whole provider
 * surface — auth, envelopes, idempotency, error taxonomy.
 *
 * Interface contract (source of truth: sendili.md, repo root):
 *   - Auth: `Authorization: Bearer <api key>` on every request.
 *   - POST /v1/emails returns 200 with a FLAT body
 *     `{ message_id, recipients, suppressed_recipients, created_at }` as soon
 *     as the email is ACCEPTED — accepted is not delivered. Follow-up needs
 *     GET /v1/emails/{id} (not part of this client — no caller yet).
 *   - Sendili paces delivery itself: never add retry/throttle code for a
 *     delayed message. A 429 declines to accept more right now — honour
 *     `details.retryAfterSeconds`.
 *   - Suppressed recipients are dropped before charging and listed in
 *     `suppressedRecipients`. A fully-suppressed send is recorded by Sendili
 *     as rejected — nothing is charged.
 *   - `Idempotency-Key` (<= 255 chars): retrying with the same key and the
 *     same body replays the original result instead of sending again.
 *     Without it, a retry sends a second real email.
 *   - 402 = out of credits (nothing sent, nothing charged — NOT a 429).
 *   - 403 = workspace not provisioned, sending disabled, or the sender
 *     domain not verified in the Sendili workspace.
 *   - 422 = validation failure; `details.issues` names each bad field path.
 *   - Every failure throws SendiliError carrying a stable `code` derived
 *     from the documented HTTP status — callers branch on `err.code`, never
 *     on message text.
 *
 * All CodFlow mail is transactional (invites, password resets) — `category`
 * is pinned to "transactional" so it can never land in the marketing lane.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Stable codes derived from sendili.md's documented HTTP statuses. */
export const SENDILI_ERRORS = {
  /** 401 — missing, malformed, unknown or revoked API key. */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** 402 — out of credits. Nothing was sent and nothing was charged. */
  OUT_OF_CREDITS: "OUT_OF_CREDITS",
  /** 403 — workspace not provisioned, sending disabled, or sender domain not verified. */
  FORBIDDEN: "FORBIDDEN",
  /** 404 — no such resource, or it belongs to another workspace. */
  NOT_FOUND: "NOT_FOUND",
  /** 409 — Idempotency-Key reused with a different body, or still in flight. */
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  /** 413 — request body over 20 MB. */
  TOO_LARGE: "TOO_LARGE",
  /** 400/422 — the payload (or query/cursor) failed provider validation. */
  VALIDATION: "VALIDATION",
  /** 429 — sending rate or daily quota exceeded. Honour retryAfterSeconds. */
  RATE_LIMITED: "RATE_LIMITED",
  /** 500/502/network/non-JSON — provider-side or transport failure, safe to retry. */
  TRANSIENT: "TRANSIENT",
} as const;

export class SendiliError extends Error {
  /** Stable code — branch on this, never on message. */
  readonly code: string;
  readonly statusCode: number;
  /** Structured context: provider type/message, requestId, issues, retryAfterSeconds. */
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SendiliError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /** True when the send could not happen because the credit balance ran out. */
  get isOutOfCredits(): boolean {
    return this.code === SENDILI_ERRORS.OUT_OF_CREDITS;
  }

  /** True for provider/network failures that are safe to retry later. */
  get isTransient(): boolean {
    return (
      this.code === SENDILI_ERRORS.TRANSIENT ||
      this.statusCode >= 500
    );
  }
}

function statusToCode(status: number): string {
  if (status === 401) return SENDILI_ERRORS.UNAUTHORIZED;
  if (status === 402) return SENDILI_ERRORS.OUT_OF_CREDITS;
  if (status === 403) return SENDILI_ERRORS.FORBIDDEN;
  if (status === 404) return SENDILI_ERRORS.NOT_FOUND;
  if (status === 409) return SENDILI_ERRORS.IDEMPOTENCY_CONFLICT;
  if (status === 413) return SENDILI_ERRORS.TOO_LARGE;
  if (status === 422) return SENDILI_ERRORS.VALIDATION;
  if (status === 429) return SENDILI_ERRORS.RATE_LIMITED;
  if (status >= 500) return SENDILI_ERRORS.TRANSIENT;
  // Undocumented 4xx — by HTTP semantics the request itself was wrong.
  return SENDILI_ERRORS.VALIDATION;
}

// ─── Public shapes ────────────────────────────────────────────────────────────

export interface SendiliEmail {
  /** Verified sender address — its domain must be verified in the workspace (403 otherwise). */
  fromEmail: string;
  /** Optional sender display name. */
  fromName?: string;
  /** Single recipient address. CodFlow's transactional flows are one-to-one. */
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. */
  text?: string;
  replyTo?: string;
  /**
   * Stable retry key (<= 255 chars): the same key + the same body replays the
   * original result instead of sending a second email.
   */
  idempotencyKey?: string;
}

export interface SendiliSendResult {
  messageId: string;
  /** Recipients consumed against the quota/credits (suppressed ones are not charged). */
  recipients: number;
  /** Addresses dropped as suppressed — skipped, not charged. */
  suppressedRecipients: string[];
  createdAt: string | null;
}

export interface SendiliAccount {
  /**
   * Verified sending domains. sendili.md guarantees "GET /v1/account lists the
   * domains you may send from" but does not pin the field shape, so extraction
   * is defensive: flat `domains`, enveloped `data.domains`, string entries, or
   * object entries carrying domain/name. Empty when nothing recognizable.
   */
  domains: string[];
  /** Full parsed payload — inspect, never assume. */
  raw: Record<string, unknown>;
}

export interface SendiliClient {
  send(email: SendiliEmail): Promise<SendiliSendResult>;
  getAccount(): Promise<SendiliAccount>;
}

// ─── Provider body parsing ────────────────────────────────────────────────────

interface ParsedErrorBody {
  type?: string;
  message?: string;
  requestId?: string;
  issues?: unknown[];
}

/**
 * sendili.md: "Every failure returns the same shape: a type you can branch on,
 * a message for humans, and a request_id… Validation failures add issues."
 * The exact field container is not pinned, so both a flat body and a nested
 * `error` object are accepted — defensive, never assuming.
 */
function parseErrorBody(body: unknown): ParsedErrorBody {
  if (!body || typeof body !== "object") return {};
  const root = body as Record<string, unknown>;
  const nested =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : null;
  const source = nested ?? root;
  return {
    type: typeof source.type === "string" ? source.type : undefined,
    message: typeof source.message === "string" ? source.message : undefined,
    requestId: typeof source.request_id === "string" ? source.request_id : undefined,
    issues: Array.isArray(source.issues) ? source.issues : undefined,
  };
}

async function makeError(res: Response): Promise<SendiliError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body — code still comes from the status; details stay empty.
  }
  const parsed = parseErrorBody(body);

  const details: Record<string, unknown> = {};
  if (parsed.type != null) details.type = parsed.type;
  if (parsed.message != null) details.message = parsed.message;
  if (parsed.requestId != null) details.requestId = parsed.requestId;
  if (parsed.issues != null) details.issues = parsed.issues;

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter != null && /^\d+$/.test(retryAfter)) {
      details.retryAfterSeconds = Number(retryAfter);
    }
  }

  const code = statusToCode(res.status);
  const message = parsed.message ?? `sendili HTTP ${res.status}`;
  return new SendiliError(
    code,
    message,
    res.status,
    Object.keys(details).length > 0 ? details : undefined
  );
}

function normalizeDomainList(candidate: unknown): string[] {
  if (!Array.isArray(candidate)) return [];
  const out: string[] = [];
  for (const entry of candidate) {
    if (typeof entry === "string") {
      out.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const name = [obj.domain, obj.name, obj.id].find(
        (value) => typeof value === "string" && value.length > 0
      );
      if (typeof name === "string") out.push(name);
    }
  }
  return out;
}

function extractDomains(root: Record<string, unknown>): string[] {
  const containers: Array<Record<string, unknown>> = [];
  if (root.data && typeof root.data === "object") {
    containers.push(root.data as Record<string, unknown>);
  }
  containers.push(root);
  for (const container of containers) {
    const domains = normalizeDomainList(container.domains);
    if (domains.length > 0) return domains;
  }
  return [];
}

// ─── Client ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.sendili.com";

export function createSendiliClient(apiKey: string): SendiliClient {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  async function request(
    path: string,
    init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string }
  ): Promise<unknown> {
    const res = await fetch(`${BASE_URL}${path}`, init);
    if (!res.ok) {
      throw await makeError(res);
    }
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new SendiliError(
        SENDILI_ERRORS.TRANSIENT,
        `sendili HTTP ${res.status} — response is not valid JSON`,
        res.status
      );
    }
  }

  return {
    async send(email) {
      const payload: Record<string, unknown> = {
        from:
          email.fromName != null && email.fromName.length > 0
            ? { email: email.fromEmail, name: email.fromName }
            : email.fromEmail,
        to: email.to,
        subject: email.subject,
        html: email.html,
        category: "transactional",
      };
      if (email.text != null) payload.text = email.text;
      if (email.replyTo != null) payload.reply_to = email.replyTo;

      const requestHeaders: Record<string, string> = { ...headers };
      if (email.idempotencyKey != null) {
        requestHeaders["Idempotency-Key"] = email.idempotencyKey;
      }

      const body = await request("/v1/emails", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });

      const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      if (typeof obj.message_id !== "string" || obj.message_id.length === 0) {
        throw new SendiliError(
          SENDILI_ERRORS.TRANSIENT,
          "sendili accepted the send but returned no message_id",
          200
        );
      }
      return {
        messageId: obj.message_id,
        recipients: typeof obj.recipients === "number" ? obj.recipients : 1,
        suppressedRecipients: Array.isArray(obj.suppressed_recipients)
          ? obj.suppressed_recipients.filter((r): r is string => typeof r === "string")
          : [],
        createdAt: typeof obj.created_at === "string" ? obj.created_at : null,
      };
    },

    async getAccount() {
      const body = await request("/v1/account", { method: "GET", headers });
      const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      return { domains: extractDomains(obj), raw: obj };
    },
  };
}
