/**
 * Sendili transactional email client — unit tests
 *
 * Interface-driven: every test crosses the module's public seam exactly the
 * way a caller would (mocked fetch). Error taxonomy cases mirror the
 * sendili.md status table one-for-one.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSendiliClient,
  SendiliError,
  SENDILI_ERRORS,
} from "./sendili";

const API_KEY = "sk_live_test-key";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const sendAccepted = {
  message_id: "msg_5dc2573dfe504e53bcddca311c07de9f",
  recipients: 1,
  suppressed_recipients: [],
  created_at: "2026-09-03T02:22:43.210Z",
};

const baseEmail = {
  fromEmail: "noreply@acme.com",
  fromName: "Acme",
  to: "staff@example.com",
  subject: "Welcome",
  html: "<p>Hello</p>",
};

describe("createSendiliClient.send", () => {
  let client: ReturnType<typeof createSendiliClient>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = createSendiliClient(API_KEY);
    fetchMock = vi.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs /v1/emails with bearer auth and parses the flat response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));

    const result = await client.send(baseEmail);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sendili.com/v1/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${API_KEY}`);
    expect(result.messageId).toBe(sendAccepted.message_id);
    expect(result.recipients).toBe(1);
    expect(result.suppressedRecipients).toEqual([]);
    expect(result.createdAt).toBe(sendAccepted.created_at);
  });

  it("builds from as an object when fromName is present, plain string otherwise", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));
    await client.send(baseEmail);
    const withName = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(withName.from).toEqual({ email: "noreply@acme.com", name: "Acme" });

    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));
    await client.send({ ...baseEmail, fromName: undefined });
    const withoutName = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(withoutName.from).toBe("noreply@acme.com");
  });

  it("always sends category transactional and omits text/reply_to when unset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));

    await client.send(baseEmail);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.category).toBe("transactional");
    expect("text" in body).toBe(false);
    expect("reply_to" in body).toBe(false);
    expect(body.to).toBe("staff@example.com");
    expect(body.subject).toBe("Welcome");
    expect(body.html).toBe("<p>Hello</p>");
  });

  it("includes text and reply_to when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));

    await client.send({ ...baseEmail, text: "Hello", replyTo: "support@acme.com" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("Hello");
    expect(body.reply_to).toBe("support@acme.com");
  });

  it("sends the Idempotency-Key header when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sendAccepted));

    await client.send({ ...baseEmail, idempotencyKey: "invite-user-1" });

    const init = fetchMock.mock.calls[0][1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("invite-user-1");
  });

  it("maps suppressed_recipients into the result", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...sendAccepted,
        recipients: 0,
        suppressed_recipients: ["bounced@example.com"],
      })
    );

    const result = await client.send(baseEmail);

    expect(result.suppressedRecipients).toEqual(["bounced@example.com"]);
    expect(result.recipients).toBe(0);
  });

  it("throws TRANSIENT when a 200 body carries no message_id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ recipients: 1 }));

    await expect(client.send(baseEmail)).rejects.toMatchObject({
      code: SENDILI_ERRORS.TRANSIENT,
    });
  });

  const errorCases: Array<{
    title: string;
    status: number;
    code: string;
    body?: unknown;
    headers?: Record<string, string>;
    check?: (err: SendiliError) => void;
  }> = [
    {
      title: "401 → UNAUTHORIZED (missing/malformed/revoked key)",
      status: 401,
      code: SENDILI_ERRORS.UNAUTHORIZED,
      body: { type: "unauthorized", message: "Unknown API key", request_id: "req_1" },
    },
    {
      title: "402 → OUT_OF_CREDITS (nothing sent, nothing charged)",
      status: 402,
      code: SENDILI_ERRORS.OUT_OF_CREDITS,
      body: { type: "insufficient_credits", message: "cost 1, balance 0", request_id: "req_2" },
      check: (err) => {
        expect(err.isOutOfCredits).toBe(true);
        expect(err.details?.message).toBe("cost 1, balance 0");
        expect(err.details?.requestId).toBe("req_2");
      },
    },
    {
      title: "403 → FORBIDDEN (domain not verified / sending disabled)",
      status: 403,
      code: SENDILI_ERRORS.FORBIDDEN,
      body: { type: "sender_domain_not_verified", message: "acme.com is not verified" },
    },
    {
      title: "409 → IDEMPOTENCY_CONFLICT (key reused with a different body)",
      status: 409,
      code: SENDILI_ERRORS.IDEMPOTENCY_CONFLICT,
    },
    {
      title: "422 → VALIDATION carrying issues by field path",
      status: 422,
      code: SENDILI_ERRORS.VALIDATION,
      body: { type: "validation_failed", message: "Invalid email", issues: [{ path: "to.1" }] },
      check: (err) => {
        expect(err.details?.issues).toEqual([{ path: "to.1" }]);
      },
    },
    {
      title: "429 → RATE_LIMITED with retryAfterSeconds from Retry-After",
      status: 429,
      code: SENDILI_ERRORS.RATE_LIMITED,
      headers: { "retry-after": "30" },
      check: (err) => {
        expect(err.details?.retryAfterSeconds).toBe(30);
      },
    },
    {
      title: "500 → TRANSIENT (safe to retry)",
      status: 500,
      code: SENDILI_ERRORS.TRANSIENT,
      check: (err) => {
        expect(err.isTransient).toBe(true);
      },
    },
    {
      title: "502 → TRANSIENT (provider temporarily unavailable)",
      status: 502,
      code: SENDILI_ERRORS.TRANSIENT,
    },
  ];

  for (const { title, status, code, body, headers, check } of errorCases) {
    it(`maps ${title}`, async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(body ?? { message: "failure" }, status, headers)
      );

      try {
        await client.send(baseEmail);
        throw new Error("expected send to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(SendiliError);
        const error = err as SendiliError;
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(status);
        check?.(error);
      }
    });
  }

  it("maps non-JSON bodies to TRANSIENT (network/protocol surprises)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("gateway timeout", { status: 502, headers: { "content-type": "text/plain" } })
    );

    await expect(client.send(baseEmail)).rejects.toMatchObject({
      code: SENDILI_ERRORS.TRANSIENT,
    });
  });
});

describe("createSendiliClient.getAccount", () => {
  let client: ReturnType<typeof createSendiliClient>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = createSendiliClient(API_KEY);
    fetchMock = vi.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("GETs /v1/account with bearer auth and extracts flat domain strings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ domains: ["acme.com", "mail.acme.com"] }));

    const account = await client.getAccount();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sendili.com/v1/account");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${API_KEY}`);
    expect(account.domains).toEqual(["acme.com", "mail.acme.com"]);
    expect(account.raw).toEqual({ domains: ["acme.com", "mail.acme.com"] });
  });

  it("extracts domains from an enveloped body (data.domains)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { domains: ["acme.com"], usage: { used: 3 } } })
    );

    const account = await client.getAccount();

    expect(account.domains).toEqual(["acme.com"]);
  });

  it("extracts domain names from object entries", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ domains: [{ domain: "acme.com", verified: true }, { name: "other.com" }] })
    );

    const account = await client.getAccount();

    expect(account.domains).toEqual(["acme.com", "other.com"]);
  });

  it("returns empty domains plus raw when no recognized shape is present", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ usage: { recipients_24h: 10 } }));

    const account = await client.getAccount();

    expect(account.domains).toEqual([]);
    expect(account.raw).toEqual({ usage: { recipients_24h: 10 } });
  });

  it("surfaces 401 as UNAUTHORIZED", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "revoked" }, 401));

    await expect(client.getAccount()).rejects.toMatchObject({
      code: SENDILI_ERRORS.UNAUTHORIZED,
    });
  });
});
