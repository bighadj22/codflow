import type { Context } from "hono";
import type { AppContext } from "@/types";
import {
  AuthorizationError,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, userScopes } from "@/db/schema";
import {
  verifyLoginTicket,
  LOGIN_TICKET_MIN_KEY_BYTES,
  LOGIN_TICKET_TTL_SECONDS,
} from "../../../cod-shared/lib/login-ticket";

type Lang = "ar" | "fr" | "en";

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

export function consentLang(acceptLanguage: string | undefined): Lang {
  const header = acceptLanguage ?? "";
  if (/^fr\b/i.test(header)) return "fr";
  if (/^en\b/i.test(header)) return "en";
  return "ar";
}

/**
 * The scopes this user may actually grant for an authorization request.
 * Admins can grant any requested scope; everyone else only the scopes they
 * hold (or a wildcard). The authorization server never grants scopes the user
 * does not possess — the consent UI is presentation, this is the boundary.
 */
export function computeGrantableScopes(
  role: "admin" | "staff",
  userScopes: readonly string[],
  requestedScopes: readonly string[],
): string[] {
  if (role === "admin") return [...requestedScopes];
  return requestedScopes.filter(
    (scope) => userScopes.includes(scope) || userScopes.includes("*"),
  );
}

export function buildSignInRedirectUrl(dashboardAuthBase: string, authorizeUrl: string): string {
  const relay = new URL("/mcp/oauth/login", dashboardAuthBase);
  relay.searchParams.set("next", authorizeUrl);
  const signIn = new URL("/sign-in", dashboardAuthBase);
  signIn.searchParams.set("next", `${relay.pathname}${relay.search}`);
  return signIn.toString();
}

export function buildFormAction(authorizeUrl: string): string {
  const url = new URL(authorizeUrl);
  url.searchParams.delete("ticket");
  return `${url.pathname}${url.search}`;
}

export function buildDenyRedirectUrl(oauthRequest: AuthRequest): string {
  const redirect = new URL(oauthRequest.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  redirect.searchParams.set("error_description", "The user denied the request.");
  if (oauthRequest.state) redirect.searchParams.set("state", oauthRequest.state);
  if (oauthRequest.issuer) redirect.searchParams.set("iss", oauthRequest.issuer);
  return redirect.toString();
}

export function oauthErrorRedirectUrl(error: AuthorizationError): string | null {
  if (!error.redirectUri) return null;
  const redirect = new URL(error.redirectUri);
  redirect.searchParams.set("error", error.code);
  redirect.searchParams.set("error_description", error.description);
  if (error.state) redirect.searchParams.set("state", error.state);
  if (error.issuer) redirect.searchParams.set("iss", error.issuer);
  return redirect.toString();
}

// ─── CSRF (double-submit, `__Host-` cookie) ───────────────────────────────────

const CSRF_COOKIE = "__Host-MCP_CSRF";
const CSRF_MAX_AGE_SECONDS = 600;

export function csrfSetCookie(token: string): string {
  return `${CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${CSRF_MAX_AGE_SECONDS}`;
}

export function csrfClearCookie(): string {
  return `${CSRF_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

export function csrfCookieValue(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${CSRF_COOKIE}=`)) return trimmed.slice(CSRF_COOKIE.length + 1);
  }
  return null;
}

