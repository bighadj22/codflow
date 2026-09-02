import { afterEach, describe, expect, it, vi } from "vitest";

const hotToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({ toast: hotToast }));

import { consumeFlashToast, notify } from "./notify";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe("notify", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows immediate success and error feedback", () => {
    notify.success("Saved");
    notify.error("Failed");

    expect(hotToast.success).toHaveBeenCalledWith("Saved");
    expect(hotToast.error).toHaveBeenCalledWith("Failed");
  });

  it("shows a queued toast once after navigation", () => {
    const sessionStorage = makeStorage();
    vi.stubGlobal("window", { sessionStorage });

    notify.flashSuccess("Created");
    expect(hotToast.success).not.toHaveBeenCalled();

    consumeFlashToast();
    consumeFlashToast();

    expect(hotToast.success).toHaveBeenCalledOnce();
    expect(hotToast.success).toHaveBeenCalledWith("Created");
  });

  it("falls back to an immediate toast when storage is unavailable", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        setItem: vi.fn(() => {
          throw new Error("unavailable");
        }),
      },
    });

    notify.flashError("Failed");

    expect(hotToast.error).toHaveBeenCalledWith("Failed");
  });

  it("ignores malformed queued feedback", () => {
    const sessionStorage = makeStorage();
    sessionStorage.setItem("codflow:toast", "not-json");
    vi.stubGlobal("window", { sessionStorage });

    expect(() => consumeFlashToast()).not.toThrow();
    expect(hotToast.success).not.toHaveBeenCalled();
    expect(hotToast.error).not.toHaveBeenCalled();
  });
});
