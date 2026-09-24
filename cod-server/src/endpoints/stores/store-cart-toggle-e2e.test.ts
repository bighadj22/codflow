/**
 * The merchant cart switch — real-D1 E2E.
 *
 * One boolean, but it is the switch that decides whether a merchant's
 * storefront grows a cart at all, so the guarantees are worth pinning:
 *
 *  1. It defaults to OFF. A store row written before this feature existed —
 *     which is every store in production today — must read as disabled. That
 *     is the whole "nobody sees a change" promise, and a migration default is
 *     exactly the kind of thing that is assumed rather than checked.
 *  2. It survives a round trip through the real update path.
 *  3. The storefront config exposes it, because that is how the theme decides
 *     whether to render a cart at all.
 *  4. Toggling it changes nothing else about the store.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getStoreConfig } from "../../../../cod-shared/queries/store";
import { updateStore } from "../../../../cod-shared/queries/stores";
import { updateStoreSchema } from "./validation";

const registry: Miniflare[] = [];
let db: AppDb;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "cart-toggle-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const prepared: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) prepared.push(d1.prepare(statement));
  }
  for (let i = 0; i < prepared.length; i += 50) {
    await d1.batch(prepared.slice(i, i + 50));
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;
});

beforeEach(async () => {
  await db.delete(schema.stores);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

const now = () => new Date().toISOString();
const uid = () => `store-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Insert a store the way a pre-cart deployment would have: naming only the
 * columns that existed before, so the new one takes its migration default
 * rather than a value this test chose.
 */
async function seedLegacyStore() {
  const id = uid();
  await db.run(sql`
    INSERT INTO stores (id, name, theme_id, primary_color, accent_color, bg_color,
                        font_family, lang, currency, currency_symbol,
                        reviews_enabled, cart_shipping_mode, status, created_at, updated_at)
    VALUES (${id}, 'Legacy Store', 'theme01', '#7c3aed', '#f59e0b', '#f8f8f8',
            'Cairo, sans-serif', 'ar', 'DZD', 'دج',
            1, 'highest', 'active', ${now()}, ${now()})
  `);
  return id;
}

// ─── Default-off guarantee ────────────────────────────────────────────────────

describe("cart switch — defaults to off", () => {
  it("a store written without the column reads as cart-disabled", async () => {
    // This is the production case: every existing store predates the column.
    const id = await seedLegacyStore();

    const row = await db.select().from(schema.stores).where(eq(schema.stores.id, id)).get();
    expect(row!.cartEnabled).toBe(false);
  });

  it("the storefront config reports the cart off for such a store", async () => {
    const id = await seedLegacyStore();

    const config = await getStoreConfig(db, id);
    expect(config!.cartEnabled).toBe(false);
  });

  it("leaves every other setting on a legacy store untouched", async () => {
    // A merchant who never opens Settings must see NOTHING change.
    const id = await seedLegacyStore();

    const config = await getStoreConfig(db, id);
    expect(config).toMatchObject({
      reviewsEnabled: true,
      status: "active",
      lang: "ar",
      freeShippingThreshold: null,
      cartShippingMode: "highest",
    });
  });
});

// ─── Turning it on and off ────────────────────────────────────────────────────

describe("cart switch — round trip through the update path", () => {
  it("turns on and is visible to the storefront", async () => {
    const id = await seedLegacyStore();

    await updateStore(db, id, { cartEnabled: true });

    expect((await getStoreConfig(db, id))!.cartEnabled).toBe(true);
  });

  it("turns back off again", async () => {
    const id = await seedLegacyStore();

    await updateStore(db, id, { cartEnabled: true });
    await updateStore(db, id, { cartEnabled: false });

    expect((await getStoreConfig(db, id))!.cartEnabled).toBe(false);
  });

  it("is not disturbed by an unrelated settings save", async () => {
    // Saving the reviews panel must not silently switch the cart off.
    const id = await seedLegacyStore();
    await updateStore(db, id, { cartEnabled: true });

    await updateStore(db, id, { reviewsEnabled: false });

    const config = await getStoreConfig(db, id);
    expect(config!.cartEnabled).toBe(true);
    expect(config!.reviewsEnabled).toBe(false);
  });

  it("does not disturb the delivery pricing settings", async () => {
    const id = await seedLegacyStore();
    await updateStore(db, id, {
      freeShippingThreshold: 10_000,
      cartShippingMode: "default_profile",
    });

    await updateStore(db, id, { cartEnabled: true });

    const config = await getStoreConfig(db, id);
    expect(config).toMatchObject({
      cartEnabled: true,
      freeShippingThreshold: 10_000,
      cartShippingMode: "default_profile",
    });
  });
});

// ─── The write contract ───────────────────────────────────────────────────────

describe("cart switch — accepted values", () => {
  it("accepts a boolean", () => {
    expect(updateStoreSchema.safeParse({ cartEnabled: true }).success).toBe(true);
    expect(updateStoreSchema.safeParse({ cartEnabled: false }).success).toBe(true);
  });

  it("rejects a string, so 'false' can never read as true", () => {
    // A form posting the string "false" is truthy in JS; the schema has to be
    // the thing that refuses it.
    expect(updateStoreSchema.safeParse({ cartEnabled: "false" }).success).toBe(false);
    expect(updateStoreSchema.safeParse({ cartEnabled: "true" }).success).toBe(false);
  });

  it("rejects a number", () => {
    expect(updateStoreSchema.safeParse({ cartEnabled: 1 }).success).toBe(false);
    expect(updateStoreSchema.safeParse({ cartEnabled: 0 }).success).toBe(false);
  });

  it("rejects null — omit the field to leave it unchanged", () => {
    expect(updateStoreSchema.safeParse({ cartEnabled: null }).success).toBe(false);
  });

  it("is optional, so saves that do not mention it are valid", () => {
    expect(updateStoreSchema.safeParse({ name: "Shop" }).success).toBe(true);
  });
});
