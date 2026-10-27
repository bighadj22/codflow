/**
 * What a Meta access token looks like, checked before it is stored.
 *
 * Meta validates the token when an event is sent, not when it is saved. An
 * arbitrary placeholder ("AAAA…") is therefore accepted by the settings form,
 * every Conversions API call then fails with "Cannot parse access token", and
 * the only signal is the event log. This is the cheap structural guard: a
 * prefix and a length, not a permission check.
 *
 * Two formats are legitimate:
 *   - user / system-user / pixel tokens, which start with EAA and are long;
 *   - app access tokens, written "appId|appSecret".
 */

const META_USER_TOKEN = /^EAA[A-Za-z0-9+/=_.-]{30,}$/;
const META_APP_TOKEN = /^[0-9]{6,20}\|[A-Fa-f0-9]{16,}$/;

export function isMetaAccessToken(value: string): boolean {
  // `$` also matches before a trailing newline, so whitespace is rejected
  // explicitly rather than left to the pattern.
  if (value !== value.trim()) return false;
  return META_USER_TOKEN.test(value) || META_APP_TOKEN.test(value);
}
