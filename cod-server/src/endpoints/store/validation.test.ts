import { describe, it, expect } from "vitest";
import { storeOrderSchema } from "./validation";
import { toLocalAlgerianMobile } from "@/endpoints/store-otp/phone";

function orderWith(phone: string) {
  return {
    customerName: "Karim Benali",
    phone,
    wilayaId: 16,
    communeId: "c-16-001",
    productId: "prod-1",
    productName: "T-shirt",
    quantity: 1,
    pricePerUnit: 2500,
  };
}

describe("toLocalAlgerianMobile", () => {
  it.each([
    ["0551234567", "0551234567"],
    ["055 12 34 567", "0551234567"],
    ["+213551234567", "0551234567"],
    ["213551234567", "0551234567"],
    ["00213551234567", "0551234567"],
    ["0661234567", "0661234567"],
    ["0771234567", "0771234567"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(toLocalAlgerianMobile(input)).toBe(expected);
  });

  it.each([
    "12345",           // garbage
    "05512345",        // too short
    "05512345678",     // too long
    "041123456",       // landline (04 prefix)
    "0812345678",      // invalid prefix
    "+33123456789",    // foreign number
    "0000000000",      // zeros
  ])("rejects %s", (input) => {
    expect(toLocalAlgerianMobile(input)).toBeNull();
  });
});

describe("storeOrderSchema phone", () => {
  it("accepts a local mobile and normalizes E.164/international forms to local", () => {
    expect(storeOrderSchema.parse(orderWith("0551234567")).phone).toBe("0551234567");
    expect(storeOrderSchema.parse(orderWith("+213 551 234 567")).phone).toBe("0551234567");
    expect(storeOrderSchema.parse(orderWith("00213551234567")).phone).toBe("0551234567");
  });

  it("rejects non-Algerian-mobile phones with the Arabic error message", () => {
    const result = storeOrderSchema.safeParse(orderWith("123456"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("05");
    }
  });

  it("rejects landlines and foreign numbers", () => {
    expect(storeOrderSchema.safeParse(orderWith("041123456")).success).toBe(false);
    expect(storeOrderSchema.safeParse(orderWith("+33123456789")).success).toBe(false);
  });
});

/**
 * A basket has no single representative product.
 *
 * `productId`, `productName` and `pricePerUnit` describe the one product a
 * direct order form was rendered for. When the request carries `items[]` those
 * three say nothing true — `normalizeOrderLines` ignores them outright — so a
 * checkout page built from the cart has nothing honest to put in them.
 * They stay required for every other shape, because a request with neither a
 * basket nor a product is not an order.
 */
describe("storeOrderSchema — basket orders", () => {
  const customer = {
    customerName: "Karim Benali",
    phone: "0551234567",
    wilayaId: 16,
    communeId: "c-16-001",
  };
  const basket = [
    { productId: "prod-1", productName: "T-shirt", quantity: 2 },
    { productId: "prod-2", productName: "Hoodie", quantity: 1, pricePerUnit: 4200 },
  ];

  it("accepts a basket with no top-level product", () => {
    const result = storeOrderSchema.safeParse({ ...customer, items: basket });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.productId).toBeUndefined();
      expect(result.data.pricePerUnit).toBeUndefined();
    }
  });

  it("still accepts a single-product order exactly as before", () => {
    const result = storeOrderSchema.safeParse({
      ...customer,
      productId: "prod-1",
      productName: "T-shirt",
      quantity: 1,
      pricePerUnit: 2500,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.productId).toBe("prod-1");
  });

  it("rejects a request that names neither a basket nor a product", () => {
    const result = storeOrderSchema.safeParse({ ...customer });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join("."))).toContain("productId");
    }
  });

  it("rejects a product named without a price", () => {
    // Half a single-product order is not an order; the price is what the
    // legacy path needs and the basket path supplies per line.
    const result = storeOrderSchema.safeParse({
      ...customer,
      productId: "prod-1",
      productName: "T-shirt",
    });

    expect(result.success).toBe(false);
  });

  it("does not let an empty basket stand in for a product", () => {
    const result = storeOrderSchema.safeParse({ ...customer, items: [] });

    expect(result.success).toBe(false);
  });
});
