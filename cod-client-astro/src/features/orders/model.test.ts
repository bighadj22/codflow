import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  detailStatusActions,
  dispatchFieldSupport,
  canAssignOrder,
  canDeleteOrderFromDetail,
  canDispatchOrder,
  filterOrders,
  formatMoney,
  orderTotal,
  orderStatusFlow,
  orderStatusOptions,
  paginateOrders,
  shipmentCapabilities,
  shipmentUpdateFieldSupport,
  sortOrders,
  abandonedBasketView,
} from "./model";
import type { OrderListItem } from "./types";

const order = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: "1",
  orderNumber: "ORD-001",
  customerId: "c1",
  customerName: "Ahmed Benali",
  phone: "0551234567",
  wilayaId: 16,
  wilaya: "الجزائر",
  communeId: "c-16-001",
  commune: "باب الزوار",
  city: null,
  address: null,
  price: 9000,
  deliveryFee: 400,
  driverFee: 0,
  codAmount: 9400,
  status: "new",
  orderType: "online",
  deliveryMethod: "unassigned",
  deliveryType: "home",
  driverId: null,
  driverName: null,
  companyId: null,
  assignedAt: null,
  assignedBy: null,
  assignmentNotes: null,
  trackingNumber: null,
  trackingUrl: null,
  externalOrderId: null,
  stationCode: null,
  pickupTime: null,
  deliveryTime: null,
  deliveryAttempts: null,
  notes: null,
  photos: null,
  weight: null,
  isFragile: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

