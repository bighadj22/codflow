/**
 * Shared Error Codes and Categories
 * 
 * Centralized error code registry for the COD platform.
 * Used by both backend (cod-server) and frontend (cod-client-astro).
 */

export const ERROR_CODES = {
  // ============================================================================
  // VALIDATION ERRORS (400, 422)
  // ============================================================================
  VALIDATION_FAILED: "VALIDATION_FAILED",
  REQUIRED_FIELD_MISSING: "REQUIRED_FIELD_MISSING",
  INVALID_FORMAT: "INVALID_FORMAT",
  VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE",
  INVALID_UUID: "INVALID_UUID",
  INVALID_EMAIL_FORMAT: "INVALID_EMAIL_FORMAT",
  INVALID_PHONE_FORMAT: "INVALID_PHONE_FORMAT",
  
  // ============================================================================
  // AUTHENTICATION ERRORS (401, 403)
  // ============================================================================
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_API_KEY: "INVALID_API_KEY",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  USER_INACTIVE: "USER_INACTIVE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - GENERAL (404, 409, 422)
  // ============================================================================
  ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
  DUPLICATE_ENTITY: "DUPLICATE_ENTITY",

  // ============================================================================
  // BUSINESS LOGIC ERRORS - MCP MANAGEMENT
  // ============================================================================
  MCP_CONNECTION_NOT_FOUND: "MCP_CONNECTION_NOT_FOUND",
  MCP_CLIENT_NOT_FOUND: "MCP_CLIENT_NOT_FOUND",

  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMERS
  // ============================================================================
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  CUSTOMER_HAS_ORDERS: "CUSTOMER_HAS_ORDERS",
  DUPLICATE_PHONE: "DUPLICATE_PHONE",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - ORDERS
  // ============================================================================
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_ALREADY_DISPATCHED: "ORDER_ALREADY_DISPATCHED",
  DRIVER_ALREADY_ASSIGNED: "DRIVER_ALREADY_ASSIGNED",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  MISSING_WILAYA_COMMUNE: "MISSING_WILAYA_COMMUNE",
  MISSING_STATION_CODE: "MISSING_STATION_CODE",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - PRODUCTS
  // ============================================================================
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_HAS_ORDERS: "PRODUCT_HAS_ORDERS",
  DUPLICATE_SKU: "DUPLICATE_SKU",
  VARIANT_NOT_FOUND: "VARIANT_NOT_FOUND",
  VARIANT_HAS_ORDERS: "VARIANT_HAS_ORDERS",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - DRIVERS
  // ============================================================================
  DRIVER_NOT_FOUND: "DRIVER_NOT_FOUND",
  DRIVER_HAS_ACTIVE_ORDERS: "DRIVER_HAS_ACTIVE_ORDERS",
  DRIVER_UNAVAILABLE: "DRIVER_UNAVAILABLE",
  DRIVER_COMPENSATION_NOT_FOUND: "DRIVER_COMPENSATION_NOT_FOUND",
  PAYMENT_ALREADY_SETTLED: "PAYMENT_ALREADY_SETTLED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - DELIVERY COMPANIES
  // ============================================================================
  COMPANY_NOT_FOUND: "COMPANY_NOT_FOUND",
  COMPANY_INACTIVE: "COMPANY_INACTIVE",
  PROVIDER_NOT_SUPPORTED: "PROVIDER_NOT_SUPPORTED",
  MISSING_API_CREDENTIALS: "MISSING_API_CREDENTIALS",
  SHIPMENT_CREATION_FAILED: "SHIPMENT_CREATION_FAILED",
  SHIPMENT_VALIDATION_FAILED: "SHIPMENT_VALIDATION_FAILED",
  SHIPMENT_UPDATE_FAILED: "SHIPMENT_UPDATE_FAILED",
  SHIPMENT_CANCEL_FAILED: "SHIPMENT_CANCEL_FAILED",
  SHIPMENT_NOT_FOUND: "SHIPMENT_NOT_FOUND",
  OPERATION_NOT_SUPPORTED: "OPERATION_NOT_SUPPORTED",

  // ============================================================================
  // BUSINESS LOGIC ERRORS - STOREFRONT OTP VERIFICATION (dzverify)
  // ============================================================================
  /** Store OTP verification is not enabled for this store. */
  OTP_NOT_ENABLED: "OTP_NOT_ENABLED",
  /** Order submission carried no OTP token while verification is enabled. */
  OTP_VERIFICATION_REQUIRED: "OTP_VERIFICATION_REQUIRED",
  /** OTP token failed signature/expiry verification. */
  OTP_TOKEN_INVALID: "OTP_TOKEN_INVALID",
  /** OTP token phone does not match the order phone (normalized E.164). */
  OTP_PHONE_MISMATCH: "OTP_PHONE_MISMATCH",
  /** dzverify balance too low — send failed (order proceeds unverified via bypass). */
  OTP_QUOTA_EXHAUSTED: "OTP_QUOTA_EXHAUSTED",
  /** dzverify rate limit hit — retry after the window in context. */
  OTP_RATE_LIMITED: "OTP_RATE_LIMITED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - STOCK
  // ============================================================================
  STOCK_RECORD_NOT_FOUND: "STOCK_RECORD_NOT_FOUND",
  NEGATIVE_STOCK_NOT_ALLOWED: "NEGATIVE_STOCK_NOT_ALLOWED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMER GROUPS
  // ============================================================================
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  GROUP_HAS_MEMBERS: "GROUP_HAS_MEMBERS",
  DUPLICATE_GROUP_NAME: "DUPLICATE_GROUP_NAME",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMER TAGS
  // ============================================================================
  TAG_NOT_FOUND: "TAG_NOT_FOUND",
  TAG_HAS_ASSIGNMENTS: "TAG_HAS_ASSIGNMENTS",
  DUPLICATE_TAG_NAME: "DUPLICATE_TAG_NAME",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - USERS
  // ============================================================================
  USER_NOT_FOUND: "USER_NOT_FOUND",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  INVALID_ROLE: "INVALID_ROLE",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - OFFERS
  // ============================================================================
  OFFER_NOT_FOUND: "OFFER_NOT_FOUND",
  OFFER_EXPIRED: "OFFER_EXPIRED",
  OFFER_NOT_ACTIVE: "OFFER_NOT_ACTIVE",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - REVIEWS
  // ============================================================================
  REVIEW_NOT_FOUND: "REVIEW_NOT_FOUND",
  ORDER_ALREADY_REVIEWED: "ORDER_ALREADY_REVIEWED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - SHIPPING PROFILES
  // ============================================================================
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  PROFILE_IN_USE: "PROFILE_IN_USE",
  DELIVERY_NOT_AVAILABLE: "DELIVERY_NOT_AVAILABLE",
  SHIPPING_PROFILE_NOT_FOUND: "SHIPPING_PROFILE_NOT_FOUND",
  SHIPPING_RULE_NOT_FOUND: "SHIPPING_RULE_NOT_FOUND",
  COMMUNE_OVERRIDE_NOT_FOUND: "COMMUNE_OVERRIDE_NOT_FOUND",
  DEFAULT_PROFILE_REQUIRED: "DEFAULT_PROFILE_REQUIRED",
  DUPLICATE_WILAYA_RULE: "DUPLICATE_WILAYA_RULE",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - PRODUCT GROUPS
  // ============================================================================
  PRODUCT_GROUP_NOT_FOUND: "PRODUCT_GROUP_NOT_FOUND",
  PRODUCT_GROUP_HAS_PRODUCTS: "PRODUCT_GROUP_HAS_PRODUCTS",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - WILAYAS
  // ============================================================================
  WILAYA_NOT_FOUND: "WILAYA_NOT_FOUND",
  COMMUNE_NOT_FOUND: "COMMUNE_NOT_FOUND",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - STORES
  // ============================================================================
  STORE_NOT_FOUND: "STORE_NOT_FOUND",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - IMAGES
  // ============================================================================
  IMAGE_NOT_FOUND: "IMAGE_NOT_FOUND",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - WEBHOOKS
  // ============================================================================
  INVALID_WEBHOOK_PAYLOAD: "INVALID_WEBHOOK_PAYLOAD",
  WEBHOOK_PROCESSING_FAILED: "WEBHOOK_PROCESSING_FAILED",
  
  // ============================================================================
  // BUSINESS LOGIC ERRORS - PAYMENTS
  // ============================================================================
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  
  // ============================================================================
  // SYSTEM ERRORS (500, 502, 503)
  // ============================================================================
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_API_FAILURE: "EXTERNAL_API_FAILURE",
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const ERROR_CATEGORIES = {
  VALIDATION: "VALIDATION",
  AUTHENTICATION: "AUTHENTICATION",
  BUSINESS_LOGIC: "BUSINESS_LOGIC",
  SYSTEM: "SYSTEM",
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];
