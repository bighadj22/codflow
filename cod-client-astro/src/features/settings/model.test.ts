import { describe, expect, it } from "vitest";
import { SETTINGS_CATEGORIES, settingsErrorMessage } from "./model";

const t = (key: string) => key;

describe("settings model", () => {
  it("exposes the categories in sidebar order", () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      "general",
      "branding",
      "seo",
      "reviews",
      "analytics",
      "verification",
      "api",
    ]);
    expect(SETTINGS_CATEGORIES[0].labelKey).toBe("general_title");
    expect(SETTINGS_CATEGORIES[5].labelKey).toBe("otp_title");
    expect(SETTINGS_CATEGORIES[6].labelKey).toBe("api_key_title");
  });

  it("maps every save failure to the store save error", () => {
    expect(settingsErrorMessage({ code: "VALIDATION_FAILED" }, t)).toBe("store.save_error");
    expect(settingsErrorMessage(new Error("boom"), t)).toBe("store.save_error");
  });
});
