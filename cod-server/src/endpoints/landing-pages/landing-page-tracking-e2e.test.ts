/**
 * The per-landing-page tracking API, on real D1 through the real route stack.
 *
 * Three endpoints and one rule that matters more than all of them: the
 * Conversions API access token goes IN and never comes back out. It is a
 * credential with spend attached — anyone holding it can write conversions
 * into the merchant's ad account.
 *
 * Auth middleware is stubbed with an admin user, as every landing-pages e2e
 * test here does; the RBAC middleware itself is covered by the route tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import landingPagesRouter from "./routes";

let harness: TestD1;
let app: OpenAPIHono<AppContext>;
const NOW = () => new Date().toISOString();
let seq = 0;

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
  app.route("/landing-pages", landingPagesRouter);
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  await harness.db.delete(schema.landingPagePixelConfig);
});

async function seedLandingPage(): Promise<string> {
  const n = ++seq;
  const productId = `prod-lpte-${n}`;
  const landingPageId = `lp-lpte-${n}`;

  await harness.db.insert(schema.products).values({
    id: productId,
    name: `Product ${n}`,
    handle: `product-lpte-${n}`,
    price: 5000,
    hasVariants: false,
    inventory: 10,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  await harness.db.insert(schema.landingPages).values({
    id: landingPageId,
    slug: `lp-lpte-${n}`,
    name: `Landing page ${n}`,
    productId,
    status: "published",
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  return landingPageId;
}

function put(id: string, body: Record<string, unknown>) {
  return app.request(`/landing-pages/${id}/tracking`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  pixelId: "1234567890",
  accessToken: "EAAG-real-token",
  conversionEvent: "Purchase",
};

describe("GET /landing-pages/:id/tracking", () => {
  it("returns null for a page that inherits the store pixel", async () => {
    const id = await seedLandingPage();

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as { success: boolean; data: { config: unknown } };

    expect(res.status).toBe(200);
    expect(body.data.config).toBeNull();
  });

  it("404s for a landing page that does not exist", async () => {
    const res = await app.request("/landing-pages/lp-nope/tracking");

    expect(res.status).toBe(404);
  });

  it("returns the configuration with the token masked, never in full", async () => {
    const id = await seedLandingPage();
    await put(id, VALID);

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const raw = await res.text();

    expect(raw).not.toContain("EAAG-real-token");
    const body = JSON.parse(raw) as { data: { config: Record<string, unknown> } };
    expect(body.data.config).toMatchObject({ pixelId: "1234567890", enabled: true });
    expect(body.data.config.accessToken).toBeUndefined();
    expect(typeof body.data.config.accessTokenMasked).toBe("string");
  });
});

describe("PUT /landing-pages/:id/tracking", () => {
  it("gives the page its own pixel", async () => {
    const id = await seedLandingPage();

    const res = await put(id, VALID);

    expect(res.status).toBe(200);
    const stored = await harness.db.select().from(schema.landingPagePixelConfig).get();
    expect(stored).toMatchObject({
      landingPageId: id,
      pixelId: "1234567890",
      accessToken: "EAAG-real-token",
    });
  });

  it("never echoes the token back, even on the write that set it", async () => {
    const id = await seedLandingPage();

    const raw = await (await put(id, VALID)).text();

    expect(raw).not.toContain("EAAG-real-token");
  });

  it("refuses to create an override without a token", async () => {
    // Pixel but no token means the browser keeps firing at that pixel with no
    // server mirror behind it — a half-configured page that quietly reports
    // worse than the store pixel it replaced.
    const id = await seedLandingPage();

    const res = await put(id, { pixelId: "1234567890", conversionEvent: "Purchase" });

    expect(res.status).toBe(400);
    expect(await harness.db.select().from(schema.landingPagePixelConfig).get()).toBeUndefined();
  });

  it("accepts an update with no token and keeps the stored one", async () => {
    // The dashboard only ever holds a masked hint, so an edit that does not
    // touch the token field must not blank it.
    const id = await seedLandingPage();
    await put(id, VALID);

    const res = await put(id, { pixelId: "9999999999", conversionEvent: "Lead" });

    expect(res.status).toBe(200);
    const stored = await harness.db.select().from(schema.landingPagePixelConfig).get();
    expect(stored).toMatchObject({
      pixelId: "9999999999",
      conversionEvent: "Lead",
      accessToken: "EAAG-real-token",
    });
  });

  it("requires the merchant to choose a conversion event", async () => {
    const id = await seedLandingPage();

    const res = await put(id, { pixelId: "1234567890", accessToken: "EAAG-x" });

    expect(res.status).toBe(400);
  });

  it("rejects a conversion event Meta does not have", async () => {
    const id = await seedLandingPage();

    const res = await put(id, { ...VALID, conversionEvent: "Subscribe" });

    expect(res.status).toBe(400);
  });

  it("404s for a landing page that does not exist", async () => {
    const res = await put("lp-nope", VALID);

    expect(res.status).toBe(404);
    expect(await harness.db.select().from(schema.landingPagePixelConfig).get()).toBeUndefined();
  });

  it("refuses test mode without a test event code", async () => {
    // Test mode with no code sends nothing to the test stream and everything
    // to production measurement — the opposite of what the merchant asked for.
    const id = await seedLandingPage();

    const res = await put(id, { ...VALID, testMode: true });

    expect(res.status).toBe(400);
  });

  it("accepts test mode with a code", async () => {
    const id = await seedLandingPage();

    const res = await put(id, { ...VALID, testMode: true, testEventCode: "TEST123" });

    expect(res.status).toBe(200);
    expect(await harness.db.select().from(schema.landingPagePixelConfig).get()).toMatchObject({
      testMode: true,
      testEventCode: "TEST123",
    });
  });
});

describe("DELETE /landing-pages/:id/tracking", () => {
  it("returns the page to the store pixel", async () => {
    const id = await seedLandingPage();
    await put(id, VALID);

    const res = await app.request(`/landing-pages/${id}/tracking`, { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(await harness.db.select().from(schema.landingPagePixelConfig).get()).toBeUndefined();
  });

  it("succeeds on a page that never had one", async () => {
    const id = await seedLandingPage();

    const res = await app.request(`/landing-pages/${id}/tracking`, { method: "DELETE" });

    expect(res.status).toBe(200);
  });

  it("404s for a landing page that does not exist", async () => {
    const res = await app.request("/landing-pages/lp-nope/tracking", { method: "DELETE" });

    expect(res.status).toBe(404);
  });
});

describe("the landing pages list", () => {
  it("says which pages have their own pixel, so twenty can be scanned at once", async () => {
    const plain = await seedLandingPage();
    const overridden = await seedLandingPage();
    await put(overridden, { ...VALID, pixelId: "7070707070", conversionEvent: "Lead" });

    const res = await app.request("/landing-pages");
    const body = (await res.json()) as {
      data: Array<{ id: string; tracking: Record<string, unknown> | null }>;
    };
    const rows = new Map(body.data.map((row) => [row.id, row.tracking]));

    expect(rows.get(plain)).toBeNull();
    expect(rows.get(overridden)).toMatchObject({
      pixelId: "7070707070",
      conversionEvent: "Lead",
      enabled: true,
      testMode: false,
    });
  });

  it("never carries an access token in the list payload", async () => {
    // The list is the widest tracking read in the dashboard. A careless join
    // here would ship every page's credential in one response.
    const id = await seedLandingPage();
    await put(id, VALID);

    const raw = await (await app.request("/landing-pages")).text();

    expect(raw).not.toContain("EAAG-real-token");
    expect(raw).not.toContain("accessToken");
  });
});

describe("proof that it is working", () => {
  async function seedSentEvent(
    landingPageId: string | null,
    row: Partial<typeof schema.capiEventLog.$inferInsert> = {},
  ) {
    const n = ++seq;
    const customerId = `cust-act-${n}`;
    const orderId = `order-act-${n}`;
    await harness.db.insert(schema.customers).values({
      id: customerId,
      name: "Karim Benali",
      phone: `05530000${String(n).padStart(2, "0")}`,
      wilaya: "Alger",
      createdAt: NOW(),
    });
    await harness.db.insert(schema.orders).values({
      id: orderId,
      orderNumber: `ORD-ACT-${n}`,
      customerId,
      customerName: "Karim Benali",
      phone: `05530000${String(n).padStart(2, "0")}`,
      price: 5000,
      deliveryFee: 600,
      landingPageId,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    await harness.db.insert(schema.capiEventLog).values({
      id: `capi-act-${n}`,
      orderId,
      eventName: "Purchase",
      stage: "delivered",
      status: "sent",
      pixelId: "7070707070",
      sentAt: NOW(),
      ...row,
    });
    return orderId;
  }

  it("reports nothing for a page that has never sent an event", async () => {
    const id = await seedLandingPage();
    await put(id, VALID);

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as { data: { lastEvent: unknown } };

    expect(body.data.lastEvent).toBeNull();
  });

  it("reports the last event this page sent, and where it went", async () => {
    // "I pointed a campaign at a new pixel — is it working?" answered without
    // opening Meta.
    const id = await seedLandingPage();
    await put(id, VALID);
    await seedSentEvent(id);

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as {
      data: { lastEvent: { status: string; pixelId: string; eventName: string } };
    };

    expect(body.data.lastEvent).toMatchObject({
      status: "sent",
      pixelId: "7070707070",
      eventName: "Purchase",
    });
  });

  it("reports the most recent event, not the first one it ever sent", async () => {
    // "Last event" is the whole point: a merchant who just fixed a rejected
    // token needs to see the fix land, not the failure that prompted it. A
    // mutation proved no other test here distinguished newest from oldest.
    const id = await seedLandingPage();
    await put(id, VALID);
    await seedSentEvent(id, {
      status: "failed",
      error: "Invalid OAuth access token",
      sentAt: "2026-01-01T00:00:00.000Z",
    });
    await seedSentEvent(id, { status: "sent", sentAt: "2026-06-01T00:00:00.000Z" });

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as { data: { lastEvent: { status: string } } };

    expect(body.data.lastEvent).toMatchObject({ status: "sent" });
  });

  it("reports a failure with Meta's own message", async () => {
    // A silent "nothing yet" when Meta rejected the token is the worst of
    // both worlds — the merchant waits instead of fixing it.
    const id = await seedLandingPage();
    await put(id, VALID);
    await seedSentEvent(id, {
      status: "failed",
      error: "Invalid OAuth access token",
    });

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as {
      data: { lastEvent: { status: string; error: string } };
    };

    expect(body.data.lastEvent).toMatchObject({
      status: "failed",
      error: "Invalid OAuth access token",
    });
  });

  it("reports this page's events, not another page's", async () => {
    const mine = await seedLandingPage();
    const theirs = await seedLandingPage();
    await put(mine, VALID);
    await seedSentEvent(theirs, { pixelId: "9999999999" });

    const res = await app.request(`/landing-pages/${mine}/tracking`);
    const body = (await res.json()) as { data: { lastEvent: unknown } };

    expect(body.data.lastEvent).toBeNull();
  });

  it("reports activity even for a page that inherits the store pixel", async () => {
    // A page with no override still sells, and the merchant still wants to
    // know its events are landing. An empty box would read as "broken".
    const id = await seedLandingPage();
    await seedSentEvent(id, { pixelId: "1111111111" });

    const res = await app.request(`/landing-pages/${id}/tracking`);
    const body = (await res.json()) as {
      data: { config: unknown; lastEvent: { pixelId: string } };
    };

    expect(body.data.config).toBeNull();
    expect(body.data.lastEvent).toMatchObject({ pixelId: "1111111111" });
  });
});
