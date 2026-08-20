export type StockMovementType =
  | "PURCHASE"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_REMOVE"
  | "ORDER_DEDUCTED"
  | "ORDER_CANCELLED"
  | "ORDER_RETURNED"
  | "OFFLINE_SALE";

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string | null;
  type: StockMovementType;
  /** Signed delta — positive = stock in, negative = stock out. Never zero. */
  delta: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  /** orderId for ORDER_* types, null otherwise. */
  reference: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface StockAlertItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  inventory: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
}

export interface StockOverview {
  totalSkus: number;
  outOfStockCount: number;
  lowStockCount: number;
  /** Total inventory value in DZD (sum of inventory × price). */
  totalInventoryValue: number;
  currency: string;
  outOfStockItems: StockAlertItem[];
  lowStockItems: StockAlertItem[];
  /** Every tracked SKU — used for the "All" inventory tab. */
  allItems: StockAlertItem[];
}

export interface StockHistoryResponse {
  movements: StockMovement[];
  total: number;
}

export interface StockAlertsResponse {
  items: StockAlertItem[];
  total: number;
}

export interface AdjustStockInput {
  type: StockMovementType;
  /** Non-zero integer. Negative = remove stock. */
  delta: number;
  reason?: string;
}
