/**
 * findOrCreateCustomer + createStoreOrder — Slice 3 mock-queue coverage.
 *
 * findOrCreateCustomer contract (post-Slice 3):
 *   • resolves wilaya/commune names, then ONE upsert statement:
 *     INSERT ... ON CONFLICT(phone) DO UPDATE ... RETURNING
 *   • returns the RETURNING row — new or existing, race-free
 *
 * createStoreOrder contract (post-Slice 3):
 *   • resolve phase: offer select, SKU selects, trackInventory select,
 *     inventory reads for each deduction
 *   • commit phase: ONE db.batch() — order insert, line inserts, history,
 *     customer stats update, guarded deduction updates + movement inserts
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a, offerRow } from "@/test-utils/mock-db";
import {
  findOrCreateCustomer,
  createStoreOrder,
} from "../../../../cod-shared/queries/store";

const baseOrder = {
  customerName: "Fatima Zahra",
  phone: "0661234567",
  wilayaId: 16,
  communeId: "c-16-001",
  address: "Rue des Lilas",
  deliveryType: "home" as const,
  productId: "prod_1",
  productName: "T-Shirt",
  quantity: 2,
  pricePerUnit: 1500,
  notes: "call before delivery",
};

describe("findOrCreateCustomer", () => {
  it("upserts by phone and returns the RETURNING row", async () => {
    const db = makeMockDb([
      f({ name_ar: "الجزائر" }),
      f({ name_ar: "باب الزوار" }),
      a([{ id: "cust_1", name: "Fatima Zahra", phone: "0661234567", wilaya: "الجزائر" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "0661234567",
      name: "Fatima Zahra",
      wilayaId: 16,
      communeId: "c-16-001",
    });

    expect(row).toMatchObject({ id: "cust_1", phone: "0661234567" });
  });

  it("handles a missing commune (null lookup skipped)", async () => {
    const db = makeMockDb([
      f({ name_ar: "الجزائر" }),
      a([{ id: "cust_1", name: "N", phone: "05", wilaya: "الجزائر" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "05",
      name: "N",
      wilayaId: 16,
    });

    expect(row).toMatchObject({ id: "cust_1" });
  });

  it("falls back to a generated wilaya label when the wilaya is unknown", async () => {
    const db = makeMockDb([
      f(null),
      a([{ id: "cust_2", name: "N", phone: "07", wilaya: "ولاية 16" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "07",
      name: "N",
      wilayaId: 16,
    });

    expect(row).toMatchObject({ id: "cust_2" });
  });
});

describe("createStoreOrder", () => {
  it("commits a simple tracked order in one batch", async () => {
    const db = makeMockDb([
      a([]),                             // selectApplicableOffer — no candidates
      f({ sku: "TS-001" }),              // product SKU select
      f({ track_inventory: 1 }),         // trackInventory select
      f({ inventory: 10 }),              // readInventoryForDeduct
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      variantId: undefined,
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ price: 3000, deliveryFee: 400 });
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(result.id).toBeTruthy();
  });

  it("commits a variant-selection order with grouped deductions", async () => {
    const db = makeMockDb([
      a([]),                             // offers
      f({ sku: "TS-RED" }),              // variant SKU (group 1)
      f({ sku: "TS-BLUE" }),             // variant SKU (group 2)
      f({ track_inventory: 1 }),         // trackInventory
      f({ inventory: 4 }),               // inventory variant 1
      f({ inventory: 2 }),               // inventory variant 2
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      variantSelections: [
        { variantId: "var_1", variantLabel: "Red" },
        { variantId: "var_1", variantLabel: "Red" },
        { variantId: "var_2", variantLabel: "Blue" },
      ],
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ price: 3000 });
  });

  it("skips deduction entirely for untracked products", async () => {
    const db = makeMockDb([
      a([]),                             // offers
      f({ sku: "TS-001" }),              // SKU
      f({ track_inventory: 0 }),         // trackInventory — false
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ price: 3000 });
  });

  it("applies a free-shipping offer (no reward line, fee zeroed)", async () => {
    const offer = offerRow({
      id: "offer_fs",
      discount_type: "free_shipping",
      reward_product_id: null,
    });
    const db = makeMockDb([
      f(offer),                          // explicit offerId select
      f({ sku: "TS-001" }),              // SKU
      f({ track_inventory: 1 }),         // trackInventory
      f({ inventory: 10 }),              // inventory
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      offerId: "offer_fs",
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ deliveryFee: 0, price: 3000 });
  });

  it("adds the reward line and reward deduction for a free-product offer", async () => {
    const offer = offerRow({
      id: "offer_b2g1",
      reward_product_id: "prod_2",
      reward_variant_id: "var_9",
    });
    const db = makeMockDb([
      f(offer),                          // explicit offer select
      f({ sku: "TS-001" }),              // order line SKU
      f({ variations: '{"Color":"Green"}' }), // reward variant variations
      f({ name: "Socks", track_inventory: 1 }), // reward product
      f({ inventory: 5 }),               // reward variant inventory (in stock)
      f({ sku: "SOCK-G" }),              // reward SKU
      f({ track_inventory: 1 }),         // main product trackInventory
      f({ inventory: 10 }),              // main product inventory
      f({ inventory: 5 }),               // reward inventory for deduction
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      quantity: 2,
      offerId: "offer_b2g1",
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ price: 3000, deliveryFee: 400 });
  });

  it("skips the reward line when the reward is out of stock", async () => {
    const offer = offerRow({
      id: "offer_b2g1",
      reward_product_id: "prod_2",
      reward_variant_id: "var_9",
    });
    const db = makeMockDb([
      f(offer),                          // offer
      f({ sku: "TS-001" }),              // SKU
      f({ variations: '{"Color":"Green"}' }), // reward variations
      f({ name: "Socks", track_inventory: 1 }), // reward product
      f({ inventory: 0 }),               // reward inventory — OUT OF STOCK
      f({ track_inventory: 1 }),         // main product
      f({ inventory: 10 }),              // main inventory
    ]);

    const result = await createStoreOrder(db, {
      ...baseOrder,
      quantity: 2,
      offerId: "offer_b2g1",
      customerId: "cust_1",
      customerName: "Fatima Zahra",
      deliveryFee: 400,
    });

    expect(result).toMatchObject({ price: 3000 });
  });
});
