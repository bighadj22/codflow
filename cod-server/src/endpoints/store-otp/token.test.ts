/**
 * OTP token module — security-critical unit tests
 *
 * Pins the whole token contract: round-trip, expiry boundary, tamper
 * resistance, key isolation (per-store + rotation), type isolation, and
 * malformed-input tolerance. Pure functions + Web Crypto — no mocks needed.
 */

import { describe, it, expect } from "vitest";
import { signOtpToken, verifyOtpToken } from "./token";

const KEY_A = "dz-store-a-key";
const KEY_B = "dz-store-b-key";
const PHONE = "+213551234567";
const NOW = 1_800_000_000; // fixed clock for determinism

describe("signOtpToken / verifyOtpToken", () => {
  it("round-trips a verified token with the phone, expiry, and type intact", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "v", NOW);
    const payload = await verifyOtpToken(KEY_A, token, NOW + 60);

    expect(payload).not.toBeNull();
    expect(payload!.phone).toBe(PHONE);
    expect(payload!.type).toBe("v");
    expect(payload!.expiresAt).toBe(NOW + 15 * 60);
  });

  it("mints bypass tokens with type 'b' and verifies them distinctly", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "b", NOW);
    const payload = await verifyOtpToken(KEY_A, token, NOW);
    expect(payload!.type).toBe("b");
  });

  it("expires exactly at the boundary (e <= now rejects)", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "v", NOW);
    expect(await verifyOtpToken(KEY_A, token, NOW + 15 * 60)).toBeNull();
    expect(await verifyOtpToken(KEY_A, token, NOW + 15 * 60 - 1)).not.toBeNull();
  });

  it("rejects tokens signed with a different store's key", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "v", NOW);
    expect(await verifyOtpToken(KEY_B, token, NOW)).toBeNull();
  });

  it("invalidates outstanding tokens when the merchant rotates their dzverify key", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "v", NOW);
    expect(await verifyOtpToken("dz-store-a-rotated-key", token, NOW)).toBeNull();
  });

  it("rejects tampered payloads (flipped phone) and tampered signatures", async () => {
    const token = await signOtpToken(KEY_A, PHONE, "v", NOW);
    const [payloadPart, signaturePart] = token.split(".");

    const b64urlDecode = (t: string) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const b64urlEncode = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadPart)));
    decoded.p = "+213661234567";
    const tamperedPayload = b64urlEncode(new TextEncoder().encode(JSON.stringify(decoded)));
    expect(await verifyOtpToken(KEY_A, `${tamperedPayload}.${signaturePart}`, NOW)).toBeNull();

    const flippedSig = signaturePart.startsWith("A") ? `B${signaturePart.slice(1)}` : `A${signaturePart.slice(1)}`;
    expect(await verifyOtpToken(KEY_A, `${payloadPart}.${flippedSig}`, NOW)).toBeNull();
  });

  it("rejects type escalation: a bypass token cannot pose as verified", async () => {
    const bypass = await signOtpToken(KEY_A, PHONE, "b", NOW);
    const [payloadPart, signaturePart] = bypass.split(".");
    const b64urlDecode = (t: string) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const b64urlEncode = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadPart)));
    decoded.t = "v";
    const escalated = b64urlEncode(new TextEncoder().encode(JSON.stringify(decoded)));
    expect(await verifyOtpToken(KEY_A, `${escalated}.${signaturePart}`, NOW)).toBeNull();
  });

  it("tolerates malformed inputs without throwing", async () => {
    for (const garbage of [
      "",
      "not-a-token",
      "////.,,,",
      `${"A".repeat(2048)}.sig`,
      "e30.", // {} payload
      `${btoa('{"v":2,"p":"+213","e":1,"t":"v"}')}.sig`, // future version
      `${btoa('{"v":1,"p":"+213","e":9999999999,"t":"x"}')}.sig`, // unknown type
    ]) {
      const result = await verifyOtpToken(KEY_A, garbage, NOW);
      expect(result).toBeNull();
    }
  });
});
