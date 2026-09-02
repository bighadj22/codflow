import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchIdentity } from "@/lib/session";
import { resolveGate, signInRedirect, type GateState, type Identity } from "@/lib/gate";
import GateSpinner from "@/features/auth/components/GateSpinner";
import { revealGate, hideGateSpinner } from "@/lib/reveal";

const IdentityContext = createContext<Identity | null>(null);

/** RBAC-aware UI consumes identity through this hook only. */
export function useIdentity(): Identity | null {
  return useContext(IdentityContext);
}

/** True when the caller may act under the given scope (admin bypasses). */
export function canScope(identity: Identity | null, scope: string): boolean {
  if (!identity) return false;
  if (identity.role === "admin") return true;
  return identity.scopes.includes(scope);
}

/**
 * The gate every authenticated page mounts inside its root island.
 * Silent by design: at most one unlabeled skeleton while the session is
 * checked or the redirect fires — never labeled intermediate states.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("pending");
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let alive = true;
    fetchIdentity().then((id) => {
      if (!alive) return;
      setIdentity(id ?? null);
      setState(resolveGate(id));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state === "anonymous") {
      window.location.replace(signInRedirect(window.location.pathname));
    }
    if (state === "authenticated") {
      revealGate("required");
      hideGateSpinner("required");
    }
  }, [state]);

  if (state !== "authenticated") {
    return (
      <div
        data-auth-state={state}
        className="flex min-h-[60vh] items-center justify-center"
        aria-busy="true"
      >
        <GateSpinner />
      </div>
    );
  }

  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}
