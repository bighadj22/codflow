/**
 * sendTransactionalEmail — unit tests
 *
 * Pins the ONE send path shared by every transactional email (invites on
 * cod-server, password resets on the dashboard worker):
 *   - no config / disabled = silent skip, never throws
 *   - from/fromName/idempotency wiring
 *   - every failure maps to a stable code — never provider message text
 *   - an idempotency conflict means the original send already happened
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendTransactionalEmail } from "./transactional-email";
import { SendiliError, SENDILI_ERRORS } from "./sendili";

vi.mock("../queries/email-config");
vi.mock("../queries/stores");

import { getEmailConfigRaw } from "../queries/email-config";
import { getStore } from "../queries/stores";
import * as sendili from "./sendili";

const db = {} as Parameters<typeof sendTransactionalEmail>[0];

const email = {
  to: "amina@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
  text: "Hello",
};

function storedConfig(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "store-1",
    apiKey: "sk_live_secret",
    fromEmail: "noreply@acme.com",
    fromName: "Acme",
    enabled: true,
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

function mockSend(send: ReturnType<typeof vi.fn>) {
  vi.spyOn(sendili, "createSendiliClient").mockReturnValue({
    send,
  } as unknown as sendili.SendiliClient);
  return send;
}

describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStore).mockResolvedValue({ id: "store-1", name: "Acme Store" } as any);
    vi.spyOn(sendili, "createSendiliClient").mockReturnValue({
      send: vi.fn(),
    } as unknown as sendili.SendiliClient);
  });

  it("skips silently when no email config exists (feature inert)", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(undefined as any);

    expect(await sendTransactionalEmail(db, email)).toEqual({ sent: false, error: null });
    expect(sendili.createSendiliClient).not.toHaveBeenCalled();
  });

  it("skips silently when email sending is disabled", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig({ enabled: false }) as any);

    expect(await sendTransactionalEmail(db, email)).toEqual({ sent: false, error: null });
    expect(sendili.createSendiliClient).not.toHaveBeenCalled();
  });

  it("sends with the stored sender identity and the idempotency key", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
    const send = mockSend(vi.fn(async () => ({
      messageId: "msg_1", recipients: 1, suppressedRecipients: [], createdAt: "t",
    })));

    const outcome = await sendTransactionalEmail(db, { ...email, idempotencyKey: "invite-u1" });

    expect(outcome).toEqual({ sent: true, error: null });
    expect(sendili.createSendiliClient).toHaveBeenCalledWith("sk_live_secret");
    expect(send.mock.calls[0][0]).toMatchObject({
      fromEmail: "noreply@acme.com",
      fromName: "Acme",
      to: "amina@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "invite-u1",
    });
  });

  it("omits fromName when the store has none stored", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig({ fromName: null }) as any);
    const send = mockSend(vi.fn(async () => ({
      messageId: "m", recipients: 1, suppressedRecipients: [], createdAt: "t",
    })));

    await sendTransactionalEmail(db, email);

    expect(send.mock.calls[0][0].fromName).toBeUndefined();
  });

  it("skips when the store row itself is missing", async () => {
    vi.mocked(getStore).mockResolvedValue(undefined as any);
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig() as any);

    expect(await sendTransactionalEmail(db, email)).toEqual({ sent: false, error: null });
  });

  const errorMatrix: Array<{ code: string; expected: string; status?: number }> = [
    { code: SENDILI_ERRORS.OUT_OF_CREDITS, expected: "out_of_credits" },
    { code: SENDILI_ERRORS.UNAUTHORIZED, expected: "invalid_key" },
    { code: SENDILI_ERRORS.FORBIDDEN, expected: "forbidden" },
    { code: SENDILI_ERRORS.RATE_LIMITED, expected: "rate_limited" },
    { code: SENDILI_ERRORS.VALIDATION, expected: "validation" },
    { code: SENDILI_ERRORS.TRANSIENT, expected: "transient", status: 502 },
    { code: "SOMETHING_NEW", expected: "transient", status: 500 },
  ];

  for (const { code, expected, status = 400 } of errorMatrix) {
    it(`maps ${code} to the stable ${expected} code`, async () => {
      vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      mockSend(vi.fn(async () => {
        throw new SendiliError(code, "provider detail with sk_live_secret", status);
      }));

      const outcome = await sendTransactionalEmail(db, email);

      expect(outcome).toEqual({ sent: false, error: expected });
      expect(JSON.stringify(outcome)).not.toContain("sk_live_secret");
    });
  }

  it("maps raw network errors to transient (never throws)", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
    mockSend(vi.fn(async () => {
      throw new Error("fetch failed");
    }));

    expect(await sendTransactionalEmail(db, email)).toEqual({ sent: false, error: "transient" });
  });

  it("treats an idempotency-key conflict as already sent", async () => {
    vi.mocked(getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
    mockSend(vi.fn(async () => {
      throw new SendiliError(SENDILI_ERRORS.IDEMPOTENCY_CONFLICT, "reused", 409);
    }));

    expect(await sendTransactionalEmail(db, email)).toEqual({ sent: true, error: null });
  });
});
