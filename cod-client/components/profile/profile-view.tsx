"use client";

import { useState } from "react";
import { Lock, User, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile, useCommon } from "@/lib/translations";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth";

interface ProfileViewProps {
  user: AuthUser;
}

export function ProfileView({ user }: ProfileViewProps) {
  const t = useProfile();
  const common = useCommon();
  const [loading, setLoading] = useState(false);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleRequestPasswordReset() {
    setLoading(true);
    try {
      const { data, error: authError } = await authClient.requestPasswordReset({
        email: user.email,
        redirectTo: "/reset-password",
      });

      if (authError) {
        toast.error(authError.message || "Unable to send email. Please try again later.");
      } else {
        toast.success("Password reset email sent. Please check your inbox.");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to send email. Please try again later.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* ── Profile Info Card ────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 border-b border-border/10 bg-muted/5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <User size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight font-display uppercase">
              {t.info.title}
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              {t.info.subtitle}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary blur-xl opacity-20" />
              <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-[22px] sm:text-[28px] font-black text-primary-foreground shadow-lg shadow-primary/20">
                {initials}
              </div>
              <div className="absolute -bottom-1 -end-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full z-20 shadow-sm" />
            </div>

            {/* Fields */}
            <div className="flex-1 w-full space-y-4">
              <Field icon={<User size={14} />} label={t.info.name} value={user.name} />
              <Field icon={<Mail size={14} />} label={t.info.email} value={user.email} dir="ltr" />
              <div className="flex flex-wrap gap-3">
                <BadgeField
                  label={t.info.role}
                  value={(common.roles as Record<string, string>)[user.role] ?? user.role}
                  color="primary"
                />
                <BadgeField
                  label={t.info.status}
                  value={user.status === "active"
                    ? (common.statuses?.active ?? "Active")
                    : (common.statuses?.inactive ?? "Inactive")}
                  color={user.status === "active" ? "green" : "rose"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Security Card ─────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 border-b border-border/10 bg-muted/5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <Lock size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight font-display uppercase">
              Security
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              Password Management
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          <p className="text-sm text-muted-foreground mb-4">
            To change your password, we'll send you a secure reset link via email.
          </p>
          <Button
            onClick={handleRequestPasswordReset}
            disabled={loading}
            variant="outline"
            className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest"
          >
            <Mail size={14} className="me-2" />
            {loading ? "Sending..." : "Reset Password via Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  icon, label, value, dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr";
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5">
        <span className="text-primary/40">{icon}</span>
        {label}
      </Label>
      <p
        className="text-sm font-bold text-foreground bg-muted/30 border border-border/30 rounded-xl px-3 py-2.5 truncate"
        dir={dir}
      >
        {value}
      </p>
    </div>
  );
}

function BadgeField({
  label, value, color,
}: {
  label: string;
  value: string;
  color: "primary" | "green" | "rose";
}) {
  const colorCls = {
    primary: "bg-primary/10 text-primary border-primary/20",
    green:   "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rose:    "bg-rose-500/10 text-rose-600 border-rose-500/20",
  }[color];

  return (
    <div className="space-y-1">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
        {label}
      </Label>
      <span className={cn(
        "inline-flex items-center px-3 py-1 rounded-xl border text-[11px] font-black uppercase tracking-widest",
        colorCls
      )}>
        {value}
      </span>
    </div>
  );
}
