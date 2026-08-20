"use client";

/**
 * ConsentView — the approve/deny UI for the OAuth 2.1 consent page.
 *
 * Three-bucket model for the scopes (the "why" behind MCP-19):
 *
 *   • identityScopes  — OIDC standard (openid/profile/email/offline_access).
 *     Required for the OAuth flow to work AT ALL. Shown read-only so the
 *     user knows we're reading their identity, but there's no checkbox
 *     because unchecking would just break the sign-in.
 *
 *   • grantableScopes — app scopes Claude asked for AND the user holds.
 *     Rendered as checkboxes, default checked. User can deselect to
 *     narrow what Claude gets. The server (Better Auth `/oauth2/consent`)
 *     accepts a `scope` param that narrows the grant, so anything the
 *     user unchecks is actually dropped from the issued token — not just
 *     a cosmetic UI lie.
 *
 *   • (hidden scopes) — app scopes Claude asked for but the user does NOT
 *     hold. We don't show them at all. Surfacing a `customers:delete`
 *     checkbox to a staff member who only has `orders:read` would be
 *     confusing and would mint a token with claims the user cannot back
 *     up anyway. `page.tsx` filters those out before we even reach this
 *     component.
 *
 * Admin special case (A1): instead of rendering 40 checkboxes, admins see
 * a single "Full access" summary card with an expandable "See detailed
 * permissions" section holding the per-scope checkboxes (default checked).
 * Admins can still deselect if they want, but the common path is one click.
 *
 * Empty-state edge: a user who has ZERO grantable scopes sees a friendly
 * "no permissions to share" panel with Deny as the only action. They can't
 * grant meaningful access anyway, and this prevents minting a useless
 * identity-only token.
 *
 * Everything else (glass-card, RTL, i18n, Arabic copy, LanguageSwitcher,
 * parity with /sign-in) stays exactly as MCP-6 shipped.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import {
  Truck, ShieldCheck, AlertCircle, Loader2, ExternalLink, Bot, CheckCircle2,
  Lock, ChevronDown, ChevronUp, CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsentViewProps {
  brandName:      string;
  brandLogoUrl:   string | null;
  clientName:     string | null;
  clientIconUrl:  string | null;
  clientHomepage: string | null;
  userEmail:      string;
  /** OIDC identity scopes (openid/profile/email/offline_access). Always granted, shown read-only. */
  identityScopes:  string[];
  /** App scopes the user HAS. Rendered as checkboxes. Order matters for stable UI. */
  grantableScopes: string[];
  /** True = admin; we show a condensed "Full access" card instead of a long checkbox list. */
  isAdmin:         boolean;
  /**
   * Raw query string (NOT including leading `?`) forwarded by Better Auth
   * from the original /oauth2/authorize call. Must be passed back verbatim
   * to /oauth2/consent so the plugin can resume the flow on the same state.
   */
  oauthQuery: string;
}

