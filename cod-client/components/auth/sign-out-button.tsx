"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/translations";

interface Props {
  onSignOut: () => Promise<void>;
}

export function SignOutButton({ onSignOut }: Props) {
  const t = useAuth();
  
  return (
    <button
      onClick={() => onSignOut()}
      className="text-muted-foreground hover:text-sidebar-foreground transition-colors"
      aria-label={t.sign_out_aria}
    >
      <LogOut size={14} />
    </button>
  );
}
