/**
 * The storefront credential, end to end on real D1.
 *
 * Migration 0007 added `stores.store_api_key` so the merchant could read the
 * store key in Settings, but provisioning wrote only the digest into
 * `store_api_keys`. The panel read null forever, and no redeploy could fill
 * it: the worker only holds the irreversible digest. These tests pin the two
 * halves of ONE raw key:
 *
 *   - the dashboard obtains it (`GET /api/stores/me` → `data.storeApiKey`), and
 *   - the storefront authenticates with it (`X-Store-API-Key`).
 *
 * They also pin the boundary the Telegram notifier depends on: the store key
 * is a different secret from a dashboard/team key, and neither stands in for
 * the other. The digest written by the seeder (`hashStoreApiKey`, Node crypto)
 * must equal what storeAuthMiddleware computes in the worker (WebCrypto).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { storeAuthMiddleware } from "@/middleware/storeAuth";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import storeRouter from "@/endpoints/store/routes";
import storesRouter from "./routes";
import { getStore } from "./queries";
import {
  hashStoreApiKey,
  storeApiKeyHashStatement,
  storeApiKeyPlaintextStatement,
} from "../../../scripts/lib/store-key.mjs";

const dbModule = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db", () => dbModule);

let harness: TestD1;
let app: OpenAPIHono<AppContext>;

const NOW = () => new Date().toISOString();
const STORE_ID = "store-key-e2e";
const STORE_KEY = "sk_store_e2e_key_do_not_rotate";
const TEAM_KEY = "cod_e2e_team_key";

beforeAll(async () => {
  harness = await createTestD1();

  app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: harness.raw } as never;
    // The dashboard identity for /api/stores/*; /store/* is authorised by the
    // key itself, via storeAuthMiddleware mounted below.
    c.set("user", {
      id: "admin_user_001",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      status: "active",
      apiKey: TEAM_KEY,
      scopes: ["*"],
    } as never);
    await next();
  });
  app.use("/store/*", storeAuthMiddleware);
  app.onError(errorHandler);
  app.route("/store", storeRouter);
  app.route("/api/stores", storesRouter);
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  dbModule.getDb.mockReturnValue(harness.db);
  await harness.db.delete(schema.storeApiKeys);
  await harness.db.delete(schema.users);
  await harness.db.delete(schema.stores);
  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "Key E2E Store",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
});

/** Write both artifacts of one raw key, exactly as the seeder does. */
async function provision(rawKey: string) {
  const ts = NOW();
  await harness.raw
    .prepare(storeApiKeyHashStatement({ storeId: STORE_ID, rawKey, ts }))
    .run();
  await harness.raw
    .prepare(storeApiKeyPlaintextStatement({ storeId: STORE_ID, rawKey, ts }))
    .run();
}

function storeRequest(key?: string) {
  return app.request("/store/products", {
    headers: key ? { "X-Store-API-Key": key } : {},
  });
}

describe("one raw store key, provisioned as two artifacts", () => {
  it("the seeder's Node digest equals the worker's WebCrypto digest", async () => {
    // If these ever diverge, every provisioned store silently fails auth.
    const viaNode = hashStoreApiKey(STORE_KEY);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(STORE_KEY)
    );
    const viaWeb = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(viaNode).toBe(viaWeb);
    expect(viaNode).toHaveLength(64);
  });

  it("the dashboard obtains the exact plaintext key the storefront uses", async () => {
    await provision(STORE_KEY);

    expect((await getStore(harness.db))?.storeApiKey).toBe(STORE_KEY);

    const res = await app.request("/api/stores/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { storeApiKey: string | null } };
    expect(body.data.storeApiKey).toBe(STORE_KEY);
  });

  it("the storefront authenticates with that key", async () => {
    await provision(STORE_KEY);

    expect((await storeRequest(STORE_KEY)).status).toBe(200);
  });

  it("stores only the digest at rest — never the raw key", async () => {
    await provision(STORE_KEY);

    const row = await harness.db.select().from(schema.storeApiKeys).get();
    expect(row?.keyHash).toBe(hashStoreApiKey(STORE_KEY));
    expect(row?.keyHash).not.toBe(STORE_KEY);
    expect(row?.keyHash).toHaveLength(64);
  });
});

describe("credential boundaries", () => {
  it("rejects a wrong store key (401)", async () => {
    await provision(STORE_KEY);

    expect((await storeRequest("sk_store_wrong")).status).toBe(401);
  });

  it("rejects a missing key (401)", async () => {
    await provision(STORE_KEY);

    expect((await storeRequest()).status).toBe(401);
  });

  it("a dashboard/team key cannot authenticate the storefront", async () => {
    await provision(STORE_KEY);
    await harness.db.insert(schema.users).values({
      id: "team_user_001",
      name: "Notifier",
      email: "notifier@example.com",
      role: "staff",
      status: "active",
      apiKey: TEAM_KEY,
    });

    // The storefront only honours X-Store-API-Key; a valid dashboard key is
    // not a store key, so the boundary the notifier relies on holds.
    expect((await storeRequest(TEAM_KEY)).status).toBe(401);
    expect((await storeRequest(STORE_KEY)).status).toBe(200);
  });

  it("rotating the store key replaces it in place", async () => {
    await provision(STORE_KEY);
    const rotated = "sk_store_e2e_rotated";
    await provision(rotated);

    expect((await storeRequest(STORE_KEY)).status).toBe(401);
    expect((await storeRequest(rotated)).status).toBe(200);
    expect((await getStore(harness.db))?.storeApiKey).toBe(rotated);

    const rows = await harness.db.select().from(schema.storeApiKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(hashStoreApiKey(rotated));
  });
});
