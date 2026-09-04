/**
 * Search helpers shared by list queries.
 *
 * D1 caps a LIKE/GLOB pattern at 50 bytes (verified: longer patterns fail
 * with "LIKE or GLOB pattern too complex"). Dashboard searches wrap user
 * input as `%term%`, so the term itself must stay ≤ 48 bytes. Truncation is
 * UTF-8-boundary-safe — a cut mid multi-byte character would produce an
 * invalid pattern string.
 */

const LIKE_PATTERN_MAX_BYTES = 50;
const WILDCARD_BYTES = 2;

export function safeLikeTerm(term: string): string {
  const maxTermBytes = LIKE_PATTERN_MAX_BYTES - WILDCARD_BYTES;
  const encoder = new TextEncoder();
  if (encoder.encode(term).length <= maxTermBytes) return term;

  let out = "";
  let bytes = 0;
  for (const ch of term) {
    const chBytes = encoder.encode(ch).length;
    if (bytes + chBytes > maxTermBytes) break;
    out += ch;
    bytes += chBytes;
  }
  return out;
}
