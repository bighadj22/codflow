/**
 * Svix Webhook Signature Verification
 *
 * Verifies the HMAC-SHA256 signature on inbound ZR Express webhook deliveries.
 * ZR Express uses Svix infrastructure. No Svix SDK is available on Cloudflare Workers,
 * so we implement the verification manually using the Web Crypto API.
 *
 * Docs: https://docs.svix.com/receiving/verifying-payloads/how-manual
 *
 * Signed content format: "{svix-id}.{svix-timestamp}.{rawBody}"
 * Secret format:         "whsec_<base64-encoded-secret>"
 * Signature header:      "v1,<base64>" (comma-separated, may contain multiple)
 */

const TOLERANCE_SECONDS = 5 * 60; // 5-minute anti-replay window

export async function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Reject if timestamp is outside the 5-minute tolerance window
  const timestamp = parseInt(svixTimestamp, 10);
  if (isNaN(timestamp)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  // Strip the "whsec_" prefix and base64-decode to get the raw key bytes
  const base64Secret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(base64Secret), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  // Import the key for HMAC-SHA256
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // The signed content is exactly: "{svix-id}.{svix-timestamp}.{rawBody}"
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent)
  );

  // Base64-encode our computed signature
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // The svix-signature header may contain multiple "v1,<base64>" entries separated by spaces
  // We accept the delivery if our computed signature matches ANY of them
  const signatures = svixSignature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts[0] === "v1" && parts[1] === computed) {
      return true;
    }
  }

  return false;
}
