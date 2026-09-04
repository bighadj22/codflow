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