describe("orders model", () => {
  it("keeps the lifecycle transitions explicit", () => {
    expect(ALLOWED_TRANSITIONS.new).toEqual([
      "confirmed",
      "unreachable",
      "cancelled",
    ]);
    expect(ALLOWED_TRANSITIONS.delivered).toEqual([]);
    expect(orderStatusOptions("new")).toEqual([
      "new",
      "confirmed",
      "unreachable",
      "cancelled",
    ]);
    expect(orderStatusOptions("delivered")).toEqual(["delivered"]);
  });

  it("filters by query and delivery assignment", () => {
    const result = filterOrders(
      [
        order(),
        order({
          id: "2",
          orderNumber: "ORD-002",
          driverId: "d1",
          status: "assigned",
        }),
      ],
      {
        query: "ahmed",
        status: "all",
        delivery: "driver",
        wilaya: "all",
        type: "all",
      },
    );
    expect(result.map((item) => item.id)).toEqual(["2"]);
  });

  it("calculates the COD total from product price and delivery fee", () => {
    expect(orderTotal(order())).toBe(9400);
    expect(formatMoney(9400, "en")).toBe("9,400 DA");
  });

  it("exposes distinct detail actions for branching statuses", () => {
    expect(detailStatusActions("new")).toEqual([
      { status: "confirmed", emphasis: "primary" },
      { status: "unreachable", emphasis: "secondary" },
    ]);
    expect(detailStatusActions("unreachable")).toEqual([
      { status: "confirmed", emphasis: "primary" },
      { status: "cancelled", emphasis: "danger" },
    ]);
    expect(
      detailStatusActions("ready", order({ deliveryMethod: "unassigned" })),
    ).toEqual([]);
    expect(
      detailStatusActions("ready", order({ deliveryMethod: "company" })),
    ).toEqual([]);
    expect(
      detailStatusActions(
        "ready",
        order({ trackingNumber: "TRK-1", deliveryMethod: "company" }),
      ),
    ).toEqual([{ status: "dispatched", emphasis: "primary" }]);
    expect(detailStatusActions("dispatched")).toEqual([
      { status: "out_for_delivery", emphasis: "primary" },
    ]);
  });

  it("keeps provider-specific dispatch fields explicit", () => {
    expect(dispatchFieldSupport("packers_ecotrack")).toEqual({
      remarks: true,
      weight: true,
      fragile: true,
    });
    expect(dispatchFieldSupport("noest")).toEqual({
      remarks: true,
      weight: true,
      fragile: false,
    });
    // Yalidine: weight is a real create-parcel field (oversize fee past
    // 5kg billable); no remarks endpoint; no fragile field.
    expect(dispatchFieldSupport("yalidine")).toEqual({
      remarks: false,
      weight: true,
      fragile: false,
    });
    // ZR Express exposes none of the three.
    expect(dispatchFieldSupport("zr_express")).toEqual({
      remarks: false,
      weight: false,
      fragile: false,
    });
  });

  it("keeps carrier actions inside each provider status window", () => {
    expect(
      shipmentCapabilities("packers_ecotrack", "dispatched", true),
    ).toMatchObject({
      canValidate: true,
      canUpdate: true,
      canCancel: true,
      canRemark: true,
      canTrack: true,
    });
    expect(
      shipmentCapabilities("noest", "out_for_delivery", true),
    ).toMatchObject({
      canValidate: false,
      canUpdate: false,
      canCancel: false,
      canRemark: true,
      canTrack: true,
    });
    expect(
      shipmentCapabilities("zr_express", "dispatched", true),
    ).toMatchObject({
      canUpdate: true,
      // DELETE /parcels/bulk/by-tracking-number works (live-verified 2026-09-10;
      // the old 405 came from wrongly using POST) — cancel is offered while the
      // order is not in a terminal status.
      canCancel: true,
      canRemark: false,
      canTrack: true,
    });
    expect(
      shipmentCapabilities("yalidine", "out_for_delivery", true),
    ).toMatchObject({
      canUpdate: true,
      canCancel: true,
      canRemark: false,
      canTrack: true,
    });
  });

  it("exposes only carrier-supported update fields", () => {
    expect(shipmentUpdateFieldSupport("noest")).toMatchObject({
      phone2: true,
      weight: true,
      fragile: true,
      remarks: true,
    });
    expect(shipmentUpdateFieldSupport("yalidine")).toMatchObject({
      phone2: false,
      weight: true,
      fragile: false,
      remarks: false,
    });
    expect(shipmentUpdateFieldSupport("zr_express")).toMatchObject({
      phone2: false,
      weight: false,
      fragile: false,
      remarks: false,
    });
  });

  it("keeps assignment, dispatch, and deletion inside the legacy eligibility windows", () => {
    const ready = order({ status: "ready" });
    expect(canAssignOrder(ready)).toBe(true);
    expect(canDispatchOrder(ready)).toBe(true);
    expect(canAssignOrder(order({ status: "unreachable" }))).toBe(false);
    expect(
      canDispatchOrder(order({ driverId: "d1", deliveryMethod: "driver" })),
    ).toBe(false);
    expect(canDeleteOrderFromDetail("new")).toBe(true);
    expect(canDeleteOrderFromDetail("preparing")).toBe(true);
    expect(canDeleteOrderFromDetail("confirmed")).toBe(false);
  });

  it("uses the delivery method's full lifecycle for the detail timeline", () => {
    expect(
      orderStatusFlow(order({ deliveryMethod: "driver", driverId: "d1" })),
    ).toEqual([
      "new",
      "confirmed",
      "preparing",
      "ready",
      "assigned",
      "out_for_delivery",
      "delivered",
    ]);
    expect(
      orderStatusFlow(
        order({ deliveryMethod: "company", trackingNumber: "TRK-1" }),
      ),
    ).toEqual([
      "new",
      "confirmed",
      "preparing",
      "ready",
      "dispatched",
      "out_for_delivery",
      "delivered",
    ]);
  });

  it("sorts and paginates the filtered order collection", () => {
    const rows = [
      order({ id: "1", orderNumber: "ORD-003", price: 300 }),
      order({ id: "2", orderNumber: "ORD-001", price: 100 }),
      order({ id: "3", orderNumber: "ORD-002", price: 200 }),
    ];

    expect(
      sortOrders(rows, "orderNumber", "asc").map((item) => item.id),
    ).toEqual(["2", "3", "1"]);
    expect(sortOrders(rows, "total", "desc").map((item) => item.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
    expect(paginateOrders(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });
});

/**
 * The "what they were buying" column on the abandoned-checkout list.
 *
 * This list is the merchant's callback queue, so the column has to be good
 * enough to hold the conversation from — which is why a basket lists every
 * line rather than summarising, and why a single-product record refuses to
 * invent a quantity it never stored.
 */
describe("abandonedBasketView", () => {
  const hoodie = {
    productId: "p1",
    productName: "Hoodie Classic",
    variantId: "v-black-l",
    variantLabel: "Noir / L",
    quantity: 2,
    unitPrice: 2400,
  };
  const tshirt = {
    productId: "p2",
    productName: "Street Fighter 45",
    variantId: null,
    variantLabel: null,
    quantity: 1,
    unitPrice: 1000,
  };

  it("lists every line of a basket", () => {
    const view = abandonedBasketView({
      items: [hoodie, tshirt],
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
    });

    expect(view.kind).toBe("basket");
    if (view.kind !== "basket") return;
    expect(view.lines).toHaveLength(2);
    expect(view.lines[0]).toMatchObject({
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
      quantity: 2,
      lineTotal: 4800,
    });
    expect(view.lines[1]).toMatchObject({ productName: "Street Fighter 45", quantity: 1 });
  });

  it("gives every line a stable key, even for the same product twice", () => {
    // Same product, two variants, is two lines — React needs distinct keys.
    const view = abandonedBasketView({
      items: [hoodie, { ...hoodie, variantId: "v-black-m", variantLabel: "Noir / M" }],
      productName: null,
      variantLabel: null,
    });

    if (view.kind !== "basket") throw new Error("expected a basket");
    expect(new Set(view.lines.map((l) => l.key)).size).toBe(2);
  });

  it("prefers the basket over the flat fields stored beside it", () => {
    // Basket rows carry BOTH — the flat columns hold the first line so older
    // readers keep working. The basket is the fuller truth.
    const view = abandonedBasketView({
      items: [tshirt],
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
    });

    if (view.kind !== "basket") throw new Error("expected a basket");
    expect(view.lines[0].productName).toBe("Street Fighter 45");
  });

  it("shows a single-product record without inventing a quantity", () => {
    // The record never stored one. "1×" would be a guess, and the shopper may
    // well have been ordering three.
    const view = abandonedBasketView({
      items: null,
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
    });

    expect(view).toEqual({
      kind: "product",
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
    });
  });

  it("treats an empty basket as no basket", () => {
    const view = abandonedBasketView({ items: [], productName: "Hoodie", variantLabel: null });

    expect(view.kind).toBe("product");
  });

  it("says nothing is known when the shopper only left contact details", () => {
    expect(abandonedBasketView({ items: null, productName: null, variantLabel: null })).toEqual({
      kind: "unknown",
    });
  });
});
