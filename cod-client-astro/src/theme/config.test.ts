import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, detectTheme, persistTheme } from "./config";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function installBrowser(savedTheme: string | null = null) {
  const storage = new Map<string, string>();
  if (savedTheme) storage.set("theme", savedTheme);
  const root = {
    classList: {
      toggle: (name: string, enabled: boolean) => {
        if (enabled) root.className += ` ${name}`;
        else root.className = root.className.replace(` ${name}`, "");
      },
    },
    className: "",
    style: { colorScheme: "" },
  };
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    dispatchEvent: () => true,
  };
  globalThis.window = fakeWindow as unknown as Window & typeof globalThis;
  globalThis.document = { documentElement: root } as unknown as Document;
  return { root, storage };
}

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});

describe("theme persistence", () => {
  it("detects a saved light theme", () => {
    installBrowser("light");
    expect(detectTheme()).toBe("light");
  });

  it("persists and applies the selected theme", () => {
    const { root, storage } = installBrowser();

    persistTheme("light");

    expect(storage.get("theme")).toBe("light");
    expect(root.className).not.toContain("dark");
    expect(root.style.colorScheme).toBe("light");
  });

  it("applies dark mode through the document class", () => {
    const { root } = installBrowser();

    applyTheme("dark");

    expect(root.className).toContain("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
