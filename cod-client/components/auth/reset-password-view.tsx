"use client";

import { useState, useEffect, type FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResetPasswordViewProps {
  brandName: string;
}

function ResetPasswordForm({ brandName }: ResetPasswordViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const { dir } = useLanguage();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(auth.reset_password_error_invalid_token);
    }
  }, [token, auth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError(auth.reset_password_error_min_length);
      return;
    }

    if (password !== confirmPassword) {
      setError(auth.reset_password_error_mismatch);
      return;
    }

    if (!token) {
      setError(auth.reset_password_error_invalid_token);
      return;
    }

    setLoading(true);

    try {
      await authClient.resetPassword({
        newPassword: password,
      });
      
      setSuccess(true);
      
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/sign-in?reset=success");
      }, 2000);
    } catch (err: any) {
      if (err?.message?.includes("expired")) {
        setError(auth.reset_password_error_expired);
      } else if (err?.message?.includes("invalid")) {
        setError(auth.reset_password_error_invalid_link);
      } else {
        setError(auth.reset_password_error_generic);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-[420px] space-y-6 animate-fade-in-up">
          <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-foreground">{auth.reset_password_success_title}</h1>
                  <p className="text-sm text-muted-foreground">
                    {auth.reset_password_success_message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-background p-4">
      {/* Background Ornaments */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[420px] z-10 space-y-6 animate-fade-in-up">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">{auth.reset_password_title}</h1>
          <p className="text-muted-foreground text-sm">
            {auth.reset_password_subtitle}
          </p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
              <div className="space-y-2 group/field">
                <Label htmlFor="password" className="text-[13px] font-bold text-muted-foreground">
                  {auth.reset_password_new_label}
                </Label>
                <div className="relative">
                  <Lock className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60",
                    dir === "rtl" ? "right-3.5" : "left-3.5"
                  )} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      dir === "rtl" ? "pr-10 pl-10" : "pl-10 pr-10"
                    )}
                    placeholder={auth.reset_password_new_placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground",
                      dir === "rtl" ? "left-3" : "right-3"
                    )}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {auth.reset_password_new_hint}
                </p>
              </div>

              <div className="space-y-2 group/field">
                <Label htmlFor="confirm" className="text-[13px] font-bold text-muted-foreground">
                  {auth.reset_password_confirm_label}
                </Label>
                <div className="relative">
                  <Lock className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60",
                    dir === "rtl" ? "right-3.5" : "left-3.5"
                  )} />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      dir === "rtl" ? "pr-10 pl-10" : "pl-10 pr-10"
                    )}
                    placeholder={auth.reset_password_confirm_placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground",
                      dir === "rtl" ? "left-3" : "right-3"
                    )}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-destructive leading-normal">{error}</p>
                    {(error.includes(auth.reset_password_error_expired) || error.includes(auth.reset_password_error_invalid_link)) && (
                      <Link
                        href="/forgot-password"
                        className="text-xs text-destructive underline mt-1 inline-block"
                      >
                        {auth.reset_password_request_new_link}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full h-12 rounded-xl text-sm font-black tracking-wide shadow-glow"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Lock className={cn("w-4 h-4", dir === "rtl" ? "ml-2" : "mr-2")} />
                    {auth.reset_password_button}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ResetPasswordView({ brandName }: ResetPasswordViewProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordForm brandName={brandName} />
    </Suspense>
  );
}