export function ConsentView({
  brandName,
  brandLogoUrl,
  clientName,
  clientIconUrl,
  clientHomepage,
  userEmail,
  identityScopes,
  grantableScopes,
  isAdmin,
  oauthQuery,
}: ConsentViewProps) {
  const router = useRouter();
  const auth = useAuth();
  const t = auth.consent;
  const { dir } = useLanguage();

  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default: all grantable scopes checked. Checked status is tracked as a Set
  // so toggling is O(1) and we avoid re-render cascades on a 40-item list.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(grantableScopes));
  // Admin UI starts collapsed — the "Full access" card is the default CTA;
  // detailed checkboxes only appear if the admin wants to deselect something.
  const [adminExpanded, setAdminExpanded] = useState(false);

  const displayAppName = clientName?.trim() || "App";
  const hasGrantable = grantableScopes.length > 0;

  const toggle = useCallback((scope: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const interp = useCallback(
    (template: string, values: Record<string, string>) =>
      template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`),
    [],
  );

  const labelForScope = useCallback(
    (scope: string) => (t?.scopes as Record<string, string> | undefined)?.[scope]
      ?? interp(t?.scope_unknown ?? "{scope}", { scope }),
    [t, interp],
  );

  async function submit(accept: boolean) {
    setPending(accept ? "approve" : "deny");
    setError(null);

    try {
      // Build the scope payload for Better Auth.
      //   • identity scopes always included (OAuth flow needs them)
      //   • deny: scope param omitted (the plugin ignores it when accept=false)
      //   • approve: identity + user's selected grantable subset
      const scopePayload = accept
        ? [...identityScopes, ...grantableScopes.filter((s) => selected.has(s))].join(" ")
        : undefined;

      // Better Auth resource-client-side API. The plugin POSTs to
      // /api/auth/oauth2/consent internally and returns { redirect_uri }.
      const { data, error: authError } = await (authClient as unknown as {
        oauth2: {
          consent: (args: {
            accept: boolean;
            scope?: string;
            oauth_query?: string;
          }) => Promise<{
            data?: { redirect_uri?: string };
            error?: { message?: string } | null;
          }>;
        };
      }).oauth2.consent({ accept, scope: scopePayload, oauth_query: oauthQuery });

      if (authError) {
        setError(authError.message ?? (t?.error_message ?? "Error"));
        setPending(null);
        return;
      }

      const redirectUri = data?.redirect_uri;
      if (redirectUri) {
        // Hard navigation (not router.push) — the redirect target is the
        // MCP client's registered redirect_uri (often a different origin
        // or a deep link like `mcp-remote://…`).
        window.location.assign(redirectUri);
        return;
      }

      // No redirect_uri and no error → user denied (plugin signalled the
      // upstream client through the OAuth error flow separately). Show
      // the friendly "you denied" terminal state.
      setPending(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (t?.error_message ?? "Error");
      setError(msg);
      setPending(null);
    }
  }

  // Count string shown on the main Allow button: "Allow (3 permissions)".
  // Defensive: if zero selected, we disable the button.
  const selectedCount = useMemo(
    () => grantableScopes.filter((s) => selected.has(s)).length,
    [grantableScopes, selected],
  );

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-background p-4 overflow-hidden">
      {/* Ambient background (same pattern as /sign-in) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] start-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] end-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-noise opacity-[0.03]" />
      </div>

      <div className="absolute top-6 end-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[480px] z-10 space-y-6 animate-fade-in-up">
        {/* Brand crown — matches sign-in visual weight */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-primary/20 rounded-3xl blur opacity-75 transition duration-500" />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center bg-primary shadow-xl shadow-primary/20 ring-1 ring-white/10 overflow-hidden">
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt={brandName} className="w-full h-full object-cover" />
              ) : (
                <Truck className="w-7 h-7 text-primary-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t?.title ?? "Authorize Access"}
            </h1>
            <p className="text-sm text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">
              {interp(t?.subtitle ?? "{app} wants to connect to {brand}", { app: displayAppName, brand: brandName })}
            </p>
          </div>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl overflow-visible">
          <CardContent className="p-5 sm:p-6 space-y-5" dir={dir}>
            {/* Requesting app identity ribbon */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0 shadow-sm">
                {clientIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clientIconUrl} alt={displayAppName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Bot className="w-5 h-5 text-muted-foreground/70" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground/90 truncate">{displayAppName}</p>
                {clientHomepage && (
                  <a
                    href={clientHomepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/60 hover:text-primary transition-colors mt-0.5"
                  >
                    {new URL(clientHomepage).hostname}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Who-you-are line */}
            <p className="text-[13px] text-muted-foreground/80 font-semibold leading-relaxed">
              {interp(t?.description ?? "Signed in as {email}", { email: userEmail })}
            </p>

            {/* Identity scopes — compact, not togglable. Only show if non-empty. */}
            {identityScopes.length > 0 && (
              <div className="rounded-2xl bg-muted/20 border border-border/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Lock className="w-3 h-3 text-muted-foreground/60" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {t?.identity_heading ?? "Identity"}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {identityScopes.map((scope) => (
                    <li
                      key={scope}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/80 px-2 py-0.5 rounded-md bg-background/60 border border-border/30"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-muted-foreground/50" />
                      {labelForScope(scope)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Permissions — three modes: empty / admin / staff */}
            {!hasGrantable ? (
              /* Zero grantable scopes → friendly stop. Deny is the only action. */
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                  {t?.no_permissions ?? "You don't have any permissions to share with this app. Ask your admin to grant you access first."}
                </p>
              </div>
            ) : isAdmin ? (
              /* Admin — "Full access" summary card + expandable checkboxes */
              <div className="space-y-2">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                  {t?.permissions_heading ?? "This app will be able to:"}
                </h2>

                {/* Summary card with the big "Full access" message */}
                <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-foreground/90">
                      {t?.admin_full_access_title ?? "Full access (admin)"}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground/60 leading-relaxed mt-0.5">
                      {t?.admin_full_access_description ?? "This app can do everything you can do."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAdminExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/70 hover:text-foreground transition-colors"
                  aria-expanded={adminExpanded}
                >
                  {adminExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {adminExpanded
                    ? (t?.admin_hide_details ?? "Hide detailed permissions")
                    : (t?.admin_show_details ?? "See detailed permissions")}
                </button>

                {adminExpanded && (
                  <ScopeCheckboxList
                    scopes={grantableScopes}
                    selected={selected}
                    onToggle={toggle}
                    labelFor={labelForScope}
                  />
                )}
              </div>
            ) : (
              /* Staff — straight checkbox list of what they actually hold */
              <div className="space-y-2">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                  {t?.permissions_heading ?? "This app will be able to:"}
                </h2>
                <ScopeCheckboxList
                  scopes={grantableScopes}
                  selected={selected}
                  onToggle={toggle}
                  labelFor={labelForScope}
                />
              </div>
            )}

            {/* AI-agent HITL reassurance */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
              <Bot className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                {t?.warning_mcp ?? "AI agents act on your behalf; sensitive actions will prompt for confirmation."}
              </p>
            </div>

            {/* Revoke hint — sets expectation before they click Allow */}
            <p className="text-[11px] font-semibold text-muted-foreground/60 leading-relaxed">
              {t?.revoke_hint ?? "You can revoke this access anytime in Settings."}
            </p>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-destructive leading-normal">{error}</p>
              </div>
            )}

            {/* Action buttons — stacked on mobile, row on desktop.
                Allow disabled when no grantable scopes OR when user unchecked everything. */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={pending !== null}
                onClick={() => submit(false)}
                className="flex-1 h-12 rounded-xl text-sm font-black tracking-wide"
              >
                {pending === "deny" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t?.deny ?? "Deny"
                )}
              </Button>
              {hasGrantable && (
                <Button
                  type="button"
                  disabled={pending !== null || selectedCount === 0}
                  onClick={() => submit(true)}
                  className="flex-1 h-12 rounded-xl text-sm font-black tracking-wide shadow-glow group"
                >
                  {pending === "approve" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 me-2" />
                      {t?.approve ?? "Allow"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ScopeCheckboxList ──────────────────────────────────────────────────────
// Small presentational component: one checkbox row per scope. Split from the
// main view so the admin and staff branches share identical markup.

function ScopeCheckboxList({
  scopes, selected, onToggle, labelFor,
}: {
  scopes:   string[];
  selected: Set<string>;
  onToggle: (scope: string) => void;
  labelFor: (scope: string) => string;
}) {
  return (
    <ul className="space-y-1.5 max-h-[240px] overflow-y-auto pe-1 -me-1">
      {scopes.map((scope) => {
        const checked = selected.has(scope);
        return (
          <li key={scope}>
            <label
              className={cn(
                "flex items-start gap-2.5 px-2.5 py-2 rounded-xl border cursor-pointer transition-colors",
                checked
                  ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                  : "bg-background/50 border-border/30 hover:bg-muted/40",
              )}
            >
              {/* Custom checkbox — keeps the look on brand; native input kept
                  for accessibility (screen readers, keyboard nav). */}
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onToggle(scope)}
                aria-label={labelFor(scope)}
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-colors",
                  checked
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-background border-border/50",
                )}
              >
                {checked && <CircleCheck className="w-2.5 h-2.5" />}
              </span>
              <span className="text-[13px] font-semibold text-foreground/85 leading-snug select-none">
                {labelFor(scope)}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
