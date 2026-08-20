/**
 * OAuth 2.1 Consent page — the only user-facing surface of the MCP auth flow.
 *
 * Routed to by `@better-auth/oauth-provider` from `/api/auth/oauth2/authorize`
 * when a dynamic client (e.g. Claude Desktop) asks for new scopes the user
 * hasn't granted before. The plugin redirects to `/consent?...oauth query...`
 * carrying the pending authorization request as the raw search string.
 *
 * This server component:
 *   • Requires an existing session (redirects to /sign-in if absent — the
 *     OAuth flow will bring the user right back here after they authenticate).
 *   • Looks up the OAuth client by `client_id` so we can show its display
 *     name, logo, and (if present) the homepage URI as "learn more".
 *   • Parses the `scope` param and hands the UI a filtered, labelled list.
 *   • Passes the raw query string to the client component so it can POST
 *     back to /api/auth/oauth2/consent exactly as the plugin expects.
 *
 * The actual approve/deny buttons live in ConsentView (client component) so
 * the user-facing experience matches /sign-in: glass-card, Cairo font, RTL,
 * full i18n via the auth.consent namespace.
 */

import React from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

import { initAuth, getUser, getUserScopes } from "@/lib/auth";
import { getDashboardBrand } from "@/lib/brand";
import { getDb } from "@/db";
import { oauthClients } from "@/db/schema";
import { ConsentView } from "@/components/auth/consent-view";

export const dynamic = "force-dynamic";

interface ConsentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;

  // ── 1. Session gate ───────────────────────────────────────────────────────
  const user = await getUser();
  if (!user) {
    // Preserve the original query string so the sign-in flow can redirect
    // the user back here afterwards. `/sign-in` doesn't honour
    // `callbackURL=/consent?...` today — that's a follow-up (MCP-6.1), for
    // now the user signs in and Better Auth's authorize endpoint will
    // re-issue the consent redirect on the next authorize attempt.
    redirect("/sign-in");
  }

  // ── 2. Parse the OAuth authz query that the plugin forwarded to us ────────
  // Better Auth redirects with the original /oauth2/authorize query strung
  // verbatim — we need to return it wholesale to /oauth2/consent. URLSearchParams
  // reconstructs a canonical string so the client can POST it back even if
  // Next normalised/sorted anything on its side.
  const normalisedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") normalisedParams.set(key, value);
    else if (Array.isArray(value) && value.length > 0) normalisedParams.set(key, value[0]!);
  }
  const oauthQuery = normalisedParams.toString();

  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  const requestedScopeString =
    typeof params.scope === "string" ? params.scope :
    Array.isArray(params.scope) ? (params.scope[0] ?? "") : "";
  const requestedScopes = requestedScopeString.split(/\s+/).filter(Boolean);

  // ── 2b. Filter requested scopes by what THIS user can actually grant ──────
  //
  // Why this matters: MCP clients (Claude Desktop, Claude.ai, ChatGPT) ask for
  // the full set of scopes the server advertises — they don't know which
  // subset any given user actually has in `user_scopes`. If we showed the full
  // list here, a staff member with only `orders:read` would be asked to
  // "approve" things like `customers:delete` — a permission they don't have.
  // The Better Auth token endpoint would then happily mint them a token with
  // `customers:delete` in its scope claim, and while `buildToolsForUser`
  // correctly blocks the delete tools at the MCP layer, the token itself
  // would lie about what permissions the user has. That's a privilege
  // confusion smell.
  //
  // Fix: intersect the requested scopes with the user's real permissions, and
  // POST only that subset back via `/oauth2/consent`. Better Auth's endpoint
  // accepts `scope: string` to narrow the grant, so downstream tokens carry
  // the correct, honest claims.
  //
  // Three buckets, each handled differently in the UI:
  //   identityScopes  — OIDC standard scopes that are always granted and NOT
  //                     user-toggleable (without them the OAuth flow breaks).
  //   grantableScopes — app scopes the user holds, shown as checkboxes
  //                     (default checked) so they can deselect individual ones.
  //   hiddenScopes    — app scopes Claude asked for that the user DOESN'T have.
  //                     We silently drop these: we don't need to surface them,
  //                     and surfacing would confuse the shop owner.
  //
  // Admin bypass: admins (role=admin OR userScopes contains "*") can grant
  // any requested app scope, matching `hasPermission()` semantics in
  // cod-shared/rbac/utils.ts.
  const OIDC_SCOPES = new Set(["openid", "profile", "email", "offline_access"]);
  const userScopes = await getUserScopes();
  const isAdmin = user.role === "admin" || userScopes.includes("*");

  const identityScopes  = requestedScopes.filter((s) => OIDC_SCOPES.has(s));
  const appRequested    = requestedScopes.filter((s) => !OIDC_SCOPES.has(s));
  const grantableScopes = isAdmin
    ? appRequested
    : appRequested.filter((s) => userScopes.includes(s));

  // ── 3. Look up the OAuth client record for display (name, logo, uri) ──────
  // If the client_id is missing or unknown we still render — the user sees
  // a generic "An application wants to connect" header and can deny safely.
  let client: { name: string | null; icon: string | null; uri: string | null } | null = null;
  if (clientId) {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const row = await db
      .select({
        name: oauthClients.name,
        icon: oauthClients.icon,
        uri:  oauthClients.uri,
      })
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .get();
    if (row) client = row;
  }

  // ── 4. Ensure auth instance is initialised (plugin side-effects on first call) ──
  await initAuth();
  await headers(); // triggers cookie read in case later logic needs it

  const brand = await getDashboardBrand();

  return (
    <div style={{ "--primary": brand.primaryColor, "--primary-foreground": "#ffffff" } as React.CSSProperties}>
      <ConsentView
        brandName={brand.brandName}
        brandLogoUrl={brand.logoUrl}
        clientName={client?.name ?? null}
        clientIconUrl={client?.icon ?? null}
        clientHomepage={client?.uri ?? null}
        userEmail={user.email}
        identityScopes={identityScopes}
        grantableScopes={grantableScopes}
        isAdmin={isAdmin}
        oauthQuery={oauthQuery}
      />
    </div>
  );
}
