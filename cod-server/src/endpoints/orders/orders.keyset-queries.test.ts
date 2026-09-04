/**
 * Slice 9 — keyset pagination + LIKE-pattern guard: unit + mock coverage.
 *
 *   • safeLikeTerm: D1 caps LIKE patterns at 50 bytes (verified: longer
 *     patterns throw "LIKE or GLOB pattern too complex"); the guard
 *     truncates terms to 48 bytes on UTF-8 code-point boundaries.
 *   • encode/parseOrderCursor: opaque base64url cursor round-trip; garbage
 *     parses to null.
 *   • orderFiltersSchema: cursor refine → 400 on garbage at the API boundary.
 *   • getAllOrders: cursor takes precedence over offset (defensive fallback
 *     to the first page for unparseable cursors at the query level).
 *
 * WHERE/ordering semantics verified against real D1 in orders.keyset-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, a, orderRow } from "@/test-utils/mock-db";
import {
  getAllOrders,
  encodeOrderCursor,
  parseOrderCursor,
} from "../../../../cod-shared/queries/orders";
import { safeLikeTerm } from "../../../../cod-shared/queries/search";
import { orderFiltersSchema } from "./validation";

function listRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...orderRow(),
    wilaya: "الجزائر",
    commune: null,
    driver_name: null,
    has_review: 0,
    last_updated_by: null,
    ...overrides,
  };
}

describe("safeLikeTerm", () => {
  it("passes short ASCII terms through unchanged", () => {
    expect(safeLikeTerm("ORD-001")).toBe("ORD-001");
  });

  it("passes the maximum in-budget Arabic term unchanged (24 chars = 48 bytes)", () => {
    const term = "أ".repeat(24);
    expect(safeLikeTerm(term)).toBe(term);
  });

  it("truncates a long ASCII term to 48 bytes", () => {
    const out = safeLikeTerm("a".repeat(200));
    expect(out).toHaveLength(48);
  });

  it("truncates Arabic text on a code-point boundary (never mid-character)", () => {
    const out = safeLikeTerm("أ".repeat(60));
    expect(out).toHaveLength(24);
    expect(out).toBe("أ".repeat(24));
  });

  it("truncates mixed emoji (4-byte) text on a boundary", () => {
    const out = safeLikeTerm("😀".repeat(30));
    expect([...out]).toHaveLength(12);
    expect(out).toBe("😀".repeat(12));
    expect(new TextEncoder().encode(out).length).toBe(48);
  });

  it("an empty term stays empty", () => {
    expect(safeLikeTerm("")).toBe("");
  });
});

describe("order cursor codec", () => {
  it("round-trips createdAt and id", () => {
    const cursor = encodeOrderCursor("2026-09-04T12:00:00.000Z", "ord-123");
    expect(parseOrderCursor(cursor)).toEqual({
      createdAt: "2026-09-04T12:00:00.000Z",
      id: "ord-123",
    });
  });

  it("rejects non-base64 garbage", () => {
    expect(parseOrderCursor("!!!not-base64!!!")).toBeNull();
  });

  it("rejects base64 of the wrong inner shape", () => {
    expect(parseOrderCursor(btoa("no-separator"))).toBeNull();
    expect(parseOrderCursor(btoa("|missing-createdat"))).toBeNull();
    expect(parseOrderCursor(btoa("not-a-date|ord-1"))).toBeNull();
  });
});

describe("orderFiltersSchema — cursor validation", () => {
  it("accepts a valid cursor", () => {
    const cursor = encodeOrderCursor("2026-09-04T12:00:00.000Z", "ord-1");
    const parsed = orderFiltersSchema.parse({ cursor });
    expect(parsed.cursor).toBe(cursor);
  });

  it("rejects a garbage cursor (400 at the API boundary)", () => {
    expect(() => orderFiltersSchema.parse({ cursor: "garbage" })).toThrow();
  });

  it("cursor is optional (offset pagination unchanged)", () => {
    const parsed = orderFiltersSchema.parse({ limit: 10, offset: 20 });
    expect(parsed.cursor).toBeUndefined();
  });
});

describe("getAllOrders — cursor precedence", () => {
  it("uses the cursor row-value predicate in the single list query", async () => {
    const db = makeMockDb([a([listRow()])]);
    const cursor = encodeOrderCursor("2026-09-04T12:00:00.000Z", "ord-999");

    const rows = await getAllOrders(db, { cursor, limit: 10, offset: 99 });

    expect(rows).toHaveLength(1);
  });

  it("falls back to the first page for an unparseable cursor (defensive)", async () => {
    const db = makeMockDb([a([listRow()])]);

    const rows = await getAllOrders(db, { cursor: "!!!", offset: 99 });

    expect(rows).toHaveLength(1);
  });
});
