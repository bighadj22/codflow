/**
 * /api/mcp management handlers — provider KV model.
 *
 * Contract:
 *   • /me builds one connection per (user, client): union scopes, oldest
 *     connectedAt, lastUsedAt from the mcp-last-used marker (null when
 *     absent — never a bogus "now"), active = grant present and unexpired
 *   • /team attributes every connection to its real user
 *   • revoke deletes every grant for the client (+ markers) and 404s when
 *     the connection does not exist
 *   • admin client deletion revokes all users' grants then deletes the
 *     client; unknown client + zero grants → 404
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { GrantSummary } from "@cloudflare/workers-oauth-provider";

import {
  listMyConnections,
  listTeamConnections,
  revokeMyConnection,
  revokeUserConnection,
  deleteMcpClient,
} from "./handlers";
import { errorHandler } from "@/middleware/error";
import type { Env } from "@/types/env";
import type { AppContext } from "@/types/app";

vi.mock("@/db", () => ({ getDb: () => dbMock }));
vi.mock("@/lib/activity", () => ({
  ACTIONS: {
    MCP_CONNECTION_REVOKED: "mcp.connection_revoked",
    MCP_CLIENT_DELETED: "mcp.client_deleted",
  },
  logActivity: vi.fn(async () => {}),
}));

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

function drizzleThenable<T>(rows: T[]) {
  const thenable = {
    from: () => thenable,
    where: () => thenable,
    all: async () => rows,
    get: async () => rows[0] ?? null,
  };
  return thenable;
}

// ─── Fake provider helpers + KV ──────────────────────────────────────────────

function makeGrant(partial: Partial<GrantSummary> & { id: string; clientId: string; userId: string }): GrantSummary {
  return {
    scope: [],
    metadata: {},
    createdAt: 1_700_000_000,
    ...partial,
  } as GrantSummary;
}

function makeEnv(opts: {
  grantsByUser: Record<string, GrantSummary[]>;
  clients?: Record<string, { clientName?: string; logoUri?: string; clientUri?: string } | null>;
}) {
  const kv = new Map<string, string>();
  const calls = {
    revokedGrants: [] as Array<{ grantId: string; userId: string }>,
    deletedClients: [] as string[],
  };

  const helpers = {
    listUserGrants: async (userId: string) => ({
      items: (opts.grantsByUser[userId] ?? []).map((g) => g),
    }),
    revokeGrant: async (grantId: string, userId: string) => {
      calls.revokedGrants.push({ grantId, userId });
      const list = opts.grantsByUser[userId] ?? [];
      const idx = list.findIndex((g) => g.id === grantId);
      if (idx >= 0) list.splice(idx, 1);
    },
    lookupClient: async (clientId: string) => {
      const client = opts.clients?.[clientId];
      return client ? { clientId, redirectUris: [], tokenEndpointAuthMethod: "none", ...client } : null;
    },
    deleteClient: async (clientId: string) => {
      calls.deletedClients.push(clientId);
    },
  };

  const env = {
    OAUTH_PROVIDER: helpers,
    OAUTH_KV: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => {
        kv.set(key, value);
      },
      delete: async (key: string) => {
        kv.delete(key);
      },
    },
    DB: {},
  } as unknown as Env;

  return { env, kv, calls, grantsByUser: opts.grantsByUser };
}

function appWithUser(env: Env, user: { id: string; name: string; email: string; role: "admin" | "staff" }) {
  const hono = new Hono<AppContext>();
  hono.onError(errorHandler);
  hono.use("*", async (c, next) => {
    c.set("user", { ...user, scopes: ["mcp:view"] } as never);
    await next();
  });
  hono.get("/me", listMyConnections);
  hono.get("/team", listTeamConnections);
  hono.delete("/connections/:clientId", revokeMyConnection);
  hono.delete("/connections/:clientId/users/:userId", revokeUserConnection);
  hono.delete("/clients/:clientId", deleteMcpClient);
  return hono;
}

async function jsonBody<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const admin = { id: "u1", name: "Ada", email: "ada@x.y", role: "admin" as const };

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.select.mockImplementation(() => drizzleThenable([]));
});

describe("GET /me", () => {
  it("groups multiple grants per client: union scopes, oldest connectedAt, max lastUsed", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "claude", userId: "u1", scope: ["orders:read"], createdAt: 1_700_000_000 });
    const g2 = makeGrant({ id: "g2", clientId: "claude", userId: "u1", scope: ["customers:read"], createdAt: 1_700_100_000 });
    const { env, kv } = makeEnv({ grantsByUser: { u1: [g1, g2] }, clients: { claude: { clientName: "Claude" } } });
    kv.set("mcp-last-used:u1:g2", "2026-08-31T00:00:00.000Z");

    const res = await appWithUser(env, admin).request("/me", {}, env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.count).toBe(1);
    const conn = body.data[0];
    expect(conn.clientId).toBe("claude");
    expect(conn.clientName).toBe("Claude");
    expect(conn.scopes).toEqual(["customers:read", "orders:read"]);
    expect(conn.connectedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(conn.lastUsedAt).toBe("2026-08-31T00:00:00.000Z");
    expect(conn.active).toBe(true);
  });

  it("leaves lastUsedAt null when no marker exists (no bogus now)", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "claude", userId: "u1" });
    const { env } = makeEnv({ grantsByUser: { u1: [g1] } });
    const res = await appWithUser(env, admin).request("/me", {}, env);
    const body = await jsonBody(res);
    expect(body.data[0].lastUsedAt).toBeNull();
  });

  it("marks expired grants inactive and falls back to grant-metadata client name (CIMD)", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "cimd-client", userId: "u1", expiresAt: 1_700_000_100, metadata: { clientName: "ChatGPT" } });
    const { env } = makeEnv({ grantsByUser: { u1: [g1] }, clients: { "cimd-client": null } });
    const res = await appWithUser(env, admin).request("/me", {}, env);
    const body = await jsonBody(res);
    expect(body.data[0].active).toBe(false);
    expect(body.data[0].clientName).toBe("ChatGPT");
  });
});

describe("GET /team", () => {
  it("lists every user's connections with real user attribution", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "claude", userId: "u1", scope: ["orders:read"] });
    const g2 = makeGrant({ id: "g2", clientId: "chatgpt", userId: "u2", scope: ["products:read"] });
    const { env } = makeEnv({ grantsByUser: { u1: [g1], u2: [g2] } });
    dbMock.select.mockImplementation(() => drizzleThenable([
      { id: "u1", name: "Ada", email: "ada@x.y" },
      { id: "u2", name: "Bob", email: "bob@x.y" },
    ]));

    const res = await appWithUser(env, admin).request("/team", {}, env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.count).toBe(2);
    const userIds = body.data.map((c: { user?: { id: string } }) => c.user?.id).sort();
    expect(userIds).toEqual(["u1", "u2"]);
    const bob = body.data.find((c: { user?: { id: string } }) => c.user?.id === "u2");
    expect(bob.user).toEqual({ id: "u2", name: "Bob", email: "bob@x.y" });
  });
});

describe("DELETE /connections/:clientId", () => {
  it("revokes every grant for the client, deletes the last-used markers, keeps other clients", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "claude", userId: "u1" });
    const g2 = makeGrant({ id: "g2", clientId: "claude", userId: "u1" });
    const g3 = makeGrant({ id: "g3", clientId: "other", userId: "u1" });
    const { env, kv, calls } = makeEnv({ grantsByUser: { u1: [g1, g2, g3] } });
    kv.set("mcp-last-used:u1:g1", "2026-08-31T00:00:00.000Z");

    const res = await appWithUser(env, admin).request("/connections/claude", { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.data).toEqual({ clientId: "claude", userId: "u1" });
    expect(calls.revokedGrants.map((r) => r.grantId).sort()).toEqual(["g1", "g2"]);
    expect(kv.has("mcp-last-used:u1:g1")).toBe(false);

    const me = await appWithUser(env, admin).request("/me", {}, env);
    const meBody = await jsonBody(me);
    expect(meBody.data.map((c: { clientId: string }) => c.clientId)).toEqual(["other"]);
  });

  it("404s when the user holds no grant for the client", async () => {
    const { env } = makeEnv({ grantsByUser: { u1: [] } });
    const res = await appWithUser(env, admin).request("/connections/ghost", { method: "DELETE" }, env);
    expect(res.status).toBe(404);
    const body = await jsonBody<{ code: string }>(res);
    expect(body.code).toBe("MCP_CONNECTION_NOT_FOUND");
  });
});

describe("DELETE /connections/:clientId/users/:userId", () => {
  it("revokes the target user's grants for the client", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "claude", userId: "staff-9" });
    const { env, calls } = makeEnv({ grantsByUser: { "staff-9": [g1] } });
    const res = await appWithUser(env, admin).request("/connections/claude/users/staff-9", { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    expect(calls.revokedGrants).toEqual([{ grantId: "g1", userId: "staff-9" }]);
  });
});

describe("DELETE /clients/:clientId", () => {
  it("revokes every user's grants for the client, then deletes the client", async () => {
    const g1 = makeGrant({ id: "g1", clientId: "rogue", userId: "u1" });
    const g2 = makeGrant({ id: "g2", clientId: "rogue", userId: "u2" });
    const { env, calls } = makeEnv({
      grantsByUser: { u1: [g1], u2: [g2] },
      clients: { rogue: { clientName: "Rogue" } },
    });
    dbMock.select.mockImplementation(() => drizzleThenable([
      { id: "u1", name: "Ada", email: "ada@x.y" },
      { id: "u2", name: "Bob", email: "bob@x.y" },
    ]));

    const res = await appWithUser(env, admin).request("/clients/rogue", { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.data).toEqual({ clientId: "rogue", revokedForUsers: 2 });
    expect(calls.deletedClients).toEqual(["rogue"]);
  });

  it("404s when the client is unknown and holds no grants", async () => {
    const { env } = makeEnv({ grantsByUser: {}, clients: {} });
    const res = await appWithUser(env, admin).request("/clients/ghost", { method: "DELETE" }, env);
    expect(res.status).toBe(404);
    const body = await jsonBody<{ code: string }>(res);
    expect(body.code).toBe("MCP_CLIENT_NOT_FOUND");
  });
});
