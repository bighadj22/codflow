"use client";

import { useAuth } from "@/lib/translations";

export function SignInButton({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const t = useAuth();
  
  return (
    <button
      onClick={() => onSignIn()}
      className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
    >
      {t.sign_in}
    </button>
  );
}
