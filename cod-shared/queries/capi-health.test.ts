/**
 * Conversions API delivery health, read from the real event log.
 *
 * This projection is what the merchant sees in Settings → Tracking, so two
 * things matter beyond the numbers: a failure streak must be measured from the
 * last SUCCESS (not from a fixed window), and the payload must stay free of
 * order ids and customer fields.
 *
 * Real D1, not the mock db: the aggregate has to run through the actual query
 * builder and the migration that added `http_status`.
 */
/// <reference types="vitest/globals" />

import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import { getCapiHealth } from "./capi-health";

let harness: TestD1;
let seq = 0;

const NOW = new Date("2026-10-26T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 3600 * 1000).toISOString();

beforeEach(async () => {
  harness = await createTestD1();
}, 120_000);

afterEach(async () => {
  await harness?.dispose();
});

async function logEvent(
  overrides: Partial<typeof schema.capiEventLog.$inferInsert> & {
    status: "sent" | "failed" | "skipped";
    sentAt: string;
  },
) {
  const n = ++seq;
  const customerId = `cust-health-${n}`;
  const orderId = `order-health-${n}`;

  await harness.db.insert(schema.customers).values({
    id: customerId,
    name: "Test Customer",
    phone: `0550000${String(n).padStart(4, "0")}`,
    wilaya: "Alger",
    createdAt: NOW.toISOString(),
  });

  await harness.db.insert(schema.orders).values({
    id: orderId,
    orderNumber: `ORD-HEALTH-${n}`,
    customerId,
    customerName: "Test Customer",
    phone: `0550000${String(n).padStart(4, "0")}`,
    price: 1000,
    deliveryFee: 0,
    status: "new",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });

  await harness.db.insert(schema.capiEventLog).values({
    id: `log-health-${n}`,
    orderId,
    eventName: "Purchase",
    stage: "checkout",
    httpStatus: null,
    error: null,
    ...overrides,
  });

  return { orderId, customerId };
}

describe("getCapiHealth", () => {
  it("reports nothing attempted on a store that never placed an order", async () => {
    const health = await getCapiHealth(harness.db, NOW.getTime());

    expect(health.lastAttemptAt).toBeNull();
    expect(health.lastSuccessAt).toBeNull();
    expect(health.lastFailure).toBeNull();
    expect(health.consecutiveFailures).toBe(0);
    expect(health.sentLast30Days).toBe(0);
    expect(health.failedLast30Days).toBe(0);
  });

  it("counts failures from the last success, not from the last failure", async () => {
    await logEvent({ status: "failed", sentAt: daysAgo(5), httpStatus: 401, error: "old" });
    await logEvent({ status: "sent", sentAt: daysAgo(4), httpStatus: 200 });
    await logEvent({ status: "failed", sentAt: daysAgo(2), httpStatus: 401, error: "again" });

    const health = await getCapiHealth(harness.db, NOW.getTime());

    expect(health.lastSuccessAt).toBe(daysAgo(4));
    expect(health.consecutiveFailures).toBe(1);
    expect(health.sentLast30Days).toBe(1);
    expect(health.failedLast30Days).toBe(2);
  });

  it("exposes the last failure with Meta's status and redacted message", async () => {
    await logEvent({
      status: "failed",
      sentAt: daysAgo(1),
      httpStatus: 401,
      error: "Invalid OAuth access token - Cannot parse access token",
    });

    const health = await getCapiHealth(harness.db, NOW.getTime());

    expect(health.lastFailure).toEqual({
      eventName: "Purchase",
      stage: "checkout",
      httpStatus: 401,
      message: "Invalid OAuth access token - Cannot parse access token",
      at: daysAgo(1),
    });
    expect(health.consecutiveFailures).toBe(1);
  });

  it("keeps old attempts out of the 30-day totals but not out of the streak", async () => {
    await logEvent({ status: "failed", sentAt: daysAgo(45), httpStatus: 401, error: "ancient" });
    await logEvent({ status: "failed", sentAt: daysAgo(3), httpStatus: 429, error: "rate limited" });

    const health = await getCapiHealth(harness.db, NOW.getTime());

    expect(health.failedLast30Days).toBe(1);
    expect(health.consecutiveFailures).toBe(2);
    expect(health.lastFailure?.httpStatus).toBe(429);
  });

  it("never returns an order id or a customer field", async () => {
    const { orderId, customerId } = await logEvent({
      status: "failed",
      sentAt: daysAgo(1),
      httpStatus: 401,
      error: "Invalid OAuth access token",
    });

    const serialized = JSON.stringify(await getCapiHealth(harness.db, NOW.getTime()));

    expect(serialized).not.toContain(orderId);
    expect(serialized).not.toContain(customerId);
    expect(serialized).not.toContain("Test Customer");
  });
});
