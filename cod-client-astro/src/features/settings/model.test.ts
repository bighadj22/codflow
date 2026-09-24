import { describe, expect, it } from "vitest";
import { SETTINGS_CATEGORIES, settingsErrorMessage } from "./model";

const t = (key: string) => key;

describe("settings model", () => {
  it("exposes the categories in sidebar order", () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      "general",
      "branding",
      "seo",
      "cart",
      "delivery",
      "reviews",
      "analytics",
      "verification",
      "bot_protection",
      "email",
      "api",
    ]);

    // Keyed by id rather than by index: inserting a category should require
    // updating the order above and nothing else, instead of renumbering every
    // assertion underneath it.
    const labelById = Object.fromEntries(
      SETTINGS_CATEGORIES.map((category) => [category.id, category.labelKey]),
    );
    expect(labelById).toMatchObject({
      general: "general_title",
      cart: "cart_title",
      delivery: "delivery_pricing_title",
      verification: "otp_title",
      bot_protection: "bot_protection_title",
      email: "email_title",
      api: "api_key_title",
    });
  });

  it("maps every save failure to the store save error", () => {
    expect(settingsErrorMessage({ code: "VALIDATION_FAILED" }, t)).toBe("store.save_error");
    expect(settingsErrorMessage(new Error("boom"), t)).toBe("store.save_error");
  });
});
