// Client-side identity + session-JWT source. The ONLY module that talks to
// /api/auth/* for session state (api.ts consumes the token from here).
import type { Identity } from "./gate";

// Same-origin by definition: the Astro worker hosts /api/auth/* itself and
// owns the session cookie. Never target another domain here — cross-origin
// calls drop cookies and die on CORS (the "stuck Checking session" bug).
let cachedJwt: string | null = null;
let inflight: Promise<Identity | null> | null = null;

/**
 * Fetch the current identity once per page. Resolves:
 *   undefined → check still in flight (never returned by callers directly)
 *   null      → no valid session
 *   Identity  → { user, role, scopes }
 * Captures the short-lived JWT (set-auth-jwt) issued alongside the response.
 */
export function fetchIdentity(): Promise<Identity | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("/api/auth/get-session", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const jwt = res.headers.get("set-auth-jwt");
    if (jwt) cachedJwt = jwt;
    const body = (await res.json()) as
      | {
          user?: { id: string; name?: string | null; email: string; role?: string; language?: string } | null;
          scopes?: string[];
        }
      | null;
    if (!body?.user) return null;
    return {
      user: {
        id: body.user.id,
        name: body.user.name ?? null,
        email: body.user.email,
        language: body.user.language,
      },
      role: body.user.role === "admin" ? "admin" : "staff",
      scopes: body.scopes ?? [],
    };
  })();
  return inflight;
}

/** Current JWT if already fetched; refreshes via fetchIdentity when absent. */
export async function currentJwt(): Promise<string | null> {
  if (cachedJwt) return cachedJwt;
  await fetchIdentity();
  return cachedJwt;
}

/** Force a new session response after an API rejects the cached token. */
export async function refreshJwt(): Promise<string | null> {
  cachedJwt = null;
  inflight = null;
  await fetchIdentity();
  return cachedJwt;
}
