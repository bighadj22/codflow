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

import { LOGO_FOR_DARK_BG, LOGO_FOR_LIGHT_BG } from "./brand";

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

/** Brand header carrying the REAL logo wordmark (dark/light variants, CSS-toggled). */
function brandHeader(): string {
  return `<header class="brand" role="img" aria-label="CodFlow">
  <span class="logo logo-on-light">${LOGO_FOR_LIGHT_BG}</span>
  <span class="logo logo-on-dark">${LOGO_FOR_DARK_BG}</span>
</header>`;
}

/**
 * Scope code → friendly label, composed from domain + action vocabulary.
 * Unknown scopes fall back to the raw code — a new scope is never mistranslated.
 */
const DOMAIN_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", orders: "Orders", customers: "Customers",
    products: "Products", delivery: "Delivery", customer_groups: "Customer groups",
    customer_tags: "Customer tags", product_groups: "Product groups",
    stock: "Stock", settings: "Settings", reviews: "Reviews", offers: "Offers",
    abandoned_orders: "Abandoned orders", landing_pages: "Landing pages",
    mcp: "AI app connections",
  },
  fr: {
    dashboard: "Tableau de bord", orders: "Commandes", customers: "Clients",
    products: "Produits", delivery: "Livraison", customer_groups: "Groupes de clients",
    customer_tags: "Étiquettes clients", product_groups: "Groupes de produits",
    stock: "Stock", settings: "Paramètres", reviews: "Avis", offers: "Offres",
    abandoned_orders: "Commandes abandonnées", landing_pages: "Pages de destination",
    mcp: "Connexions d'apps IA",
  },
  ar: {
    dashboard: "لوحة التحكم", orders: "الطلبات", customers: "العملاء",
    products: "المنتجات", delivery: "التوصيل", customer_groups: "مجموعات العملاء",
    customer_tags: "وسوم العملاء", product_groups: "مجموعات المنتجات",
    stock: "المخزون", settings: "الإعدادات", reviews: "التقييمات", offers: "العروض",
    abandoned_orders: "الطلبات المتروكة", landing_pages: "صفحات الهبوط",
    mcp: "اتصالات تطبيقات الذكاء الاصطناعي",
  },
};

const ACTION_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    view: "view", read: "view", create: "create", update: "edit",
    delete: "delete", assign: "assign drivers", manage: "full control",
    dispatch: "dispatch to carriers", team: "team management",
    integrations: "integrations", notifications: "notifications",
    verification: "verification settings", email: "email settings",
  },
  fr: {
    view: "consultation", read: "consultation", create: "création",
    update: "modification", delete: "suppression", assign: "attribution des livreurs",
    manage: "contrôle total", dispatch: "expédition vers transporteurs",
    team: "gestion d'équipe", integrations: "intégrations",
    notifications: "notifications", verification: "paramètres de vérification",
    email: "paramètres e-mail",
  },
  ar: {
    view: "عرض", read: "عرض", create: "إنشاء", update: "تعديل",
    delete: "حذف", assign: "تعيين سائقين", manage: "تحكم كامل",
    dispatch: "إرسال لشركات التوصيل", team: "إدارة الفريق",
    integrations: "التكاملات", notifications: "الإشعارات",
    verification: "إعدادات التحقق", email: "إعدادات البريد",
  },
};

/**
 * A scope's display parts. Known domain+action → friendly labels; anything
 * unknown falls back to the raw code pieces so a new scope is never
 * mistranslated.
 */
function scopeParts(scope: string, lang: Lang): { domain: string; action: string } {
  const [domain, action] = scope.split(":");
  const domainLabel = DOMAIN_LABELS[lang][domain];
  const actionLabel = action !== undefined ? ACTION_LABELS[lang][action] : undefined;
  return {
    domain: domainLabel ?? domain,
    action: domainLabel && actionLabel ? actionLabel : scope,
  };
}

