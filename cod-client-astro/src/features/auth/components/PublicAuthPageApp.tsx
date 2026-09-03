import { useEffect, useState, type ReactNode } from "react";
import { fetchIdentity } from "@/lib/session";
import { revealGate, hideGateSpinner } from "@/lib/reveal";
import GateSpinner from "@/features/auth/components/GateSpinner";

/**
 * Reverse gate for public auth pages (forgot/reset password).
 *
 * The prerendered shell ships the form [hidden] behind a spinner; this
 * reveals it once the session check settles — for anonymous AND
 * authenticated visitors alike (a signed-in member clicking their reset
 * email link must still see the form, so no redirect-to-dashboard here).
 * Silent while checking — no labeled intermediate states.
 */
export function PublicAuthPageApp({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchIdentity().then(() => {
      if (!alive) return;
      revealGate("reverse");
      hideGateSpinner("reverse");
      setRevealed(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!revealed) {
    return <GateSpinner />;
  }
  return <>{children}</>;
}
