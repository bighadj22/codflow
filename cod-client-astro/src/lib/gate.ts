// Pure gating logic — the only place gate decisions live. Tested directly.
// Runtime flow: prerendered shells are public files; this decides what the
// browser does once it checks the session (see Identity in CONTEXT.md).

export interface Identity {
  user: { id: string; name?: string | null; email: string };
  role: "admin" | "staff";
  scopes: string[];
}

export type GateState = "pending" | "anonymous" | "authenticated";

/** undefined = still checking · null = checked, no session · object = authed */
export function resolveGate(identity: Identity | null | undefined): GateState {
  if (identity === undefined) return "pending";
  if (identity === null) return "anonymous";
  return "authenticated";
}

/** Where the browser should go when a gated page finds no session. */
export function signInRedirect(currentPath: string): string {
  const path = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  return `/sign-in?next=${encodeURIComponent(path)}`;
}

/** Where sign-in should send an already-authenticated visitor. */
export function postSignInTarget(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return nextParam;
  }
  return "/dashboard";
}
