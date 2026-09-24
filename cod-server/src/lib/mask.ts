/**
 * How a stored credential is shown back to the merchant.
 *
 * Every integration key in CodFlow is write-only: the dashboard sends it once
 * and afterwards receives only enough to recognise which key is stored. Four
 * of those — the Meta access token, the dzverify key, the store API key, the
 * Turnstile secret — plus the per-landing-page access token all go through
 * here, so "what a masked key looks like" is one decision rather than five
 * copies drifting apart.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}
