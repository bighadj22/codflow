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
    expect(dispatchFieldSupport("yalidine")).toEqual({
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
      canCancel: false,
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
