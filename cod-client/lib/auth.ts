import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { magicLink, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userScopes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { ALL_SCOPES, SCOPES } from "../../cod-shared/rbac/scopes";
import {
  renderPasswordResetEmail,
  renderPasswordResetEmailText,
  renderPasswordResetEmailAr,
  renderMagicLinkEmail,
  renderMagicLinkEmailText,
  renderMagicLinkEmailAr,
  renderPasswordChangedEmail,
  renderPasswordChangedEmailAr,
} from "@/lib/email-templates";

type AuthInstance = Awaited<ReturnType<typeof buildAuth>>;
let authInstance: AuthInstance | null = null;

async function buildAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Better Auth routes session caching AND rate-limit counters through
  // `secondaryStorage`. better-auth-cloudflare@0.3.1's built-in KV adapter
  // (createKVStorage) implements only get/set/delete — its rate limiter
  // hard-requires `increment` and throws
  //   BetterAuthError: Secondary-storage rate limiting requires
  //   SecondaryStorage.increment.
  // so we provide the full storage on RATE_LIMIT_KV ourselves.
  //
  // KV has no atomic counters: increment is read-modify-write. Under extreme
  // concurrency two isolates can read the same count — worst case the limiter
  // under-counts by one hit, never blocks legit traffic permanently.
  //
  // KV expirationTtl floor is 60s, so windows shorter than 60s effectively
  // expire at 60s (all configured windows are ≥ 60s today).
  const kv = env.RATE_LIMIT_KV;
  const secondaryStorage = {
    get: (key: string) => kv.get(key),
    getAndDelete: async (key: string) => {
      const value = await kv.get(key);
      await kv.delete(key);
      return value;
    },
    set: (key: string, value: string, ttl?: number) =>
      kv.put(key, value, ttl ? { expirationTtl: Math.max(60, Math.ceil(ttl)) } : undefined),
    delete: (key: string) => kv.delete(key),
    increment: async (key: string, ttl?: number): Promise<number> => {
      const previous = await kv.get(key);
      const next = (previous ? Number.parseInt(previous, 10) : 0) + 1;
      await kv.put(
        key,
        String(next),
        previous ? undefined : { expirationTtl: Math.max(60, Math.ceil(ttl ?? 60)) }
      );
      return next;
    },
  };

  return betterAuth({
    ...withCloudflare(
      {
        autoDetectIpAddress: false,
        geolocationTracking: false,
        d1: {
          db,
          options: {
            usePlural: true,
            transaction: false,
          },
        },
      },
      {
        baseURL: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        secret: env.BETTER_AUTH_SECRET,
        secondaryStorage,
        // oauthProvider plugin owns /token — disable the default better-auth
        // handler so the two don't conflict on the same path.
        disabledPaths: ["/token"],
        session: {
          // REQUIRED whenever secondaryStorage (the KV cache from
          // withCloudflare above) is enabled AND we use the OAuth Provider
          // plugin. The plugin needs sessions in D1 for the joins it does
          // against oauthConsents / oauthAccessTokens — KV doesn't do joins.
          //
          // Without this flag Better Auth refuses to boot:
          //   BetterAuthError: OAuth Provider requires
          //   `session.storeSessionInDatabase: true` when using
          //   secondaryStorage
          // and every /api/auth/* request 500s — sign-in, magic link, and
          // password reset all fail.
          //
          // Effect: writes go to BOTH D1 (durable, joinable) and KV (cache).
          // Reads still hit KV first, so the get-session perf win stays.
          // Source-of-truth: better-auth/dist/db/internal-adapter.mjs:146-201
          // and @better-auth/oauth-provider/dist/index.mjs:2755.
          storeSessionInDatabase: true,
        },
        advanced: {
          ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
          },
        },
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
          customRules: {
            "/request-password-reset": { window: 3600, max: 3 },
            "/sign-in/magic-link": { window: 3600, max: 5 },
          },
          // storage auto-resolves to "secondary-storage" via the kv binding above.
        },
        emailAndPassword: {
          enabled: true,
          autoSignIn: true,
          sendResetPassword: async ({ user, url }, _request) => {
            const userRecord = await db.select().from(users).where(eq(users.id, user.id)).get();
            const language = userRecord?.language ?? "en";
            const html = language === "ar"
              ? await renderPasswordResetEmailAr({ user, url })
              : await renderPasswordResetEmail({ user, url });
            const text = await renderPasswordResetEmailText({ user, url });
            await sendEmail({
              to: user.email,
              subject: language === "ar" ? "إعادة تعيين كلمة المرور" : "Reset Your Password",
              html,
              text,
            });
          },
          onPasswordReset: async ({ user }, _request) => {
            const userRecord = await db.select().from(users).where(eq(users.id, user.id)).get();
            const language = userRecord?.language ?? "en";
            const html = language === "ar"
              ? await renderPasswordChangedEmailAr({ user })
              : await renderPasswordChangedEmail({ user });
            await sendEmail({
              to: user.email,
              subject: language === "ar" ? "تم تغيير كلمة المرور" : "Password Changed",
              html,
              text: html,
            });
          },
        },
        user: {
          additionalFields: {
            role:     { type: "string", defaultValue: "staff",  required: false },
            status:   { type: "string", defaultValue: "active", required: false },
            apiKey:   { type: "string", required: false },
            language: { type: "string", defaultValue: "en", required: false },
          },
        },
        plugins: [
          magicLink({
            expiresIn: 600,
            sendMagicLink: async ({ email, url }, _request) => {
              const userRecord = await db.select().from(users).where(eq(users.email, email)).get();
              const language = userRecord?.language ?? "en";
              const name = userRecord?.name ?? email;
              const html = language === "ar"
                ? await renderMagicLinkEmailAr({ user: { email, name }, url })
                : await renderMagicLinkEmail({ user: { email, name }, url });
              const text = await renderMagicLinkEmailText({ user: { email, name }, url });
              await sendEmail({
                to: email,
                subject: language === "ar" ? "تسجيل الدخول إلى حسابك" : "Sign In to Your Account",
                html,
                text,
              });
            },
          }),

          // ─── JWT ──────────────────────────────────────────────────────────
          // Required peer of @better-auth/oauth-provider. Provides the signing
          // infrastructure (JWKS endpoint, RS256 keys) used to issue OAuth
          // access tokens that resource servers (cod-server MCP) can verify
          // offline against the JWKS URL.
          jwt(),

          // ─── OAuth 2.1 Provider ───────────────────────────────────────────
          // Turns this Better Auth instance into an OAuth 2.1 Authorization
          // Server. Used exclusively by MCP clients (Claude Desktop, Claude.ai,
          // ChatGPT, custom agents) to get a scoped access token against
          // cod-server. NOT used by cod-client itself — the dashboard still
          // uses normal Better Auth sessions.
          //
          // See MCP_PLAN.md §5 for the full rationale.
          oauthProvider({
            loginPage:   "/sign-in",    // existing dashboard sign-in
            consentPage: "/consent",    // built in MCP-6

            scopes: [
              // OIDC standard scopes — identity + refresh token flow
              "openid", "profile", "email", "offline_access",
              // Project scopes (single source of truth: cod-shared/rbac/scopes.ts).
              // ALL_SCOPES already excludes the "*" admin wildcard — correct,
              // admin bypass is handled in the resource server via the `role`
              // claim we inject below, not by granting "*" over OAuth.
              ...ALL_SCOPES,
            ],

            // Tokens issued here are ONLY valid against our own backend API.
            // The resource server (cod-server) enforces audience match when
            // calling verifyAccessToken. MCP clients send the `resource`
            // parameter per RFC 8707, and different clients pick different
            // forms — the RFC 9728 "resource" value, a trailing-slash variant,
            // or the full `/mcp` path — so we accept all three.
            //
            // The base URL is per-tenant: `NEXT_PUBLIC_WORKER_URL` is set to
            // `https://api.{tenant-domain}` when provisioning the cod-client
            // Worker. Hardcoding any one domain here breaks every other tenant
            // on the platform.
            validAudiences: (() => {
              const base = (env.NEXT_PUBLIC_WORKER_URL ?? "").replace(/\/+$/, "");
              return base ? [base, `${base}/`, `${base}/mcp`] : [];
            })(),

            // Dynamic client registration — Claude Desktop / Claude.ai /
            // ChatGPT self-register on first connect. Admin can revoke any
            // client from Settings → Connected Apps (MCP-15).
            allowDynamicClientRegistration:        true,
            allowUnauthenticatedClientRegistration: true,
            clientRegistrationDefaultScopes: ["openid", "profile", "email", "offline_access"],
            clientRegistrationAllowedScopes: ALL_SCOPES,

            // Short access token, long refresh — standard pattern.
            // Durations are seconds (not ms, not duration strings — see plugin types).
            accessTokenExpiresIn:  60 * 60,            // 1 hour
            refreshTokenExpiresIn: 60 * 60 * 24 * 30,  // 30 days

            // Tighter windows for high-risk scopes. A token that can delete
            // customers or dispatch shipments shouldn't live for an hour.
            scopeExpirations: {
              [SCOPES.DELIVERY_DISPATCH]: 15 * 60,
              [SCOPES.ORDERS_DELETE]:     15 * 60,
              [SCOPES.CUSTOMERS_DELETE]:  15 * 60,
              [SCOPES.PRODUCTS_DELETE]:   15 * 60,
            },

            // Inject the user's role into the access token so cod-server can
            // do admin-bypass checks without an extra DB round-trip on every
            // MCP request. The resource server reads this as `payload.role`.
            customAccessTokenClaims: async ({ user }) => ({
              role: (user as { role?: string }).role ?? "staff",
            }),
          }),
        ],
      }
    ),
  });
}

