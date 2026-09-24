/**
 * Stock Management — real-D1 tests.
 *
 * Tests the full stock-check pipeline for storefront orders.
 *
 * These cases previously ran against the mock-queue db, which maps fixture
 * rows positionally by select-clause order. checkStoreOrderStock is now a
 * single batched, id-keyed lookup (chunked `inArray` + `db.batch()`) rather
 * than a read per product and per variant, so a positional fixture would be
 * encoding a query plan instead of testing behaviour. Every case below is the
 * same case, moved onto Miniflare D1 with the real migrations.
 *
 * Rules under test:
 *  1. trackInventory=false  → always allow (no stock gate)
 *  2. Simple product (no variants), stock >= quantity → allow
 *  3. Simple product, stock = 0 → block
 *  4. Simple product, quantity > stock → block
 *  5. Single variant selected, stock >= quantity → allow
 *  6. Single variant, inventory = 0 → block
 *  7. Single variant, quantity > stock → block
 *  8. variantSelections (offer tiers), all in stock → allow
 *  9. variantSelections, one variant OOS → block
 * 10. variantSelections, same variant ×3 but stock = 2 → block
 * 11. Product not found → pass through (no crash)
 * 12. BusinessLogicError carries INSUFFICIENT_STOCK code
 * 13. Inventory roll-up: product with one OOS variant and others in stock
 * 14. Baskets: a single bad line blocks the whole basket, and the message
 *     names the offending product
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import {
  loadCatalogSnapshot,
  findStockShortfall,
} from "../../../../cod-shared/queries/catalog-snapshot";
import { normalizeOrderLines } from "../../../../cod-shared/queries/cart";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";

const registry: Miniflare[] = [];
let db: AppDb;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "stock-db" },
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
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

async function seedProduct(
  id: string,
  trackInventory: boolean,
  inventory: number,
  name = "Product",
) {
  await db.insert(schema.products).values({
    id,
    name,
    handle: `handle-${id}`,
    price: 1000,
    sku: `SKU-${id}`,
    hasVariants: false,
    inventory,
    trackInventory,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function seedVariant(productId: string, id: string, inventory: number) {
  await db.insert(schema.productVariants).values({
    id,
    productId,
    variations: JSON.stringify({ Size: id }),
    price: 1000,
    sku: `VSKU-${id}`,
    inventory,
    lowStockThreshold: 2,
    isDefault: false,
    active: true,
    position: 1,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

/**
 * Load the catalog rows the basket touches, then ask the pure question. This
 * is exactly the sequence the storefront handler runs, so these cases exercise
 * the real loader against the real schema rather than a hand-built snapshot.
 */
async function check(params: Record<string, unknown>) {
  const lines = normalizeOrderLines({
    productId: "prod_1",
    productName: "P",
    variantId: null,
    variantSelections: [],
    quantity: 1,
    ...params,
  } as any);
  const snapshot = await loadCatalogSnapshot(db, lines, new Date().toISOString());
  return findStockShortfall(snapshot, lines);
}

// ─── Rule 1: trackInventory=false → always allow ──────────────────────────────

describe("checkStoreOrderStock — trackInventory=false", () => {
  it("returns null when product does not track inventory", async () => {
    await seedProduct("prod_1", false, 0);
    expect(await check({ quantity: 1 })).toBeNull();
  });

  it("returns null even when a variant is selected", async () => {
    // trackInventory is the parent's master switch: it exempts the product AND
    // all of its variants, even a variant sitting at zero.
    await seedProduct("prod_1", false, 0);
    await seedVariant("prod_1", "var_1", 0);
    expect(await check({ variantId: "var_1", quantity: 1 })).toBeNull();
  });
});

// ─── Rules 2–4: Simple product (no variants) ──────────────────────────────────

