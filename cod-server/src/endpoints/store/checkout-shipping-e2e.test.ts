/**
 * Storefront delivery-fee resolution — real-D1 E2E.
 *
 * Locks two rules that the schema documents but the checkout path did not
 * honour before this suite existed:
 *
 *   1. Commune-level overrides win over the wilaya rule.
 *      `shipping_rule_communes` is a sparse table: a NULL column means
 *      "inherit from the wilaya rule", a value means "override it". The
 *      resolution formula is documented on the table itself
 *      (cod-shared/db/schema.ts) and was only ever implemented in the
 *      dashboard CRUD — storefront checkout stopped at the wilaya rule, so
 *      every commune override a merchant configured was silently ignored.
 *
 *   2. A product's own shipping profile wins over the store default.
 *      `products.shipping_profile_id` is settable from the dashboard and
 *      documented as "orders of this product use this profile for
 *      deliveryFee resolution". Checkout read the default profile
 *      unconditionally, so the column had no effect on a real order.
 *
 * Both rules are merchant-money behaviour: the fee resolved here is what the
 * customer is charged and what the driver collects.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { resolveDeliveryFee } from "../../../../cod-shared/queries/shipping-resolution";

const registry: Miniflare[] = [];
let db: AppDb;

const WILAYA = 16;
const OTHER_WILAYA = 31;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const preparedStatements: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) {
      preparedStatements.push(d1.prepare(statement));
    }
  }
  for (let i = 0; i < preparedStatements.length; i += 50) {
    await d1.batch(preparedStatements.slice(i, i + 50));
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;
  // The 58 wilayas are reference data seeded by the migrations themselves.
});

/**
 * Full reset between cases. `isDefault` is not unique in the schema, so a
 * leaked default profile from a previous case would be picked up
 * non-deterministically by the resolver and make these tests lie.
 */
