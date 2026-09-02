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
    const tampered = ticket.endsWith("a") ? `${ticket.slice(0, -1)}b` : `${ticket.slice(0, -1)}a`;

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
