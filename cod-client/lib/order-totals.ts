/**
 * Order money math — single source of truth for dashboard displays.
 *
 * orders.price is the ITEMS-ONLY subtotal (both creation paths store it that
 * way; see cod-server/src/endpoints/orders/handlers.ts where
 * codAmount = price + deliveryFee). Never subtract shipping from it.
 */
export interface OrderTotalsInput {
  /** Items-only price as stored in orders.price */
  price: number;
  /** Delivery fee charged to the customer (orders.deliveryFee) */
  deliveryFee: number;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export function computeOrderTotals({ price, deliveryFee }: OrderTotalsInput): OrderTotals {
  return {
    subtotal: price,
    deliveryFee,
    total: price + deliveryFee,
  };
}
