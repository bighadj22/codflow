"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForgotPasswordViewProps {
  brandName: string;
}

export function ForgotPasswordView({ brandName }: ForgotPasswordViewProps) {
  const router = useRouter();
  const auth = useAuth();
  const { dir } = useLanguage();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (authError) {
        setError(authError.message || auth.forgot_password_error_generic);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Password reset error:", err);
      const errorMessage = err instanceof Error ? err.message : auth.forgot_password_error_generic;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
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
                  <h1 className="text-2xl font-black text-foreground">{auth.forgot_password_check_email_title}</h1>
                  <p className="text-sm text-muted-foreground">
                    {auth.forgot_password_check_email_message}
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/sign-in")}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <ArrowLeft className={cn("w-4 h-4", dir === "rtl" ? "ml-2" : "mr-2")} />
                  {auth.forgot_password_back_to_signin}
                </Button>
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
          <h1 className="text-3xl font-black tracking-tight text-foreground">{auth.forgot_password_title}</h1>
          <p className="text-muted-foreground text-sm">
            {auth.forgot_password_subtitle}
          </p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
              <div className="space-y-2 group/field">
                <Label htmlFor="email" className="text-[13px] font-bold text-muted-foreground">
                  {auth.forgot_password_email_label}
                </Label>
                <div className="relative">
                  <Mail className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60",
                    dir === "rtl" ? "right-3.5" : "left-3.5"
                  )} />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"
                    )}
                    placeholder={auth.email_placeholder}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-destructive leading-normal">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-black tracking-wide shadow-glow"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className={cn("w-4 h-4", dir === "rtl" ? "ml-2" : "mr-2")} />
                    {auth.forgot_password_send_button}
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/sign-in"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  {auth.forgot_password_back_to_signin}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
