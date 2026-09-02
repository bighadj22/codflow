import { useEffect, useState } from "react";
import { fetchIdentity } from "@/lib/session";
import { postSignInTarget, resolveGate } from "@/lib/gate";
import { revealGate, hideGateSpinner } from "@/lib/reveal";
import { SignInForm } from "@/features/auth/components/SignInForm";
import GateSpinner from "@/features/auth/components/GateSpinner";

/**
 * Reverse gate: authenticated visitors go straight to the dashboard.
 * Silent while checking — no labeled intermediate states.
 */
export function SignInPageApp() {
  const [state, setState] = useState<"pending" | "anonymous">("pending");
  const next = new URLSearchParams(window.location.search).get("next");

  useEffect(() => {
    let alive = true;
    fetchIdentity().then((id) => {
      if (!alive) return;
      if (resolveGate(id) === "authenticated") {
        window.location.replace(postSignInTarget(next));
      } else {
        setState("anonymous");
        revealGate("reverse");
        hideGateSpinner("reverse");
      }
    });
    return () => {
      alive = false;
    };
  }, [next]);

  if (state === "pending") {
    return (
      <GateSpinner />
    );
  }
  return <SignInForm next={next} />;
}