export function csrfTokensMatch(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Consent + error pages (server-rendered, no external assets) ─────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

interface ConsentCopy {
  title: string;
  clientLabel: string;
  scopesLabel: string;
  approve: string;
  deny: string;
  noPermissions: string;
  noPermissionsHint: string;
}

function consentCopy(lang: Lang): ConsentCopy {
  if (lang === "fr") {
    return {
      title: "Autoriser l'accès à CodFlow",
      clientLabel: "Cette application demande l'accès à votre espace :",
      scopesLabel: "Autorisations",
      approve: "Autoriser",
      deny: "Refuser",
      noPermissions: "Aucune autorisation à accorder",
      noPermissionsHint: "Vous ne disposez d'aucune des autorisations demandées pour cette application.",
    };
  }
  if (lang === "en") {
    return {
      title: "Authorize access to CodFlow",
      clientLabel: "This application is requesting access to your workspace:",
      scopesLabel: "Permissions",
      approve: "Authorize",
      deny: "Deny",
      noPermissions: "Nothing to authorize",
      noPermissionsHint: "You do not hold any of the permissions this application requested.",
    };
  }
  return {
    title: "السماح بالوصول إلى CodFlow",
    clientLabel: "يطلب هذا التطبيق الوصول إلى مساحة عملك:",
    scopesLabel: "الصلاحيات",
    approve: "السماح",
    deny: "رفض",
    noPermissions: "لا توجد صلاحيات لمنحها",
    noPermissionsHint: "لا تملك أيًّا من الصلاحيات التي طلبها هذا التطبيق.",
  };
}

export interface ConsentView {
  clientName: string | null;
  grantableScopes: string[];
  formAction: string;
  csrfToken: string;
  ticket: string;
  denyUrl: string;
  lang: Lang;
}

export function renderConsentPage(view: ConsentView): string {
  const copy = consentCopy(view.lang);
  const dir = view.lang === "ar" ? "rtl" : "ltr";
  const clientLine = view.clientName
    ? `${escapeHtml(copy.clientLabel)} <strong>${escapeHtml(view.clientName)}</strong>`
    : escapeHtml(copy.clientLabel);
  const scopeFields = view.grantableScopes
    .map(
      (scope) =>
        `<label class="scope"><input type="checkbox" name="scope" value="${escapeHtml(scope)}" checked><code>${escapeHtml(scope)}</code></label>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${view.lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.title)}</title>
<style>
  body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f6f7;color:#202223;display:grid;min-height:100vh;place-items:center}
  main{width:min(480px,calc(100vw - 2rem));background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:1.5rem;box-shadow:0 8px 24px rgb(0 0 0/.08)}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  .client{margin:0 0 1rem;font-size:.875rem;color:#6d7175}
  .scopes{display:grid;gap:.5rem;margin:0 0 1.25rem;border:0;padding:0}
  legend{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}
  .scope{display:flex;align-items:center;gap:.5rem;border:1px solid #e1e3e5;border-radius:8px;padding:.5rem .625rem}
  code{font-size:.8125rem}
  .actions{display:flex;gap:.75rem;justify-content:flex-end}
  button{border:0;border-radius:8px;padding:.625rem 1rem;font-size:.875rem;font-weight:600;cursor:pointer;background:#202223;color:#fff}
  .deny{color:#6d7175;text-decoration:none;align-self:center;padding:.5rem}
  .error{color:#d82c0d}
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="client">${clientLine}</p>
  <form method="post" action="${escapeHtml(view.formAction)}">
    <input type="hidden" name="ticket" value="${escapeHtml(view.ticket)}">
    <input type="hidden" name="csrf_token" value="${escapeHtml(view.csrfToken)}">
    <fieldset class="scopes">
      <legend>${escapeHtml(copy.scopesLabel)}</legend>
      ${scopeFields}
    </fieldset>
    <div class="actions">
      <a class="deny" href="${escapeHtml(view.denyUrl)}">${escapeHtml(copy.deny)}</a>
      <button type="submit">${escapeHtml(copy.approve)}</button>
    </div>
  </form>
</main>
</body>
</html>`;
}

export function renderNoPermissionsPage(lang: Lang): string {
  const copy = consentCopy(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(copy.noPermissions)}</title></head>
<body style="margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f6f7;color:#202223;display:grid;min-height:100vh;place-items:center">
<main style="width:min(480px,calc(100vw - 2rem));background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:1.5rem">
  <h1 style="font-size:1.25rem;margin:0 0 .5rem">${escapeHtml(copy.noPermissions)}</h1>
  <p style="margin:0 0 1rem;font-size:.875rem;color:#6d7175">${escapeHtml(copy.noPermissionsHint)}</p>
</main>
</body>
</html>`;
}

export function renderOAuthErrorPage(description: string, lang: Lang): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const title = lang === "fr" ? "Erreur d'autorisation" : lang === "en" ? "Authorization error" : "خطأ في التفويض";
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f6f7;color:#202223;display:grid;min-height:100vh;place-items:center">
<main style="width:min(480px,calc(100vw - 2rem));background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:1.5rem">
  <h1 style="font-size:1.25rem;margin:0 0 .5rem;color:#d82c0d">${escapeHtml(title)}</h1>
  <p style="margin:0;font-size:.875rem;color:#6d7175">${escapeHtml(description)}</p>
</main>
</body>
</html>`;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

type AuthorizeContext = Context<AppContext>;

async function handleParseError(c: AuthorizeContext, error: unknown): Promise<Response> {
  if (!(error instanceof AuthorizationError)) throw error;
  const lang = consentLang(c.req.header("accept-language"));
  const redirectUrl = oauthErrorRedirectUrl(error);
  if (!redirectUrl) {
    return c.html(renderOAuthErrorPage(error.description, lang), 400);
  }
  return c.redirect(redirectUrl, 302);
}

async function loadUser(db: ReturnType<typeof getDb>, userId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}

async function loadUserScopes(db: ReturnType<typeof getDb>, userId: string): Promise<string[]> {
  const rows = await db
    .select({ scope: userScopes.scope })
    .from(userScopes)
    .where(eq(userScopes.userId, userId));
  return rows.map((row) => row.scope);
}

export async function authorizeGet(c: AuthorizeContext): Promise<Response> {
  const helpers = c.env.OAUTH_PROVIDER;
  const secret = c.env.MCP_LOGIN_TICKET_SECRET;
  if (!helpers || !secret || secret.length < LOGIN_TICKET_MIN_KEY_BYTES) {
    return c.json({ error: "authorization_not_configured" }, 503);
  }

  let oauthRequest: AuthRequest;
  try {
    oauthRequest = await helpers.parseAuthRequest(c.req.raw);
  } catch (error) {
    return handleParseError(c, error);
  }
  const lang = consentLang(c.req.header("accept-language"));

  const ticket = c.req.query("ticket");
  if (!ticket) {
    return c.redirect(buildSignInRedirectUrl(c.env.BETTER_AUTH_URL, c.req.url), 302);
  }
  const payload = await verifyLoginTicket(secret, ticket);
  if (!payload) {
    return c.redirect(buildSignInRedirectUrl(c.env.BETTER_AUTH_URL, c.req.url), 302);
  }

  const db = getDb(c.env.DB);
  const user = await loadUser(db, payload.sub);
  if (!user || user.status !== "active") {
    return c.html(renderOAuthErrorPage("Account unavailable or inactive.", lang), 403);
  }

  const userScopeValues = await loadUserScopes(db, payload.sub);
  const grantableScopes = computeGrantableScopes(user.role, userScopeValues, oauthRequest.scope);
  if (grantableScopes.length === 0) {
    return c.html(renderNoPermissionsPage(lang), 200);
  }

  const client = await helpers.lookupClient(oauthRequest.clientId);
  const csrfToken = crypto.randomUUID();

  return c.html(
    renderConsentPage({
      clientName: client?.clientName ?? null,
      grantableScopes,
      formAction: buildFormAction(c.req.url),
      csrfToken,
      ticket,
      denyUrl: buildDenyRedirectUrl(oauthRequest),
      lang,
    }),
    200,
    { "Set-Cookie": csrfSetCookie(csrfToken) },
  );
}

export async function authorizePost(c: AuthorizeContext): Promise<Response> {
  const helpers = c.env.OAUTH_PROVIDER;
  const secret = c.env.MCP_LOGIN_TICKET_SECRET;
  if (!helpers || !secret || secret.length < LOGIN_TICKET_MIN_KEY_BYTES) {
    return c.json({ error: "authorization_not_configured" }, 503);
  }
  const lang = consentLang(c.req.header("accept-language"));
  const clearCookie = { "Set-Cookie": csrfClearCookie() };

  let oauthRequest: AuthRequest;
  try {
    oauthRequest = await helpers.parseAuthRequest(c.req.raw);
  } catch (error) {
    return handleParseError(c, error);
  }

  const form = await c.req.formData();
  const csrfToken = form.get("csrf_token");
  const ticket = form.get("ticket");
  if (typeof csrfToken !== "string" || typeof ticket !== "string") {
    return c.html(renderOAuthErrorPage("Invalid consent request.", lang), 400, clearCookie);
  }
  if (!csrfTokensMatch(csrfCookieValue(c.req.header("cookie")), csrfToken)) {
    return c.html(renderOAuthErrorPage("Consent verification failed.", lang), 403, clearCookie);
  }

  const payload = await verifyLoginTicket(secret, ticket);
  if (!payload) {
    return c.html(renderOAuthErrorPage("Invalid or expired login.", lang), 401, clearCookie);
  }

  const kv = c.env.OAUTH_KV;
  if ((await kv.get(`login-ticket:${payload.nonce}`)) !== null) {
    return c.html(renderOAuthErrorPage("Login already used.", lang), 401, clearCookie);
  }
  await kv.put(`login-ticket:${payload.nonce}`, "1", {
    expirationTtl: LOGIN_TICKET_TTL_SECONDS,
  });

  const db = getDb(c.env.DB);
  const user = await loadUser(db, payload.sub);
  if (!user || user.status !== "active") {
    return c.html(renderOAuthErrorPage("Account unavailable or inactive.", lang), 403, clearCookie);
  }

  const userScopeValues = await loadUserScopes(db, payload.sub);
  const grantableScopes = computeGrantableScopes(user.role, userScopeValues, oauthRequest.scope);
  const selectedScopes = form
    .getAll("scope")
    .map(String)
    .filter((scope) => grantableScopes.includes(scope));

  const client = await helpers.lookupClient(oauthRequest.clientId);

  const { redirectTo } = await helpers.completeAuthorization({
    request: oauthRequest,
    userId: user.id,
    metadata: { clientId: oauthRequest.clientId, clientName: client?.clientName ?? null },
    scope: selectedScopes,
    props: {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      scopes: selectedScopes,
    },
  });

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo, "Set-Cookie": csrfClearCookie() },
  });
}
