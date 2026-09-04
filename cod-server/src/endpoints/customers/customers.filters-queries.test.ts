/**
 * getAllCustomers + getAllDrivers — Slice 8 mock-queue coverage.
 *
 * Call shape post-Slice 8: group/tag/wilaya filters are EXISTS subqueries
 * inside the SINGLE list query — no pre-fetch, no id list, no inArray.
 * Previously: a group/tag with >100 members crashed on D1's 100-bound-param
 * limit (miniflare enforces it — proven in the Slice 5 probe). The >100
 * case is verified against real D1 in customers.filters-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, a, customerRow } from "@/test-utils/mock-db";
import { getAllCustomers } from "../../../../cod-shared/queries/customers";
import { getAllDrivers } from "../../../../cod-shared/queries/drivers";

function driverListRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "drv_1",
    first_name: "Ahmed",
    last_name: "Benali",
    phone: "0551234567",
    phone2: null,
    vehicle_type: "motorcycle",
    status: "available",
    total_delivered: 5,
    total_earnings: 1000,
    pending_cash: 100,
    total_paid: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function compCountRow(driverId: string, c: number): Record<string, unknown> {
  return { driver_id: driverId, c };
}

describe("getAllCustomers — EXISTS filters, one query", () => {
  it("group filter runs as one query (no member pre-fetch)", async () => {
    const db = makeMockDb([a([customerRow({ id: "cust_1" })])]);

    const rows = await getAllCustomers(db, { groupId: "grp_1" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "cust_1" });
  });

  it("tag filter runs as one query", async () => {
    const db = makeMockDb([a([customerRow({ id: "cust_1" })])]);

    const rows = await getAllCustomers(db, { tagId: "tag_1" });

    expect(rows).toHaveLength(1);
  });

  it("group + tag + wilaya + search combine in one query", async () => {
    const db = makeMockDb([a([customerRow({ id: "cust_1", wilaya_id: 16 })])]);

    const rows = await getAllCustomers(db, {
      groupId: "grp_1",
      tagId: "tag_1",
      wilayaId: 16,
      search: "Fatima",
    });

    expect(rows).toHaveLength(1);
  });

  it("empty group result comes back as an empty page (not an early return)", async () => {
    const db = makeMockDb([a([])]);

    const rows = await getAllCustomers(db, { groupId: "grp_empty" });

    expect(rows).toEqual([]);
  });

  it("no filters: plain paginated list", async () => {
    const db = makeMockDb([a([customerRow({ id: "cust_1" })])]);

    const rows = await getAllCustomers(db, { limit: 10, offset: 5 });

    expect(rows).toHaveLength(1);
  });
});

describe("getAllDrivers — EXISTS wilaya filter", () => {
  it("wilaya filter runs in the list query, then one GROUP BY count query", async () => {
    const db = makeMockDb([
      a([driverListRow()]),
      a([compCountRow("drv_1", 3)]),
    ]);

    const rows = await getAllDrivers(db, { wilayaId: 16 });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ compensationWilayaCount: 3 });
  });

  it("empty wilaya coverage is an empty page (not an early return)", async () => {
    const db = makeMockDb([a([]), a([])]);

    const rows = await getAllDrivers(db, { wilayaId: 58 });

    expect(rows).toEqual([]);
  });

  it("unfiltered list still resolves compensation counts", async () => {
    const db = makeMockDb([
      a([driverListRow({ id: "drv_1" }), driverListRow({ id: "drv_2" })]),
      a([compCountRow("drv_1", 2), compCountRow("drv_2", 5)]),
    ]);

    const rows = await getAllDrivers(db);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === "drv_2")).toMatchObject({ compensationWilayaCount: 5 });
  });
});