beforeEach(async () => {
  await db.delete(schema.stores);
  await db.delete(schema.shippingRuleCommunes);
  await db.delete(schema.shippingRules);
  await db.delete(schema.shippingProfiles);
  await db.delete(schema.products);
  await db.delete(schema.communes);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

async function seedProfile(opts: {
  isDefault: boolean;
  homePrice: number;
  stopDeskPrice?: number;
  wilayaId?: number;
  homeEnabled?: boolean;
  stopDeskEnabled?: boolean;
}) {
  const profileId = uid("prof");
  const ruleId = uid("rule");
  await db.insert(schema.shippingProfiles).values({
    id: profileId,
    name: `Profile ${profileId}`,
    isDefault: opts.isDefault,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.insert(schema.shippingRules).values({
    id: ruleId,
    profileId,
    wilayaId: opts.wilayaId ?? WILAYA,
    homePrice: opts.homePrice,
    stopDeskPrice: opts.stopDeskPrice ?? opts.homePrice - 100,
    homeEnabled: opts.homeEnabled ?? true,
    stopDeskEnabled: opts.stopDeskEnabled ?? true,
    createdAt: now(),
  });
  return { profileId, ruleId };
}

async function seedCommune(wilayaId = WILAYA) {
  const id = uid("com");
  await db.insert(schema.communes).values({
    id,
    wilayaId,
    name: "Test Commune",
    nameAr: "بلدية",
  });
  return id;
}

async function seedProduct(shippingProfileId: string | null) {
  const id = uid("prod");
  await db.insert(schema.products).values({
    id,
    name: "Shipping Fixture",
    handle: `handle-${id}`,
    price: 5000,
    hasVariants: false,
    inventory: 50,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    shippingProfileId,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function overrideCommune(
  ruleId: string,
  communeId: string,
  values: Partial<typeof schema.shippingRuleCommunes.$inferInsert>,
) {
  await db.insert(schema.shippingRuleCommunes).values({
    id: uid("src"),
    ruleId,
    communeId,
    homePrice: null,
    stopDeskPrice: null,
    homeEnabled: null,
    stopDeskEnabled: null,
    ...values,
  });
}

// ─── Rule 1: commune overrides ────────────────────────────────────────────────

describe("resolveDeliveryFee — commune-level overrides", () => {
  it("prefers the commune override price over the wilaya rule price", async () => {
    const { ruleId } = await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { homePrice: 400 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(400);
  });

  it("inherits the wilaya price when the override column is NULL", async () => {
    const { ruleId } = await seedProfile({
      isDefault: true,
      homePrice: 900,
      stopDeskPrice: 650,
    });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    // Overrides home only — stop-desk must still inherit 650.
    await overrideCommune(ruleId, communeId, { homePrice: 300 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "stop_desk",
      }),
    ).resolves.toBe(650);
  });

  it("refuses delivery when the commune disables the requested type", async () => {
    const { ruleId } = await seedProfile({ isDefault: true, homePrice: 700 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { homeEnabled: false });

    // null = "delivery not available" — the caller refuses the order rather
    // than shipping for free (same contract as the previous getDeliveryFee).
    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBeNull();
  });

  it("re-enables a type the wilaya rule disabled when the commune says so", async () => {
    const { ruleId } = await seedProfile({
      isDefault: true,
      homePrice: 700,
      stopDeskPrice: 500,
      stopDeskEnabled: false,
    });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { stopDeskEnabled: true });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "stop_desk",
      }),
    ).resolves.toBe(500);
  });

  it("falls back to the wilaya rule when the commune has no override row", async () => {
    await seedProfile({ isDefault: true, homePrice: 1100 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(1100);
  });

  it("falls back to the wilaya rule when no communeId is supplied", async () => {
    const { ruleId } = await seedProfile({ isDefault: true, homePrice: 1100 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { homePrice: 400 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId: null,
        deliveryType: "home",
      }),
    ).resolves.toBe(1100);
  });
});

// ─── Rule 2: product-level shipping profile ───────────────────────────────────

describe("resolveDeliveryFee — product-level shipping profile", () => {
  it("uses the product's own profile instead of the store default", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const productId = await seedProduct(heavy.profileId);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(1500);
  });

  it("applies commune overrides inside the product's own profile", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const productId = await seedProduct(heavy.profileId);
    await overrideCommune(heavy.ruleId, communeId, { homePrice: 1200 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(1200);
  });

  it("falls back to the default profile when the product has none", async () => {
    await seedProfile({ isDefault: true, homePrice: 950 });
    await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(950);
  });

  it("refuses delivery when the product's profile has no rule for the wilaya", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    // Profile covers OTHER_WILAYA only — nothing for WILAYA.
    const limited = await seedProfile({
      isDefault: false,
      homePrice: 1500,
      wilayaId: OTHER_WILAYA,
    });
    const communeId = await seedCommune();
    const productId = await seedProduct(limited.profileId);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBeNull();
  });

  it("cannot hold a dangling profile reference — the FK forbids it", async () => {
    // Documents why resolveDeliveryFee does not verify the product's profile
    // exists: D1 enforces the foreign key, so the state it would guard against
    // is unwritable. Deleting a profile sets the column to NULL instead.
    // D1 surfaces the constraint in the error's cause chain; that the write is
    // rejected at all is the guarantee this test exists to record.
    await expect(seedProduct("prof-deleted")).rejects.toThrow();
  });

  it("degrades to the default profile after its profile is deleted", async () => {
    const def = await seedProfile({ isDefault: true, homePrice: 950 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const productId = await seedProduct(heavy.profileId);

    await db
      .delete(schema.shippingProfiles)
      .where(eq(schema.shippingProfiles.id, heavy.profileId));

    // ON DELETE SET NULL nulls the column, so the default takes over and the
    // order stays placeable.
    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(950);
    expect(def.profileId).toBeTruthy();
  });
});

// ─── Contracts inherited from the previous getDeliveryFee ─────────────────────

describe("resolveDeliveryFee — inherited contracts", () => {
  it("returns 0 when the store has no shipping profile at all", async () => {
    // Fresh store, nothing configured: mirrors the documented
    // "no profile, no restriction" semantics — NOT a refusal.
    const communeId = await seedCommune();
    const productId = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(0);
  });

  it("refuses delivery when the wilaya has no rule in the default profile", async () => {
    await seedProfile({
      isDefault: true,
      homePrice: 800,
      wilayaId: OTHER_WILAYA,
    });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBeNull();
  });

  it("refuses delivery when the wilaya rule disables the requested type", async () => {
    await seedProfile({
      isDefault: true,
      homePrice: 800,
      stopDeskEnabled: false,
    });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "stop_desk",
      }),
    ).resolves.toBeNull();
  });
});

// ─── Q1: a basket spanning two profiles ───────────────────────────────────────

describe("resolveDeliveryFee — mixed basket (Q1: highest rate wins)", () => {
  it("charges the dearest applicable rate, not the default", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);          // default profile → 800
    const fridge = await seedProduct(heavy.profileId); // heavy profile → 1500

    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge],
        wilayaId: WILAYA,
        communeId,
        deliveryType: "home",
      }),
    ).resolves.toBe(1500);
  });

  it("gives the same answer whatever order the basket is in", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);

    const forwards = await resolveDeliveryFee(db, {
      productIds: [shirt, fridge], wilayaId: WILAYA, communeId, deliveryType: "home",
    });
    const backwards = await resolveDeliveryFee(db, {
      productIds: [fridge, shirt], wilayaId: WILAYA, communeId, deliveryType: "home",
    });
    expect(forwards).toBe(backwards);
  });

  it("an all-default basket is unchanged", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const a = await seedProduct(null);
    const b = await seedProduct(null);

    await expect(
      resolveDeliveryFee(db, {
        productIds: [a, b], wilayaId: WILAYA, communeId, deliveryType: "home",
      }),
    ).resolves.toBe(800);
  });

  it("compares rates AFTER commune overrides, not before", async () => {
    // The 'heavy' profile is dearer at wilaya level (1500 vs 800), but this
    // commune discounts it to 500 — so the default's 800 is now the highest.
    const def = await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);
    await overrideCommune(heavy.ruleId, communeId, { homePrice: 500 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge], wilayaId: WILAYA, communeId, deliveryType: "home",
      }),
    ).resolves.toBe(800);
    expect(def.profileId).toBeTruthy();
  });

  it("refuses the basket when ONE product cannot be delivered here", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    // Heavy goods are not carried to this wilaya at all.
    const heavy = await seedProfile({
      isDefault: false, homePrice: 1500, wilayaId: OTHER_WILAYA,
    });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);

    // Shipping the shirt and silently dropping the fridge would be worse.
    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge], wilayaId: WILAYA, communeId, deliveryType: "home",
      }),
    ).resolves.toBeNull();
  });

  it("refuses when one product's commune disables the delivery type", async () => {
    const def = await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);
    await overrideCommune(heavy.ruleId, communeId, { homeEnabled: false });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge], wilayaId: WILAYA, communeId, deliveryType: "home",
      }),
    ).resolves.toBeNull();
    expect(def.profileId).toBeTruthy();
  });

  it("charges 0 only when every applicable rate is genuinely 0", async () => {
    await seedProfile({ isDefault: true, homePrice: 0 });
    const other = await seedProfile({ isDefault: false, homePrice: 0 });
    const communeId = await seedCommune();
    const a = await seedProduct(null);
    const b = await seedProduct(other.profileId);

    // 0 is a real price (free delivery), not "unavailable".
    await expect(
      resolveDeliveryFee(db, {
        productIds: [a, b], wilayaId: WILAYA, communeId, deliveryType: "home",
      }),
    ).resolves.toBe(0);
  });
});

