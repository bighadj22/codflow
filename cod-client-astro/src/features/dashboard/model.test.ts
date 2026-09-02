import { describe, expect, it } from "vitest";
import { fillStatusStats } from "./model";

describe("fillStatusStats", () => {
  it("fills sparse API results with zero-count lifecycle statuses", () => {
    const result = fillStatusStats([
      { status: "delivered", count: 4 },
      { status: "new", count: 2 },
    ]);

    expect(result).toHaveLength(11);
    expect(result.find((item) => item.status === "new")?.count).toBe(2);
    expect(result.find((item) => item.status === "delivered")?.count).toBe(4);
    expect(result.find((item) => item.status === "cancelled")?.count).toBe(0);
  });
});
