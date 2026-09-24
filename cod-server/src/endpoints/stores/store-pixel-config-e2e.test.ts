/**
 * The store tracking settings, through the real route stack onto real D1.
 *
 * `routes.test.ts` mocks the query layer, so it proves the handler was called
 * — never that what the merchant typed survived to the database. That gap hid
 * a real bug: the per-page tracking switch came back off after every save,
 * because the ROUTE declared its own body schema that had never gained the
 * field, and Zod strips unknown keys before a handler ever sees them
 * (root AGENTS.md lists this trap for the storefront proxies; it applies to
 * every `defineRoute` body just the same).
 *
 * These tests drive the real schema, the real upsert and a real database, so
 * a field that exists in the UI but not in the route contract fails here.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import storesRouter from "./routes";

const dbModule = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db", () => dbModule);

let harness: TestD1;
let app: OpenAPIHono<AppContext>;
const NOW = () => new Date().toISOString();
const STORE_ID = "store-spc";

beforeAll(async () => {
  harness = await createTestD1();

  app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: harness.raw } as never;
    c.set("user", {
      id: "admin_user_001",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      status: "active",
      apiKey: "cod_admin_key",
      scopes: ["*"],
    } as never);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/stores", storesRouter);
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  dbModule.getDb.mockReturnValue(harness.db);
  await harness.db.delete(schema.storePixelConfig);
  await harness.db.delete(schema.stores);
  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "Test Store",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
});

const VALID = {
  pixelId: "1234567890",
  accessToken: "EAAG-real-token",
  conversionEvent: "Purchase",
};

function save(body: Record<string, unknown>) {
  return app.request("/api/stores/pixel-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function storedRow() {
  return harness.db.select().from(schema.storePixelConfig).get();
}

async function read() {
  const res = await app.request("/api/stores/pixel-config");
  return (await res.json()) as { data: Record<string, unknown> | null };
}

describe("saving the store's tracking settings", () => {
  it("stores the per-page tracking switch the merchant turned on", async () => {
    // The bug: this came back off every time. The switch is the whole
    // feature's gate, so a save that silently drops it makes every
    // per-landing-page pixel inert with no error anywhere.
    const res = await save({ ...VALID, perPageTrackingEnabled: true });

    expect(res.status).toBe(200);
    expect((await storedRow())?.perPageTrackingEnabled).toBe(true);
  });

  it("reads the switch back as on", async () => {
    await save({ ...VALID, perPageTrackingEnabled: true });

    expect((await read()).data?.perPageTrackingEnabled).toBe(true);
  });

  it("turns the switch back off — the feature's rollback", async () => {
    await save({ ...VALID, perPageTrackingEnabled: true });

    await save({ ...VALID, perPageTrackingEnabled: false });

    expect((await storedRow())?.perPageTrackingEnabled).toBe(false);
  });

  it("keeps the switch when an unrelated setting is edited", async () => {
    // Renaming an ad account must not silently return every landing page to
    // the store pixel.
    await save({ ...VALID, perPageTrackingEnabled: true });

    await save({ ...VALID, adAccountName: "Renamed" });

    expect((await storedRow())?.perPageTrackingEnabled).toBe(true);
  });

  it("defaults to off for a store configuring tracking for the first time", async () => {
    await save(VALID);

    expect((await storedRow())?.perPageTrackingEnabled).toBe(false);
  });

  it("stores every other field the merchant typed", async () => {
    // The same stripping bug would silently drop any of these.
    await save({
      ...VALID,
      adAccountName: "Zinc Ads",
      testMode: true,
      testEventCode: "TEST123",
      conversionEvent: "Purchase_Delivered",
      perPageTrackingEnabled: true,
    });

    expect(await storedRow()).toMatchObject({
      pixelId: "1234567890",
      accessToken: "EAAG-real-token",
      adAccountName: "Zinc Ads",
      testMode: true,
      testEventCode: "TEST123",
      conversionEvent: "Purchase_Delivered",
      perPageTrackingEnabled: true,
    });
  });

  it("never returns the access token", async () => {
    await save(VALID);

    const res = await app.request("/api/stores/pixel-config");
    const raw = await res.text();

    expect(raw).not.toContain("EAAG-real-token");
    expect(raw).toContain("accessTokenMasked");
  });
});
