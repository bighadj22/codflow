// Order related types

import { DeliveryType } from "./delivery.types";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "unreachable"
  | "preparing"
  | "ready"
  | "assigned"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled";

export type OrderType = "online" | "offline";

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  wilaya: string;
  wilayaId: number | null;
  commune: string | null;
  city: string | null;
  address: string | null;
  price: number;
  notes: string | null;
  status: OrderStatus;
  orderType: OrderType;
  /**
   * "unassigned" at creation — the customer/admin only picks a price tier; the
   * actual fulfilment channel (driver vs company) is chosen later via the
   * assignment endpoints.
   */
  deliveryMethod: "unassigned" | "driver" | "company";
  driverId: string | null;
  driverName: string | null;
  companyId: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignmentNotes: string | null;
  deliveryType: DeliveryType;
  deliveryFee: number;
  /**
   * What the store pays the driver for this delivery, looked up from
   * driver_compensations by (driverId, wilayaId). 0 when no compensation row
   * exists or no driver is assigned.
   */
  driverFee: number;
  codAmount: number | null;
  /** Set when the COD for this order has been remitted to the shop. */
  codPaymentId: string | null;
  /** Set when the driver's fee for this order has been paid out. */
  feePaymentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  /** PDF label URL from the company shipment record (null if not generated or not dispatched). */
  labelUrl: string | null;
  externalOrderId: string | null;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAttempts: number | null;
  /** Stored as a JSON string in the DB; parse before use. */
  photos: string | null;
  /** Parcel weight in kg — sent to carriers that accept it (ecotrack, noest, yalidine). */
  weight: number | null;
  /** Fragile flag — sent to carriers that accept it (ecotrack, noest). */
  isFragile: boolean | null;
  /** 1 if a customer review exists for this order, 0 otherwise. */
  hasReview?: number;
  /** The `by` field from the most recent orderStatusHistory entry. "webhook:zr_express" | "webhook:yalidine" | userId | null */
  lastUpdatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Products in this order. */
  products: OrderProduct[];
  statusHistory: StatusHistoryItem[];
}

export interface StatusHistoryItem {
  id: string;
  status: OrderStatus;
  timestamp: string;
  by: string | null;
  byName: string | null;
}

/**
 * Per-line fulfilment outcome — supports the Algerian "open-the-box" return
 * pattern where customers refuse part of an order at the door.
 *   fulfilled           — kept all units (returnedQuantity = 0)
 *   partially_returned  — kept some, returned some (0 < returnedQuantity < quantity)
 *   returned            — refused the whole line (returnedQuantity = quantity)
 */
export type OrderProductStatus = "fulfilled" | "partially_returned" | "returned";

export interface OrderProduct {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null; // e.g. "أحمر / XL"
  quantity: number;
  pricePerUnit: number;
  lineTotal: number;
  status: OrderProductStatus;
  /** Units the customer refused at the door. 0 when status = fulfilled. */
  returnedQuantity: number;
  createdAt: string;
}

export interface OrderFormState {
  mode: OrderType;
  customerId: string | null;
  customerName: string;
  phone: string;
  wilaya: string;
  city: string;
  address: string;
  selectedProducts: OrderProduct[];
  notes: string;
}
