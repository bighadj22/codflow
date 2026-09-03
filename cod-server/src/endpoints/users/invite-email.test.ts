/**
 * Team invite email — unit tests
 *
 * Pins the invite-specific contract: template rendering (language, store
 * name, sign-in URL, temp password), the `invite-{userId}` idempotency key,
 * and delegation to the shared send path. The send-path security contract
 * (silent skip, stable error codes, no provider-text leaks) is pinned once
 * in transactional-email.test.ts — not duplicated here.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { dashboardSignInUrl, sendInviteEmail } from "./invite-email";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("../../../../cod-shared/queries/stores");
vi.mock("../../../../cod-shared/lib/transactional-email");

import { getStore } from "../../../../cod-shared/queries/stores";
import { sendTransactionalEmail } from "../../../../cod-shared/lib/transactional-email";

const db = {} as Parameters<typeof sendInviteEmail>[0];
const env = { BETTER_AUTH_URL: "https://dashboard.example.com/api/auth" };

const input = {
  userId: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8",
  name: "Amina",
  email: "amina@example.com",
  tempPassword: "a1b2c3d4e5f6g7h8i9j0",
  language: "en" as const,
};

describe("dashboardSignInUrl", () => {
  it("strips the /api/auth suffix and appends /sign-in", () => {
    expect(dashboardSignInUrl("https://dashboard.example.com/api/auth")).toBe(
      "https://dashboard.example.com/sign-in"
    );
    expect(dashboardSignInUrl("http://localhost:4321/api/auth")).toBe(
      "http://localhost:4321/sign-in"
    );
  });

  it("uses the base as-is when the suffix is absent", () => {
    expect(dashboardSignInUrl("https://dashboard.example.com")).toBe(
      "https://dashboard.example.com/sign-in"
    );
  });
});

describe("sendInviteEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStore).mockResolvedValue({ id: "store-1", name: "Acme Store" } as any);
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ sent: true, error: null });
  });

  it("renders the invite in the invitee's language and hands it to the shared send path", async () => {
    await sendInviteEmail(db, env, input);

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        to: "amina@example.com",
        subject: "You're invited to join Acme Store",
        idempotencyKey: `invite-${input.userId}`,
      })
    );
    const email = vi.mocked(sendTransactionalEmail).mock.calls[0][1];
    expect(email.html).toContain("https://dashboard.example.com/sign-in");
    expect(email.html).toContain(input.tempPassword);
    expect(email.text).toContain(input.tempPassword);
  });

  it("renders the Arabic template when the user's language is ar", async () => {
    await sendInviteEmail(db, env, { ...input, language: "ar" });

    expect(vi.mocked(sendTransactionalEmail).mock.calls[0][1].subject).toBe(
      "دعوة للانضمام إلى فريق Acme Store"
    );
  });

  it("falls back to CodFlow as the store name when the store row is missing", async () => {
    vi.mocked(getStore).mockResolvedValue(undefined as any);

    await sendInviteEmail(db, env, input);

    expect(vi.mocked(sendTransactionalEmail).mock.calls[0][1].subject).toBe(
      "You're invited to join CodFlow"
    );
  });

  it("propagates the shared outcome untouched", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ sent: false, error: "out_of_credits" });

    expect(await sendInviteEmail(db, env, input)).toEqual({ sent: false, error: "out_of_credits" });
  });
});
