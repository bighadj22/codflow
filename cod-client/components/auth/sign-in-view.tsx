"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useAuth, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Lock, Mail, Truck, ShieldCheck, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignInViewProps {
  brandName:    string;
  brandLogoUrl: string | null;
}

export function SignInView({ brandName, brandLogoUrl }: SignInViewProps) {
  const router = useRouter();
  const auth   = useAuth();
  const common = useCommon();
  const { dir } = useLanguage();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });
      if (authError) {
        setError(auth.invalid_credentials ?? authError.message ?? "بيانات الدخول غير صحيحة");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError(auth.unexpected_error ?? "حدث خطأ غير متوقع. يرجى المحاولة مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLinkRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMagicLinkLoading(true);

    try {
      const { data, error: authError } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      });

      if (authError) {
        setError(authError.message || auth.magic_link_error_generic);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      console.error("Magic link error:", err);
      const errorMessage = err instanceof Error ? err.message : auth.magic_link_error_generic;
      setError(errorMessage);
    } finally {
      setMagicLinkLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-background p-4 overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-noise opacity-[0.03]" />
      </div>

      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[420px] z-10 space-y-8 animate-fade-in-up">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-primary/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-primary shadow-xl shadow-primary/20 ring-1 ring-white/10 overflow-hidden">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Truck className="w-8 h-8 text-primary-foreground animate-pulse" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text">
              {brandName}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              {auth.subtitle}
            </p>
          </div>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl overflow-visible">
          <CardContent className="pt-6">
            {magicLinkSent ? (
              <div className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-foreground">{auth.magic_link_check_email_title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {auth.magic_link_check_email_message.replace('{email}', email)}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setMagicLinkSent(false);
                    setMagicLinkMode(false);
                    setEmail("");
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  {auth.magic_link_back_to_signin}
                </Button>
              </div>
            ) : magicLinkMode ? (
              <form onSubmit={handleMagicLinkRequest} className="space-y-4" dir={dir}>
                <div className="space-y-2 group/field">
                  <Label htmlFor="magic-email" className="text-[13px] font-bold text-muted-foreground">
                    {auth.forgot_password_email_label}
                  </Label>
                  <div className="relative">
                    <Mail className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60",
                      dir === "rtl" ? "right-3.5" : "left-3.5"
                    )} />
                    <Input
                      id="magic-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(
                        "transition-all duration-300",
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
                  disabled={magicLinkLoading}
                  className="w-full h-12 rounded-xl text-sm font-black tracking-wide shadow-glow"
                >
                  {magicLinkLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {auth.magic_link_send_button}
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMagicLinkMode(false);
                      setError(null);
                    }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {auth.magic_link_back_to_password}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
                <div className="space-y-2 group/field">
                  <Label htmlFor="email" className="text-[13px] font-bold text-muted-foreground transition-colors group-focus-within/field:text-primary">
                    {auth.email}
                  </Label>
                  <div className="relative">
                    <Mail className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 transition-colors pointer-events-none",
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
                        "transition-all duration-300",
                        dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"
                      )}
                      placeholder={auth.email_placeholder}
                    />
                  </div>
                </div>

                <div className="space-y-2 group/field">
                  <Label htmlFor="password" className="text-[13px] font-bold text-muted-foreground transition-colors group-focus-within/field:text-primary">
                    {auth.password}
                  </Label>
                  <div className="relative">
                    <Lock className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 transition-colors pointer-events-none",
                      dir === "rtl" ? "right-3.5" : "left-3.5"
                    )} />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        "transition-all duration-300",
                        dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"
                      )}
                      placeholder={auth.password_placeholder}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      {auth.forgot_password}
                    </Link>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-3 animate-shake">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-destructive leading-normal">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-sm font-black tracking-wide shadow-glow transition-all active:scale-[0.98] group"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      {auth.sign_in}
                    </>
                  )}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-bold">
                      {auth.or}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMagicLinkMode(true);
                    setError(null);
                  }}
                  className="w-full h-12 rounded-xl text-sm font-black tracking-wide"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {auth.magic_link_button}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
