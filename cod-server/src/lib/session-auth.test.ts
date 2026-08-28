import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { verifySessionJwt } from "./session-auth";

/**
 * Session-JWT verification for dashboard bearer tokens.
 * Keys are generated per run via WebCrypto (Ed25519), mirroring the
 * better-auth jwt() plugin's default algorithm.
 */

const ENV = {
  BETTER_AUTH_URL: "https://example.com",
  WORKER_SELF_URL: "https://api.example.com/",
};

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid?: string };

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(payload: Record<string, unknown>, kid = "test-kid"): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid }));
  const body = b64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, data);
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "test-kid",
  } as JsonWebKey & { kid?: string };
});

afterEach(() => vi.unstubAllGlobals());

function stubJwks() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 })
    )
  );
}

describe("verifySessionJwt", () => {
  it("accepts a valid token and returns its subject", async () => {
    stubJwks();
    const token = await signJwt({
      sub: "user_1",
      iss: ENV.BETTER_AUTH_URL,
      aud: "https://api.example.com",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const payload = await verifySessionJwt(token, ENV);
    expect(payload.sub).toBe("user_1");
  });

  it("rejects an expired token", async () => {
    stubJwks();
    const token = await signJwt({
      sub: "user_1",
      iss: ENV.BETTER_AUTH_URL,
      aud: "https://api.example.com",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(verifySessionJwt(token, ENV)).rejects.toThrow(/expired/i);
  });

  it("rejects a token signed with a different key", async () => {
    stubJwks();
    const otherPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair;
    const realVerifyKey = privateKey;
    // sign with wrong key by temporarily swapping
    privateKey = otherPair.privateKey;
    const forged = await signJwt({
      sub: "attacker",
      iss: ENV.BETTER_AUTH_URL,
      aud: "https://api.example.com",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    privateKey = realVerifyKey;
    await expect(verifySessionJwt(forged, ENV)).rejects.toThrow();
  });

  it("rejects a wrong issuer", async () => {
    stubJwks();
    const token = await signJwt({
      sub: "user_1",
      iss: "https://evil.example.com",
      aud: "https://api.example.com",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    await expect(verifySessionJwt(token, ENV)).rejects.toThrow(/issuer/i);
  });

  it("rejects a wrong audience", async () => {
    stubJwks();
    const token = await signJwt({
      sub: "user_1",
      iss: ENV.BETTER_AUTH_URL,
      aud: "https://wrong-api.example.com",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    await expect(verifySessionJwt(token, ENV)).rejects.toThrow(/audience/i);
  });

  it("rejects a malformed token", async () => {
    stubJwks();
    await expect(verifySessionJwt("not-a-jwt", ENV)).rejects.toThrow(/malformed/i);
  });
});