// ─── Q2: the store's free-delivery threshold ──────────────────────────────────

async function seedStore(settings: {
  freeShippingThreshold?: number | null;
  cartShippingMode?: "highest" | "default_profile";
} = {}) {
  const id = uid("store");
  await db.insert(schema.stores).values({
    id,
    name: "Test Store",
    freeShippingThreshold: settings.freeShippingThreshold ?? null,
    cartShippingMode: settings.cartShippingMode ?? "highest",
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

describe("resolveDeliveryFee — free-delivery threshold", () => {
  it("charges the normal fee below the threshold", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 10_000 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 9_999,
      }),
    ).resolves.toBe(800);
  });

  it("is free exactly ON the threshold", async () => {
    // "free delivery over 10,000" must include 10,000 to a shopper reading it.
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 10_000 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 10_000,
      }),
    ).resolves.toBe(0);
  });

  it("is free above the threshold", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 10_000 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 50_000,
      }),
    ).resolves.toBe(0);
  });

  it("is inert when the merchant has not set one", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: null });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 1_000_000,
      }),
    ).resolves.toBe(800);
  });

  it("a threshold of 0 does NOT make everything free (R13)", async () => {
    // The API rejects 0, but if one ever reached the column it must read as
    // "off", never as "free for everyone".
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 0 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 1,
      }),
    ).resolves.toBe(800);
  });

  it("is skipped when no subtotal is supplied", async () => {
    // Callers without basket context must not get free delivery by omission.
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 1 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId,
      }),
    ).resolves.toBe(800);
  });

  it("does NOT make an unserved wilaya free — unavailable outranks free", async () => {
    // The most dangerous interaction: a huge basket must not turn "we do not
    // deliver there" into "we deliver there for nothing".
    await seedProfile({ isDefault: true, homePrice: 800, wilayaId: OTHER_WILAYA });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ freeShippingThreshold: 10_000 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 999_999,
      }),
    ).resolves.toBeNull();
  });

  it("does NOT override a commune that disabled the delivery type", async () => {
    const { ruleId } = await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { homeEnabled: false });
    const storeId = await seedStore({ freeShippingThreshold: 10 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 50_000,
      }),
    ).resolves.toBeNull();
  });

  it("beats the highest-rate rule on a mixed basket", async () => {
    // Threshold is applied last, so it wins over whatever the profiles said.
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const a = await seedProduct(null);
    const b = await seedProduct(heavy.profileId);
    const storeId = await seedStore({ freeShippingThreshold: 10_000 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [a, b], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId, subtotal: 20_000,
      }),
    ).resolves.toBe(0);
  });

  it("is ignored when no storeId is supplied", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await seedStore({ freeShippingThreshold: 1 });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", subtotal: 50_000,
      }),
    ).resolves.toBe(800);
  });
});

