import { describe, it, expect } from "vitest";
import { resolve, makeT } from "./core";

const dict = { table: { total: "Total" }, deep: { a: { b: "x" } } };

describe("resolve", () => {
  it("resolves nested dot-paths", () => expect(resolve(dict, "table.total")).toBe("Total"));
  it("returns undefined for missing paths / non-strings", () => {
    expect(resolve(dict, "table.missing")).toBeUndefined();
    expect(resolve(dict, "deep")).toBeUndefined();
  });
});

describe("makeT fallback chain", () => {
  const t = makeT({ only: "عربي" }, dict);
  it("uses locale value when present", () => expect(t("only")).toBe("عربي"));
  it("falls back to english dict", () => expect(t("table.total")).toBe("Total"));
  it("returns the raw key when both miss — gaps stay visible", () =>
    expect(t("nope.missing")).toBe("nope.missing"));
});
