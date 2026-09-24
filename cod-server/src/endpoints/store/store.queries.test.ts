/**
 * findOrCreateCustomer — mock-queue coverage.
 *
 * The mock db is a call-ordered response queue, which makes it good at exactly
 * one thing: pinning a function's query SEQUENCE. findOrCreateCustomer still
 * has a sequential one, and that is what these tests hold in place:
 *   • resolve wilaya/commune names, then ONE upsert statement:
 *     INSERT ... ON CONFLICT(phone) DO UPDATE ... RETURNING
 *   • return the RETURNING row — new or existing, race-free
 *
 * createStoreOrder's coverage moved to real D1 — see the note at the bottom.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a } from "@/test-utils/mock-db";
import { findOrCreateCustomer } from "../../../../cod-shared/queries/store";

describe("findOrCreateCustomer", () => {
  it("upserts by phone and returns the RETURNING row", async () => {
    const db = makeMockDb([
      f({ name_ar: "الجزائر" }),
      f({ name_ar: "باب الزوار" }),
      a([{ id: "cust_1", name: "Fatima Zahra", phone: "0661234567", wilaya: "الجزائر" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "0661234567",
      name: "Fatima Zahra",
      wilayaId: 16,
      communeId: "c-16-001",
    });

    expect(row).toMatchObject({ id: "cust_1", phone: "0661234567" });
  });

  it("handles a missing commune (null lookup skipped)", async () => {
    const db = makeMockDb([
      f({ name_ar: "الجزائر" }),
      a([{ id: "cust_1", name: "N", phone: "05", wilaya: "الجزائر" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "05",
      name: "N",
      wilayaId: 16,
    });

    expect(row).toMatchObject({ id: "cust_1" });
  });

  it("falls back to a generated wilaya label when the wilaya is unknown", async () => {
    const db = makeMockDb([
      f(null),
      a([{ id: "cust_2", name: "N", phone: "07", wilaya: "ولاية 16" }]),
    ]);

    const row = await findOrCreateCustomer(db, {
      phone: "07",
      name: "N",
      wilayaId: 16,
    });

    expect(row).toMatchObject({ id: "cust_2" });
  });
});

// ─── createStoreOrder — coverage moved to real D1 ────────────────────────────
//
// These six cases used to live here as mock-queue tests. The queue is
// call-ordered, so it encoded the engine's exact sequence of `.get()` calls —
// and the engine no longer makes them: the resolve phase is now ONE batched
// round trip (chunked `inArray` + `db.batch()`), because a sequential read per
// product is pathological for a basket on a single-threaded D1.
//
// Rather than re-encode a batched query plan positionally — which would test
// the mock rather than the system — each case now runs against Miniflare D1
// with the real migrations:
//
//   catalog price is authoritative   → cart-orders-e2e: "ignores the client's
//                                      price entirely" + "flat single product
//                                      behaves exactly as before"
//   variant selections, price = Σ    → cart-orders-e2e: "variantSelections
//                                      groups per-unit picks into lines"
//   untracked products skip stock    → cart-orders-e2e: "skips deduction for a
//                                      product with tracking off"
//   free-shipping offer zeroes fee   → cart-orders-e2e: "free shipping applies
//                                      when the basket holds ONE product"
//   reward line + reward deduction   → cart-orders-e2e: "adds a free reward
//                                      line at zero price"
//   reward skipped when out of stock → cart-orders-e2e: "skips the reward when
//                                      its stock cannot cover it"
//
// The batching itself is asserted by checkout-query-budget.e2e, and atomicity
// by store.queries-e2e. No assertion was dropped — each moved to stronger
// evidence. findOrCreateCustomer keeps its mock-queue tests above: its
// sequence is still sequential and is exactly what they are there to pin.