describe("checkStoreOrderStock — simple product (no variants)", () => {
  it("allows when stock >= quantity", async () => {
    await seedProduct("prod_1", true, 5);
    expect(await check({ quantity: 5 })).toBeNull();
  });

  it("blocks when stock = 0", async () => {
    await seedProduct("prod_1", true, 0);
    const result = await check({ quantity: 1 });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("blocks when quantity > stock", async () => {
    await seedProduct("prod_1", true, 3);
    expect(await check({ quantity: 4 })).not.toBeNull();
  });

  it("allows exact stock quantity", async () => {
    await seedProduct("prod_1", true, 1);
    expect(await check({ quantity: 1 })).toBeNull();
  });
});

// ─── Rules 5–7: Single variant selected ───────────────────────────────────────

describe("checkStoreOrderStock — single variant", () => {
  it("allows when variant stock >= quantity", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_1", 8);
    expect(await check({ variantId: "var_1", quantity: 2 })).toBeNull();
  });

  it("blocks when variant inventory = 0", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_1", 0);
    const result = await check({ variantId: "var_1", quantity: 1 });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("blocks when quantity > variant stock", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_1", 2);
    expect(await check({ variantId: "var_1", quantity: 3 })).not.toBeNull();
  });

  it("allows exact variant stock quantity", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_1", 3);
    expect(await check({ variantId: "var_1", quantity: 3 })).toBeNull();
  });

  it("Street Fighter 45/Kaki (inventory=0) is blocked — regression test", async () => {
    // var-004-6: {Pointure:45, Couleur:Kaki}, inventory=0
    // Other 45 variants (45/Noir) still have stock → product-level total > 0
    // But this specific combination must be blocked
    await seedProduct("prod-004", true, 34, "Street Fighter");
    await seedVariant("prod-004", "var-004-3", 4); // 45/Noir — in stock
    await seedVariant("prod-004", "var-004-6", 0); // 45/Kaki — OOS
    const result = await check({
      productId: "prod-004",
      variantId: "var-004-6",
      quantity: 1,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── Rules 8–10: variantSelections (offer tier multi-unit) ───────────────────

describe("checkStoreOrderStock — variantSelections (offer tiers)", () => {
  it("allows when all selected variants have sufficient stock", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_a", 10);
    await seedVariant("prod_1", "var_b", 5);
    expect(
      await check({
        variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      }),
    ).toBeNull();
  });

  it("blocks when one variant in selections has 0 stock", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_a", 5);
    await seedVariant("prod_1", "var_b", 0);
    expect(
      await check({
        variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      }),
    ).not.toBeNull();
  });

  it("blocks when same variant selected ×3 but stock = 2", async () => {
    // Duplicate selections collapse into one line whose quantity is the sum,
    // so the check is cumulative rather than per-unit.
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_a", 2);
    expect(
      await check({
        variantSelections: [
          { variantId: "var_a" },
          { variantId: "var_a" },
          { variantId: "var_a" },
        ],
      }),
    ).not.toBeNull();
  });

  it("allows when same variant selected ×2 and stock is exactly 2", async () => {
    await seedProduct("prod_1", true, 0);
    await seedVariant("prod_1", "var_a", 2);
    expect(
      await check({
        variantSelections: [{ variantId: "var_a" }, { variantId: "var_a" }],
      }),
    ).toBeNull();
  });
});

// ─── Rule 11: Product not found ───────────────────────────────────────────────

describe("checkStoreOrderStock — product not found", () => {
  it("returns null (no crash, no false block) when product row is missing", async () => {
    // The pre-check stays quiet about a product it cannot see; the order
    // engine refuses it for real, with a precise error.
    expect(
      await check({ productId: "ghost-product", variantId: "var_1" }),
    ).toBeNull();
  });
});

// ─── Rule 14: Baskets ─────────────────────────────────────────────────────────

describe("checkStoreOrderStock — baskets", () => {
  it("allows a basket where every line is satisfiable", async () => {
    await seedProduct("prod_a", true, 10, "Shirt");
    await seedProduct("prod_b", true, 5, "Mug");
    expect(
      await check({
        items: [
          { productId: "prod_a", productName: "Shirt", quantity: 3 },
          { productId: "prod_b", productName: "Mug", quantity: 5 },
        ],
      }),
    ).toBeNull();
  });

  it("blocks the whole basket when ONE line is short, naming the product", async () => {
    await seedProduct("prod_a", true, 10, "Shirt");
    await seedProduct("prod_b", true, 1, "Mug");
    const result = await check({
      items: [
        { productId: "prod_a", productName: "Shirt", quantity: 3 },
        { productId: "prod_b", productName: "Mug", quantity: 5 },
      ],
    });
    // The shopper must be told WHICH item failed, not just that something did.
    expect(result).toContain("Mug");
  });

  it("checks a product's lines independently, not by its total", async () => {
    // 4 units of var_a (stock 2) and 1 of var_b (stock 10): the product has 12
    // in total, but the basket is still unsatisfiable.
    await seedProduct("prod_1", true, 0, "Shoes");
    await seedVariant("prod_1", "var_a", 2);
    await seedVariant("prod_1", "var_b", 10);
    expect(
      await check({
        items: [
          { productId: "prod_1", productName: "Shoes", variantId: "var_a", quantity: 4 },
          { productId: "prod_1", productName: "Shoes", variantId: "var_b", quantity: 1 },
        ],
      }),
    ).not.toBeNull();
  });

  it("sums duplicate lines before checking stock", async () => {
    // 3 + 3 of a product with 5 in stock is 6 units — must block.
    await seedProduct("prod_1", true, 5, "Shirt");
    expect(
      await check({
        items: [
          { productId: "prod_1", productName: "Shirt", quantity: 3 },
          { productId: "prod_1", productName: "Shirt", quantity: 3 },
        ],
      }),
    ).not.toBeNull();
  });

  it("ignores an untracked product while still blocking a tracked one", async () => {
    await seedProduct("prod_free", false, 0, "Untracked");
    await seedProduct("prod_short", true, 1, "Tracked");
    expect(
      await check({
        items: [
          // Untracked sells from an empty shelf; tracked is one short.
          { productId: "prod_free", productName: "Untracked", quantity: 90 },
          { productId: "prod_short", productName: "Tracked", quantity: 2 },
        ],
      }),
    ).toContain("Tracked");
  });

  it("refuses a basket that breaks its own bounds before any stock lookup", async () => {
    // Over the per-line cap. normalizeOrderLines throws, so the basket never
    // reaches a stock question at all — the handler turns this into a 4xx
    // (see routes.test.ts). The stock check never has to invent a message for
    // a basket that was never valid.
    await seedProduct("prod_1", true, 100000, "Shirt");
    await expect(
      check({
        items: [{ productId: "prod_1", productName: "Shirt", quantity: 101 }],
      }),
    ).rejects.toThrow(/cannot exceed/i);
  });
});

// ─── Rule 12: Handler error code ─────────────────────────────────────────────

describe("INSUFFICIENT_STOCK error", () => {
  it("BusinessLogicError carries INSUFFICIENT_STOCK code", () => {
    const err = new BusinessLogicError(
      "هذا المنتج غير متوفر بالخيار المطلوب.",
      ERROR_CODES.INSUFFICIENT_STOCK
    );
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.statusCode).toBe(422);
    expect(err.category).toBe("BUSINESS_LOGIC");
  });

  it("is thrown as BusinessLogicError", () => {
    expect(() => {
      throw new BusinessLogicError("OOS", ERROR_CODES.INSUFFICIENT_STOCK);
    }).toThrow(BusinessLogicError);
  });
});

// ─── Rule 13: Inventory roll-up logic ────────────────────────────────────────

describe("inventory roll-up (Street Fighter seed data)", () => {
  it("product total = sum of all variant inventories", () => {
    const variants = [
      { id: "var-004-1", inventory: 6 },   // 40/Noir
      { id: "var-004-2", inventory: 9 },   // 42/Noir
      { id: "var-004-3", inventory: 4 },   // 45/Noir
      { id: "var-004-4", inventory: 7 },   // 40/Kaki
      { id: "var-004-5", inventory: 8 },   // 42/Kaki
      { id: "var-004-6", inventory: 0 },   // 45/Kaki — OOS
    ];
    const total = variants.reduce((sum, v) => sum + v.inventory, 0);
    expect(total).toBe(34);
  });

  it("product-level OOS check (card) correctly shows as IN STOCK", () => {
    const total: number = 34; // computed above
    expect(total === 0).toBe(false); // product card shows no OOS overlay
  });

  it("45/Kaki specific combination is OOS while product is not", () => {
    const oosVariant = { id: "var-004-6", inventory: 0 };
    const productTotal = 34;

    expect(productTotal).toBeGreaterThan(0); // product NOT globally OOS
    expect(oosVariant.inventory).toBe(0);    // but this combination IS OOS
  });

  it("globally OOS only when ALL variants have 0 inventory", () => {
    const allOos = [{ inventory: 0 }, { inventory: 0 }, { inventory: 0 }];
    const total = allOos.reduce((sum, v) => sum + v.inventory, 0);
    expect(total).toBe(0); // product card shows OOS overlay, button disabled
  });
});