/**
 * Group scopes by domain (first-appearance order) for compact display:
 * one heading per domain, one toggleable chip per action. A long permission
 * request renders as a few clustered lines instead of a full-width row per
 * scope. Chips carry the raw code in their title tooltip.
 */
function groupedScopes(scopes: string[], lang: Lang): Array<{ domain: string; chips: Array<{ label: string; scope: string }> }> {
  const groups: Array<{ domain: string; chips: Array<{ label: string; scope: string }> }> = [];
  const byDomain = new Map<string, { domain: string; chips: Array<{ label: string; scope: string }> }>();
  for (const scope of scopes) {
    const parts = scopeParts(scope, lang);
    let group = byDomain.get(parts.domain);
    if (!group) {
      group = { domain: parts.domain, chips: [] };
      byDomain.set(parts.domain, group);
      groups.push(group);
    }
    group.chips.push({ label: parts.action, scope });
  }
  return groups;
}

interface ConsentCopy {
  title: string;
  appCardIntro: string;
  unknownApp: string;
  approve: string;
  deny: string;
  scopesLegend: string;
  scopeHint: string;
  approvingAs: string;
  revokeNote: string;
  noPermissions: string;
  noPermissionsHint: string;
}

function consentCopy(lang: Lang): ConsentCopy {
  if (lang === "fr") {
    return {
      title: "Autoriser l'accès à CodFlow",
      appCardIntro: "demande l'accès à votre espace CodFlow",
      unknownApp: "Une application",
      approve: "Autoriser",
      deny: "Refuser",
      scopesLegend: "Autorisations demandées",
      scopeHint: "Décochez ce que vous ne souhaitez pas partager.",
      approvingAs: "Connexion en tant que",
      revokeNote: "Vous pouvez révoquer cet accès à tout moment depuis le tableau de bord (Applications IA).",
      noPermissions: "Aucune autorisation à accorder",
      noPermissionsHint: "Vous ne disposez d'aucune des autorisations demandées pour cette application.",
    };
  }
  if (lang === "en") {
    return {
      title: "Authorize access to CodFlow",
      appCardIntro: "is requesting access to your CodFlow workspace",
      unknownApp: "An application",
      approve: "Authorize",
      deny: "Deny",
      scopesLegend: "Permissions requested",
      scopeHint: "Uncheck anything you don't want to share.",
      approvingAs: "Approving as",
      revokeNote: "You can revoke this app's access anytime from the dashboard (AI Apps page).",
      noPermissions: "Nothing to authorize",
      noPermissionsHint: "You do not hold any of the permissions this application requested.",
    };
  }
  return {
    title: "السماح بالوصول إلى CodFlow",
    appCardIntro: "يطلب الوصول إلى مساحة عملك في CodFlow",
    unknownApp: "تطبيق",
    approve: "السماح",
    deny: "رفض",
    scopesLegend: "الصلاحيات المطلوبة",
    scopeHint: "أزل تحديد أي صلاحية لا تريد منحها.",
    approvingAs: "الموافقة باسم",
    revokeNote: "يمكنك إلغاء وصول هذا التطبيق في أي وقت من لوحة التحكم (صفحة تطبيقات الذكاء الاصطناعي).",
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
  /** Verified account identity shown on the consent card — trust anchor. */
  userName?: string;
  userEmail?: string;
}

/**
 * Shared page shell for the consent/error screens — one visual identity
 * (CodFlow brand amethyst on charcoal, dark-mode aware, RTL-safe via logical
 * properties), zero external assets so the page renders offline-safe.
 */
function pageShell(lang: Lang, dir: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root{
    --bg:#f3f2f4;--card:#ffffff;--border:#e4e1ec;--text:#202223;--muted:#6d7175;
    --brand:#6d28d9;--brand-soft:#f3ecff;--brand-border:#d9c8f8;--danger:#d82c0d;
    --btn:#202223;--btn-text:#ffffff;
  }
  @media (prefers-color-scheme:dark){
    :root{
      --bg:#141318;--card:#1d1c22;--border:#2f2d38;--text:#edf1ee;--muted:#9ba39d;
      --brand-soft:#2a1f47;--brand-border:#4a3a75;--btn:#edf1ee;--btn-text:#141318;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    background:var(--bg);color:var(--text);display:grid;min-height:100vh;place-items:center;padding:1.5rem 1rem;
    -webkit-font-smoothing:antialiased}
  main{width:min(460px,100%);background:var(--card);border:1px solid var(--border);
    border-radius:16px;box-shadow:0 12px 40px rgb(16 12 32/.10);overflow:hidden}
  header.brand{display:flex;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid var(--border)}
  header.brand .logo{display:block;line-height:0}
  header.brand svg{height:22px;width:auto;display:block}
  header.brand .logo-on-dark{display:none}
  @media (prefers-color-scheme:dark){
    header.brand .logo-on-light{display:none}
    header.brand .logo-on-dark{display:block}
  }
  .content{padding:1.5rem}
  h1{font-size:1.125rem;font-weight:700;margin:0 0 1rem;letter-spacing:-.01em}
  .appcard{display:flex;align-items:center;gap:.875rem;padding:.875rem 1rem;
    background:var(--brand-soft);border:1px solid var(--brand-border);border-radius:12px;margin:0 0 1.25rem}
  .appavatar{flex:none;width:40px;height:40px;border-radius:10px;background:var(--brand);
    color:#fff;font-weight:800;font-size:1.05rem;display:grid;place-items:center}
  .appmeta{min-width:0}
  .appname{font-weight:700;font-size:.9375rem;line-height:1.3;word-break:break-word}
  .appreq{font-size:.8125rem;color:var(--muted);line-height:1.4}
  .identity{font-size:.75rem;color:var(--muted);margin:-.75rem 0 1.25rem;padding-inline-start:.25rem}
  .identity b{color:var(--text);font-weight:600}
  fieldset.scopes{border:0;padding:0;margin:0 0 .375rem}
  legend{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    color:var(--muted);margin-bottom:.625rem;padding:0}
  .group+.group{margin-top:.75rem}
  .domain{font-size:.8125rem;font-weight:700;margin-bottom:.375rem}
  .chips{display:flex;flex-wrap:wrap;gap:.375rem}
  .chip{display:inline-flex;align-items:center;gap:.4rem;border:1px solid var(--border);
    border-radius:999px;padding:.3rem .7rem .3rem .55rem;font-size:.8125rem;font-weight:600;
    cursor:pointer;user-select:none;transition:border-color .15s,background .15s}
  .chip:hover{border-color:var(--brand-border)}
  .chip input[type=checkbox]{width:.95rem;height:.95rem;flex:none;margin:0;
    accent-color:var(--brand);cursor:pointer}
  @supports selector(:has(*)){
    .chip:has(input:checked){background:var(--brand-soft);border-color:var(--brand-border)}
  }
  .scopehint{font-size:.75rem;color:var(--muted);margin:.875rem 0 1.25rem}
  .actions{display:flex;gap:.625rem;align-items:stretch}
  .actions a,.actions button{flex:1;border-radius:10px;padding:.7rem 1rem;font-size:.875rem;
    font-weight:700;text-align:center;text-decoration:none;cursor:pointer}
  button.approve{border:1px solid transparent;background:var(--btn);color:var(--btn-text);flex:1.4}
  button.approve:hover{filter:brightness(1.08)}
  a.deny{border:1px solid var(--border);color:var(--muted);display:grid;place-items:center}
  a.deny:hover{color:var(--text);border-color:var(--muted)}
  .trust{display:flex;gap:.5rem;align-items:flex-start;margin:1.25rem 0 0;padding-top:1rem;
    border-top:1px solid var(--border);font-size:.75rem;color:var(--muted);line-height:1.5}
  .trust svg{flex:none;margin-top:.0625rem}
  a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--brand);
    outline-offset:2px;border-radius:8px}
  .err{color:var(--danger);font-weight:600}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

const SHIELD_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5 13 3.5v4c0 3.2-2.1 5.9-5 7-2.9-1.1-5-3.8-5-7v-4l5-2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m5.8 8 1.6 1.6 3-3.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderConsentPage(view: ConsentView): string {
  const copy = consentCopy(view.lang);
  const dir = view.lang === "ar" ? "rtl" : "ltr";
  const clientName = view.clientName ?? copy.unknownApp;
  const avatarLetter = [...clientName.trim()][0]?.toUpperCase() ?? "?";
  const identity =
    view.userEmail !== undefined
      ? `<p class="identity">${escapeHtml(copy.approvingAs)} <b>${escapeHtml(view.userName || view.userEmail)}</b> · ${escapeHtml(view.userEmail)}</p>`
      : "";
  const groups = groupedScopes(view.grantableScopes, view.lang);
  const groupsHtml = groups
    .map(
      (group) => `
      <div class="group">
        <div class="domain">${escapeHtml(group.domain)}</div>
        <div class="chips">${group.chips
          .map(
            (chip) =>
              `<label class="chip" title="${escapeHtml(chip.scope)}"><input type="checkbox" name="scope" value="${escapeHtml(chip.scope)}" checked><span>${escapeHtml(chip.label)}</span></label>`,
          )
          .join("")}</div>
      </div>`,
    )
    .join("");

  return pageShell(
    view.lang,
    dir,
    copy.title,
    `${brandHeader()}
<div class="content">
  <h1>${escapeHtml(copy.title)}</h1>
  <div class="appcard">
    <div class="appavatar">${escapeHtml(avatarLetter)}</div>
    <div class="appmeta">
      <div class="appname">${escapeHtml(clientName)}</div>
      <div class="appreq">${escapeHtml(copy.appCardIntro)}</div>
    </div>
  </div>
  ${identity}
  <form method="post" action="${escapeHtml(view.formAction)}">
    <input type="hidden" name="ticket" value="${escapeHtml(view.ticket)}">
    <input type="hidden" name="csrf_token" value="${escapeHtml(view.csrfToken)}">
    <fieldset class="scopes">
      <legend>${escapeHtml(copy.scopesLegend)}</legend>
      ${groupsHtml}
    </fieldset>
    <p class="scopehint">${escapeHtml(copy.scopeHint)}</p>
    <div class="actions">
      <a class="deny" href="${escapeHtml(view.denyUrl)}">${escapeHtml(copy.deny)}</a>
      <button class="approve" type="submit">${escapeHtml(copy.approve)}</button>
    </div>
  </form>
  <p class="trust">${SHIELD_ICON}<span>${escapeHtml(copy.revokeNote)}</span></p>
</div>`,
  );
}

export function renderNoPermissionsPage(lang: Lang): string {
  const copy = consentCopy(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";
  return pageShell(
    lang,
    dir,
    copy.noPermissions,
    `${brandHeader()}
<div class="content">
  <h1>${escapeHtml(copy.noPermissions)}</h1>
  <p class="scopehint" style="margin:0">${escapeHtml(copy.noPermissionsHint)}</p>
</div>`,
  );
}

export function renderOAuthErrorPage(description: string, lang: Lang): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const title = lang === "fr" ? "Erreur d'autorisation" : lang === "en" ? "Authorization error" : "خطأ في التفويض";
  return pageShell(
    lang,
    dir,
    title,
    `${brandHeader()}
<div class="content">
  <h1 class="err">${escapeHtml(title)}</h1>
  <p class="scopehint" style="margin:0">${escapeHtml(description)}</p>
</div>`,
  );
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
      userName: user.name,
      userEmail: user.email,
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
