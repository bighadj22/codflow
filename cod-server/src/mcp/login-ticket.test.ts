/**
 * Login ticket — the cross-worker auth handoff for the MCP OAuth flow.
 *
 * Contract:
 *   • mint → verify returns the payload (sub/exp/nonce)
 *   • tampered, wrong-secret, expired, and malformed tickets → null (fail closed)
 *   • minting with a secret shorter than 32 bytes throws
 */

import { describe, it, expect } from "vitest";
import {
  mintLoginTicket,
  verifyLoginTicket,
  LOGIN_TICKET_MIN_KEY_BYTES,
} from "../../../cod-shared/lib/login-ticket";

const KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

describe("login ticket", () => {
  it("mints a ticket that verifies with the payload", async () => {
    const ticket = await mintLoginTicket(KEY, "user-1", NOW);

    const payload = await verifyLoginTicket(KEY, ticket, NOW);

    expect(payload).toMatchObject({ sub: "user-1" });
    expect(payload?.nonce).toBeTruthy();
    expect(payload?.exp).toBe(Math.floor(NOW / 1000) + 5 * 60);
  });

  it("rejects a tampered ticket", async () => {
    const ticket = await mintLoginTicket(KEY, "user-1", NOW);

    // Tamper a MIDDLE character of the MAC: base64url strips the padding, so
    // the final char encodes only its top 2 bits — flipping the last char
    // between same-top-2-bits letters (a/b/c/d/e/f…) leaves the decoded MAC
    // unchanged and the ticket still verifies (flaky, ~12% of mints). Middle
    // characters contribute every bit, so this tamper is always real.
    const parts = ticket.split(".");
    const mac = parts[2];
    const i = Math.floor(mac.length / 2);
    parts[2] = mac.slice(0, i) + (mac[i] === "A" ? "B" : "A") + mac.slice(i + 1);
    const tampered = parts.join(".");

    expect(tampered).not.toBe(ticket);
    expect(await verifyLoginTicket(KEY, tampered, NOW)).toBeNull();
  });

  it("rejects a ticket signed with a different secret", async () => {
    const ticket = await mintLoginTicket(KEY, "user-1", NOW);

    expect(await verifyLoginTicket(`${KEY}x`, ticket, NOW)).toBeNull();
  });

  it("rejects an expired ticket", async () => {
    const ticket = await mintLoginTicket(KEY, "user-1", NOW);

    expect(await verifyLoginTicket(KEY, ticket, NOW + 6 * 60 * 1000)).toBeNull();
  });

  it("rejects malformed tickets", async () => {
    expect(await verifyLoginTicket(KEY, "not-a-ticket", NOW)).toBeNull();
    expect(await verifyLoginTicket(KEY, "v1.abc.def", NOW)).toBeNull();
    expect(await verifyLoginTicket(KEY, "", NOW)).toBeNull();
  });

  it("throws when the secret is shorter than 32 bytes", async () => {
    await expect(mintLoginTicket("short", "user-1", NOW)).rejects.toBeInstanceOf(RangeError);
  });

  it("exports the minimum key length constant for callers", () => {
    expect(LOGIN_TICKET_MIN_KEY_BYTES).toBe(32);
  });
});
