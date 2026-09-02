export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "unreachable",
  "preparing",
  "ready",
  "assigned",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type DeliveryMethod = "unassigned" | "driver" | "company";
export type DeliveryType = "home" | "stop_desk";
export type OrderType = "online" | "offline";

export interface StatusHistoryItem {
  id: string;
  orderId?: string;
  status: OrderStatus;
  timestamp: string;
  by: string | null;
  byName: string | null;
}

export interface OrderProduct {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  sku?: string | null;
  quantity: number;
  pricePerUnit: number;
  lineTotal: number;
  status: "fulfilled" | "partially_returned" | "returned";
  returnedQuantity: number;
  createdAt: string;
}

export interface OrderBase {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  wilayaId: number | null;
  wilaya: string | null;
  communeId: string | null;
  commune: string | null;
  city: string | null;
  address: string | null;
  price: number;
  deliveryFee: number;
  driverFee: number;
  codAmount: number | null;
  status: OrderStatus;
  orderType: OrderType;
  deliveryMethod: DeliveryMethod;
  deliveryType: DeliveryType;
  driverId: string | null;
  driverName: string | null;
  companyId: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignmentNotes: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  externalOrderId: string | null;
  stationCode: string | null;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAttempts: number | null;
  notes: string | null;
  photos: string | null;
  weight: number | null;
  isFragile: boolean | null;
  codPaymentId?: string | null;
  feePaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListItem extends OrderBase {
  hasReview?: number;
  lastUpdatedBy?: string | null;
}

export interface OrderDetail extends OrderBase {
  products: OrderProduct[];
  statusHistory: StatusHistoryItem[];
  labelUrl?: string | null;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string | null;
  vehicleType: "motorcycle" | "car" | "van" | null;
  status: "available" | "busy" | "inactive";
}

export interface DeliveryCompany {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  active: boolean;
  isConnected: boolean;
  supportsHomeDelivery: boolean;
  supportsStopDesk: boolean;
  supportsTracking: boolean;
  autoValidate: boolean | null;
}

export interface StopDesk {
  id: string;
  companyId: string;
  code: string;
  name: string;
  commune: string | null;
  wilayaId: number | null;
  address: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2: string | null;
  wilayaId: number | null;
  communeId: string | null;
  wilaya: string;
  commune: string | null;
  address: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  variations: Record<string, string>;
  price: number;
  sku: string;
  inventory: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  inventory: number;
  totalInventory: number;
  trackInventory: boolean;
  shippingProfileId: string | null;
}

export interface ShippingRule {
  id: string;
  profileId: string;
  wilayaId: number;
  wilayaName: string;
  wilayaNameAr: string;
  homePrice: number;
  stopDeskPrice: number;
  homeEnabled: boolean;
  stopDeskEnabled: boolean;
}

export interface Wilaya {
  id: number;
  name: string;
  nameAr: string;
}

export interface Commune {
  id: string;
  wilayaId: number;
  name: string;
  nameAr: string;
  postalCode: string | null;
}

export const ABANDONED_STATUSES = [
  "pending",
  "abandoned",
  "contacted",
  "converted",
] as const;

export type AbandonedOrderStatus = (typeof ABANDONED_STATUSES)[number];

export interface AbandonedOrder {
  id: string;
  sessionId: string;
  customerName: string;
  phone: string;
  wilayaId: number | null;
  communeId: string | null;
  wilayaName: string | null;
  communeName: string | null;
  productId: string | null;
  productName: string | null;
  variantId: string | null;
  variantLabel: string | null;
  price: number | null;
  deliveryType: DeliveryType | null;
  status: AbandonedOrderStatus;
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
  recoveryAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface AbandonedStats {
  totalAbandoned: number;
  totalConverted: number;
  conversionRate: number;
  estimatedLostRevenue: number;
}
