import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLocale, setLocale, type Locale } from "./locale";

// Mock cookies object
const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
};

// Mock next/headers — Next.js 15 cookies() is async
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookies),
}));

describe("Locale Utility", () => {
  beforeEach(() => {
    mockCookies.get.mockReset();
    mockCookies.set.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getLocale", () => {
    it("should return 'en' when locale cookie is set to 'en'", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return { value: "en" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("en");
      expect(mockCookies.get).toHaveBeenCalledWith("locale");
    });

    it("should return 'ar' when locale cookie is set to 'ar'", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return { value: "ar" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("ar");
      expect(mockCookies.get).toHaveBeenCalledWith("locale");
    });

    it("should return 'ar' when accept-language cookie contains 'ar' and no locale cookie", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return undefined;
        }
        if (name === "accept-language") {
          return { value: "ar-DZ,ar;q=0.9,en;q=0.8" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("ar");
      expect(mockCookies.get).toHaveBeenCalledWith("locale");
      expect(mockCookies.get).toHaveBeenCalledWith("accept-language");
    });

    it("should return 'en' when no locale cookie and accept-language does not contain 'ar'", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return undefined;
        }
        if (name === "accept-language") {
          return { value: "en-US,en;q=0.9" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("en");
    });

    it("should return 'en' when no cookies are set (default fallback)", async () => {
      mockCookies.get.mockReturnValue(undefined);

      const result = await getLocale();

      expect(result).toBe("en");
      expect(mockCookies.get).toHaveBeenCalledWith("locale");
    });

    it("should accept 'fr' as a valid locale cookie value", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return { value: "fr" };
        }
        if (name === "accept-language") {
          return { value: "ar-DZ" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("fr");
    });

    it("should ignore invalid locale cookie values and fall back to default", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return { value: "invalid" };
        }
        if (name === "accept-language") {
          return { value: "de-DE" };
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("en");
    });

    it("should handle missing accept-language cookie gracefully", async () => {
      mockCookies.get.mockImplementation((name: string) => {
        if (name === "locale") {
          return undefined;
        }
        if (name === "accept-language") {
          return undefined;
        }
        return undefined;
      });

      const result = await getLocale();

      expect(result).toBe("en");
    });
  });

  describe("setLocale", () => {
    it("should set locale cookie to 'en' with 1 year expiry", async () => {
      await setLocale("en");

      expect(mockCookies.set).toHaveBeenCalledWith("locale", "en", {
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    });

    it("should set locale cookie to 'ar' with 1 year expiry", async () => {
      await setLocale("ar");

      expect(mockCookies.set).toHaveBeenCalledWith("locale", "ar", {
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    });

    it("should set cookie with correct maxAge (1 year in seconds)", async () => {
      await setLocale("en");

      const expectedMaxAge = 365 * 24 * 60 * 60;
      expect(mockCookies.set).toHaveBeenCalledWith(
        "locale",
        "en",
        expect.objectContaining({ maxAge: expectedMaxAge })
      );
    });

    it("should set cookie with path '/' for site-wide access", async () => {
      await setLocale("ar");

      expect(mockCookies.set).toHaveBeenCalledWith(
        "locale",
        "ar",
        expect.objectContaining({ path: "/" })
      );
    });
  });

  describe("Type Safety", () => {
    it("should only accept valid Locale types", () => {
      const validLocales: Locale[] = ["en", "ar", "fr"];

      validLocales.forEach((locale) => {
        expect(["en", "ar", "fr"]).toContain(locale);
      });
    });
  });
});