// ─── Q1 as a setting: cartShippingMode ────────────────────────────────────────

describe("resolveDeliveryFee — cartShippingMode setting", () => {
  it("'highest' (default) charges the dearest rate in the basket", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);
    const storeId = await seedStore({ cartShippingMode: "highest" });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId,
      }),
    ).resolves.toBe(1500);
  });

  it("'default_profile' ignores per-product profiles entirely", async () => {
    await seedProfile({ isDefault: true, homePrice: 800 });
    const heavy = await seedProfile({ isDefault: false, homePrice: 1500 });
    const communeId = await seedCommune();
    const shirt = await seedProduct(null);
    const fridge = await seedProduct(heavy.profileId);
    const storeId = await seedStore({ cartShippingMode: "default_profile" });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [shirt, fridge], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId,
      }),
    ).resolves.toBe(800);
  });

  it("'default_profile' still refuses a wilaya the default does not serve", async () => {
    await seedProfile({ isDefault: true, homePrice: 800, wilayaId: OTHER_WILAYA });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const storeId = await seedStore({ cartShippingMode: "default_profile" });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId,
      }),
    ).resolves.toBeNull();
  });

  it("'default_profile' still honours commune overrides", async () => {
    const { ruleId } = await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    await overrideCommune(ruleId, communeId, { homePrice: 300 });
    const storeId = await seedStore({ cartShippingMode: "default_profile" });

    await expect(
      resolveDeliveryFee(db, {
        productIds: [productId], wilayaId: WILAYA, communeId,
        deliveryType: "home", storeId,
      }),
    ).resolves.toBe(300);
  });

  it("both modes agree on a single-product order", async () => {
    // The setting only bites once a basket spans profiles; it must never
    // change what an ordinary one-product order costs.
    await seedProfile({ isDefault: true, homePrice: 800 });
    const communeId = await seedCommune();
    const productId = await seedProduct(null);
    const highest = await seedStore({ cartShippingMode: "highest" });
    const fixed = await seedStore({ cartShippingMode: "default_profile" });

    const a = await resolveDeliveryFee(db, {
      productIds: [productId], wilayaId: WILAYA, communeId,
      deliveryType: "home", storeId: highest,
    });
    const b = await resolveDeliveryFee(db, {
      productIds: [productId], wilayaId: WILAYA, communeId,
      deliveryType: "home", storeId: fixed,
    });
    expect(a).toBe(b);
    expect(a).toBe(800);
  });
});
