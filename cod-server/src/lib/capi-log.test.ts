import { describe, it, expect, vi } from "vitest";
import { logCapiEvent } from "./capi-log";

/**
 * The audit row is the only place a merchant learns why a Conversions API
 * event never arrived (Settings → Tracking reads it back). It must never
 * become a second copy of the token, and it must never throw into an order or
 * delivery flow.
 */

function capturingDb() {
  const rows: any[] = [];
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: any) => {
        rows.push(value);
      }),
    })),
  } as any;
  return { db, rows };
}

const BASE = {
  orderId: "order-1",
  eventName: "Purchase" as const,
  stage: "checkout" as const,
  status: "failed" as const,
};

describe("logCapiEvent", () => {
  it("stores Meta's HTTP status with the attempt", async () => {
    const { db, rows } = capturingDb();
    await logCapiEvent(db, {
      ...BASE,
      error: "Invalid OAuth access token - Cannot parse access token",
      httpStatus: 401,
    });

    expect(rows[0]).toMatchObject({
      status: "failed",
      httpStatus: 401,
      error: "Invalid OAuth access token - Cannot parse access token",
    });
  });

  it("leaves the status null when the attempt never reached Meta", async () => {
    const { db, rows } = capturingDb();
    await logCapiEvent(db, { ...BASE, status: "skipped", error: "No CAPI access token" });

    expect(rows[0].httpStatus).toBeNull();
  });

  it("redacts a token-shaped value that reached the message", async () => {
    const { db, rows } = capturingDb();
    const token = `EAA${"aB3dEf6h".repeat(6)}`;
    await logCapiEvent(db, {
      ...BASE,
      error: `OAuth call failed for ${token}`,
      httpStatus: 401,
    });

    expect(rows[0].error).not.toContain(token);
    expect(rows[0].error).toContain("[redacted-token]");
  });

  it("bounds a long message instead of persisting it whole", async () => {
    const { db, rows } = capturingDb();
    await logCapiEvent(db, { ...BASE, error: "x".repeat(2_000) });

    expect(rows[0].error.length).toBeLessThanOrEqual(501);
  });

  it("never throws when the audit write itself fails", async () => {
    const db = {
      insert: vi.fn(() => {
        throw new Error("database unavailable");
      }),
    } as any;

    await expect(logCapiEvent(db, { ...BASE, error: "boom" })).resolves.toBeUndefined();
  });
});
