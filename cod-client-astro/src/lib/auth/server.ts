import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { customSession, jwt } from "better-auth/plugins";
import { getDb } from "../../../../cod-shared/db/client";
import { userScopes } from "../../../../cod-shared/db/schema";
import { eq } from "drizzle-orm";

export interface AuthEnv {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  PUBLIC_APP_URL: string;
  PUBLIC_API_URL: string;
  PUBLIC_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_SECRET: string;
  /**
   * HMAC secret (>= 32 bytes) shared with cod-server for the MCP OAuth login
   * tickets minted after a successful sign-in. Optional: when missing or too
   * short, the MCP authorize relay fails closed.
   */
  MCP_LOGIN_TICKET_SECRET?: string;
}

interface AuthCloudflareContext {
  /** Incoming-request metadata (Request.cf) for IP/geo resolution.
   *  NOTE: withCloudflare@0.3.1 has no ctx/waitUntil option — background
   *  task survival lands when the package gains it (backlog). */
  cf?: {
    country?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
    [key: string]: unknown;
  };
}

// One instance per request — never a module singleton. Two Drizzle wrappers
// around the same D1 binding contend on SQLite's write lock (documented
// better-auth-on-Workers failure mode).
export function createAuth(env: AuthEnv, cloudflare?: AuthCloudflareContext) {
  const db = getDb(env.DB);

  const kv = env.RATE_LIMIT_KV;
  const secondaryStorage = {    get: (key: string) => kv.get(key),
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
        cf: cloudflare?.cf,
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
        baseURL: env.PUBLIC_APP_URL,
        secret: env.BETTER_AUTH_SECRET,
        secondaryStorage,
        trustedOrigins: [
          ...(import.meta.env.DEV ? ["http://localhost:4321"] : []),
          ...(env.PUBLIC_TRUSTED_ORIGINS ?? "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean),
        ],
        disabledPaths: ["/token"],
        session: {
          storeSessionInDatabase: true,
          cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
          },
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
        },
        emailAndPassword: {
          enabled: true,
          autoSignIn: true,
          // No self-service registration: accounts are provisioned by an admin.
          disableSignUp: true,
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
          // Attaches real scopes (user_scopes join) to every session response so
          // the Identity contract is truthful end-to-end. Not added to the JWT
          // payload — scopes stay server-resolved per request.
          customSession(async ({ user, session }) => {
            const rows = await db
              .select({ scope: userScopes.scope })
              .from(userScopes)
              .where(eq(userScopes.userId, user.id));
            
            // Strip sensitive fields from user object before sending to browser
            const { apiKey, ...safeUser } = user as typeof user & { apiKey?: string };
            
            return {
              user: safeUser,
              session,
              scopes: (user as { role?: string }).role === "admin"
                ? ["*"]
                : rows.map((r) => r.scope),
            };
          }),
          jwt({
            jwt: {
              // Tokens are issued FOR the API resource, matching cod-server's
              // sessionAuth audience check (docs: "Modify Issuer, Audience…").
              audience: env.PUBLIC_API_URL,
              // Default payload embeds the ENTIRE user row — including the
              // plaintext apiKey additionalField. Whitelist instead.
              definePayload: ({ user }) => ({
                id: user.id,
                email: user.email,
                role: (user as { role?: string }).role ?? "staff",
              }),
            },
          }),
        ],
      }
    ),
  });
}

