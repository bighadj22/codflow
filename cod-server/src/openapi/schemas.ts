/**
 * OpenAPI Schemas - Central Export
 *
 * Clean, organized domain-based schema structure.
 * All schemas are organized by domain in separate files under schemas/*.ts
 *
 * Domain organization:
 * - common.ts: Response wrappers (Error, Success, List, Message)
 * - reference.ts: Algerian administrative data (Wilaya, Commune)
 * - users.ts: Team members and auth
 * - activity.ts: Audit logs
 * - customers.ts: Customer profiles, groups, tags
 * - products.ts: Products, variants, categories, stock, offers
 * - delivery.ts: Delivery companies, drivers, stop desks, shipping
 * - reviews.ts: Product reviews
 * - store.ts: Store config, branding, storefront views
 * - orders.ts: Orders, shipments, abandoned orders
 */

import { z } from "@hono/zod-openapi";

// ─── Common Response Wrappers ─────────────────────────────────────────────────

export {
  // Error
  ErrorResponseSchema,
  
  // Success wrappers
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  
  // List wrappers
  ListResponseSchema,
  ListWithTotalResponseSchema,
  
  // Utilities
  IdParamSchema,
  PaginationQuerySchema,
} from "./schemas/common";

// ─── Reference Data ───────────────────────────────────────────────────────────

export {
  WilayaSchema,
  CommuneSchema,
} from "./schemas/reference";

// ─── Users ────────────────────────────────────────────────────────────────────

export {
  UserSchema,
} from "./schemas/users";

// ─── Activity Logs ────────────────────────────────────────────────────────────

export {
  ActivityLogSchema,
} from "./schemas/activity";

// ─── Reviews ──────────────────────────────────────────────────────────────────

export {
  ReviewSchema,
} from "./schemas/reviews";

// ─── Customers ────────────────────────────────────────────────────────────────

export {
  CustomerSchema,
  CustomerGroupMemberSchema,
  CustomerOrderStatusSchema,
  CustomerOrderSummarySchema,
  CustomerGroupMembershipSchema,
  CustomerTagMembershipSchema,
  CustomerGroupSchema,
  CustomerTagCustomerSchema,
  CustomerTagSchema,
} from "./schemas/customers";

// ─── Delivery & Logistics ─────────────────────────────────────────────────────

export {
  DeliveryCompanySchema,
  StopDeskSchema,
  ShippingRuleSchema,
  ShippingProfileWithRulesSchema,
  ShippingProfileSchema,
  CommuneOverrideSchema,
  DriverSchema,
  DriverCompensationRowSchema,
  DriverPaymentSchema,
} from "./schemas/delivery";

// ─── Products ─────────────────────────────────────────────────────────────────

export {
  ProductCategoryRowSchema,
  ProductCategorySchema,
  ProductVariantOptionSchema,
  ProductImageSchema,
  ProductVariantSchema,
  ProductSchema,
  StockMovementSchema,
  StockAlertItemSchema,
  StockOverviewSchema,
  OfferSchema,
  UploadedImageSchema,
  PresignedUploadSchema,
} from "./schemas/products";

// ─── Store & Storefront ───────────────────────────────────────────────────────

export {
  StoreSchema,
  StorePixelConfigSchema,
  StoreProductImageSchema,
  StoreReviewStatsSchema,
  StoreProductListSchema,
  StoreOfferSummarySchema,
  StoreProductDetailSchema,
  StoreConfigSchema,
} from "./schemas/store";

// ─── Orders ───────────────────────────────────────────────────────────────────

export {
  // Enums
  OrderStatusEnum,
  DeliveryMethodEnum,
  DeliveryTypeEnum,
  OrderTypeEnum,
  OrderProductStatusEnum,
  
  // Entity schemas
  StatusHistoryItemSchema,
  OrderProductSchema,
  OrderListItemSchema,
  OrderDetailSchema,
  OrderSchema, // Alias for backward compatibility
  
  // Abandoned orders
  AbandonedOrderStatusEnum,
  AbandonedOrderSchema,
  AbandonedOrderStatsSchema,
  
  // Response data schemas
  OrderCreatedDataSchema,
  ShipmentCreatedDataSchema,
  BulkDispatchResultItemSchema,
  BulkDispatchDataSchema,
  ReturnProductDataSchema,
  CarrierRecordsArraySchema,
  
  // Types
  type OrderStatus,
  type DeliveryMethod,
  type DeliveryType,
  type OrderType,
  type OrderProductStatus,
} from "./schemas/orders";