export async function initAuth(): Promise<AuthInstance> {
  if (!authInstance) authInstance = await buildAuth();
  return authInstance;
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
  apiKey: string | null;
};

export async function getUser(): Promise<AuthUser | null> {
  try {
    const auth = await initAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    return session.user as unknown as AuthUser;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
}

export async function getUserRole(): Promise<"admin" | "staff" | null> {
  const user = await getUser();
  return user?.role ?? null;
}

export async function getUserScopes(): Promise<string[]> {
  const user = await getUser();
  if (!user) return [];

  if (user.role === "admin") return ["*"];

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const records = await db
      .select({ scope: userScopes.scope })
      .from(userScopes)
      .where(eq(userScopes.userId, user.id));
    return records.map((r) => r.scope);
  } catch {
    return [];
  }
}

export async function getUserApiKey(): Promise<string | null> {
  const user = await getUser();
  return user?.apiKey ?? null;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function hasPermission(requiredScope: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  const scopes = await getUserScopes();
  return scopes.includes(requiredScope) || scopes.includes("*");
}

export async function requirePermission(requiredScope: string): Promise<void> {
  const has = await hasPermission(requiredScope);
  if (!has) throw new ForbiddenError(`ليس لديك صلاحية: ${requiredScope}`);
}

export async function requireAdmin(): Promise<void> {
  const user = await getUser();
  if (user?.role !== "admin") throw new ForbiddenError("هذه العملية متاحة للمسؤولين فقط");
}

export async function requireUserApiKey(): Promise<string> {
  const apiKey = await getUserApiKey();
  if (!apiKey) throw new UnauthorizedError("مفتاح API غير متوفر. يرجى التواصل مع المسؤول.");
  return apiKey;
}
