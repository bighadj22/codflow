/**
 * Application Constants
 * 
 * Centralized constants for the entire application.
 * All hardcoded values should be defined here for easy maintenance.
 */



// Order Statuses
export const ORDER_STATUSES = [
  "new",
  "preparing",
  "ready",
  "assigned",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Order Status Colors
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  preparing: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  ready: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  assigned: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  out_for_delivery: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  delivered: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  returned: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

// Vehicle Types
export const VEHICLE_TYPES = ["motorcycle", "car", "van"] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

// Delivery Types
export const DELIVERY_TYPES = ["home", "stop_desk"] as const;

export type DeliveryType = (typeof DELIVERY_TYPES)[number];

// Avatar Colors (for customer/driver avatars)
export const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#6C5CE7",
] as const;

// Product Categories
export const PRODUCT_CATEGORIES = [
  "أقمشة",
  "ملابس",
  "إكسسوارات",
  "أحذية",
  "حقائب",
  "أخرى",
] as const;
