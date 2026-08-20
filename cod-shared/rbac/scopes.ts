/**
 * Centralized Scope Definitions for RBAC System
 * 
 * This file defines all permission scopes used throughout the application.
 * Scopes follow the format: resource:action
 * 
 * These definitions are shared between frontend and backend to ensure
 * consistent permission checking across the entire system.
 */

export const SCOPES = {
  // Dashboard
  /** View dashboard overview and statistics */
  DASHBOARD_VIEW: "dashboard:view",
  
  // Orders
  /** View orders list and order details */
  ORDERS_READ: "orders:read",
  /** Create new orders */
  ORDERS_CREATE: "orders:create",
  /** Update order status and details */
  ORDERS_UPDATE: "orders:update",
  /** Cancel or delete orders */
  ORDERS_DELETE: "orders:delete",
  /** Assign orders to drivers */
  ORDERS_ASSIGN: "orders:assign",
  
  // Customers
  /** View customers list and customer profiles */
  CUSTOMERS_READ: "customers:read",
  /** Create new customers */
  CUSTOMERS_CREATE: "customers:create",
  /** Update customer information */
  CUSTOMERS_UPDATE: "customers:update",
  /** Delete customers */
  CUSTOMERS_DELETE: "customers:delete",
  
  // Products
  /** View products catalog */
  PRODUCTS_READ: "products:read",
  /** Create new products */
  PRODUCTS_CREATE: "products:create",
  /** Update product information */
  PRODUCTS_UPDATE: "products:update",
  /** Delete products */
  PRODUCTS_DELETE: "products:delete",
  /** Manage product variations and inventory */
  PRODUCTS_MANAGE: "products:manage",
  
  // Delivery
  /** View drivers and delivery information */
  DELIVERY_READ: "delivery:read",
  /** Create new drivers */
  DELIVERY_CREATE: "delivery:create",
  /** Update driver information */
  DELIVERY_UPDATE: "delivery:update",
  /** Delete drivers */
  DELIVERY_DELETE: "delivery:delete",
  /** Assign orders to drivers */
  DELIVERY_ASSIGN: "delivery:assign",
  /** Manage drivers and delivery settings */
  DELIVERY_MANAGE: "delivery:manage",
  /** Dispatch orders to third-party delivery company APIs (create shipments) */
  DELIVERY_DISPATCH: "delivery:dispatch",
  
  // Customer Groups
  /** View customer groups */
  CUSTOMER_GROUPS_READ: "customer_groups:read",
  /** Create, update, delete customer groups and manage members */
  CUSTOMER_GROUPS_MANAGE: "customer_groups:manage",

  // Customer Tags
  /** View customer tags */
  CUSTOMER_TAGS_READ: "customer_tags:read",
  /** Create, update, delete customer tags and manage assignments */
  CUSTOMER_TAGS_MANAGE: "customer_tags:manage",

  // Product Groups
  /** View product groups and collections */
  PRODUCT_GROUPS_READ: "product_groups:read",
  /** Create, update, delete product groups */
  PRODUCT_GROUPS_MANAGE: "product_groups:manage",

  // Stock
  /** View stock levels and movement history */
  STOCK_READ: "stock:read",
  /** Adjust stock quantities */
  STOCK_MANAGE: "stock:manage",


  // Settings
  /** View settings pages */
  SETTINGS_VIEW: "settings:view",
  /** Manage team members and permissions */
  SETTINGS_TEAM: "settings:team",
  /** Manage integrations and API connections */
  SETTINGS_INTEGRATIONS: "settings:integrations",
  /** Manage notification templates */
  SETTINGS_NOTIFICATIONS: "settings:notifications",

  // Reviews
  /** View product reviews and their moderation status */
  REVIEWS_READ: "reviews:read",
  /** Approve, reject, and delete product reviews */
  REVIEWS_MANAGE: "reviews:manage",

  // Offers
  /** View promotional offers list */
  OFFERS_READ: "offers:read",
  /** Create, update, and delete promotional offers */
  OFFERS_MANAGE: "offers:manage",

  // Abandoned Orders
  /** View abandoned orders list and stats */
  ABANDONED_ORDERS_READ: "abandoned_orders:read",
  /** Update status and delete abandoned order records */
  ABANDONED_ORDERS_MANAGE: "abandoned_orders:manage",

  // MCP (remote AI agents via Model Context Protocol)
  /**
   * Access the /mcp page to view and manage your OWN connected AI apps
   * (Claude Desktop, Claude.ai, ChatGPT, etc.). Can see your own MCP URL,
   * your consent grants, and revoke your own connections. Does NOT let
   * the holder see other team members' connections — that's admin-only.
   */
  MCP_VIEW: "mcp:view",

  // Wildcard (admin only)
  /** All permissions - admin users only */
  ALL: "*",
} as const;

/**
 * Type representing any valid scope string
 */
export type Scope = typeof SCOPES[keyof typeof SCOPES];

/**
 * Array of all defined scopes (excluding wildcard)
 */
export const ALL_SCOPES = Object.values(SCOPES).filter(scope => scope !== "*");

/**
 * Scope categories for UI grouping
 */
export const SCOPE_CATEGORIES = {
  dashboard: {
    label: "Dashboard",
    scopes: [SCOPES.DASHBOARD_VIEW],
  },
  orders: {
    label: "Orders",
    scopes: [
      SCOPES.ORDERS_READ,
      SCOPES.ORDERS_CREATE,
      SCOPES.ORDERS_UPDATE,
      SCOPES.ORDERS_DELETE,
      SCOPES.ORDERS_ASSIGN,
    ],
  },
  customers: {
    label: "Customers",
    scopes: [
      SCOPES.CUSTOMERS_READ,
      SCOPES.CUSTOMERS_CREATE,
      SCOPES.CUSTOMERS_UPDATE,
      SCOPES.CUSTOMERS_DELETE,
    ],
  },
  customerGroups: {
    label: "Customer Groups",
    scopes: [SCOPES.CUSTOMER_GROUPS_READ, SCOPES.CUSTOMER_GROUPS_MANAGE],
  },
  customerTags: {
    label: "Customer Tags",
    scopes: [SCOPES.CUSTOMER_TAGS_READ, SCOPES.CUSTOMER_TAGS_MANAGE],
  },
  products: {
    label: "Products",
    scopes: [
      SCOPES.PRODUCTS_READ,
      SCOPES.PRODUCTS_CREATE,
      SCOPES.PRODUCTS_UPDATE,
      SCOPES.PRODUCTS_DELETE,
      SCOPES.PRODUCTS_MANAGE,
    ],
  },
  delivery: {
    label: "Delivery",
    scopes: [
      SCOPES.DELIVERY_READ,
      SCOPES.DELIVERY_CREATE,
      SCOPES.DELIVERY_UPDATE,
      SCOPES.DELIVERY_DELETE,
      SCOPES.DELIVERY_ASSIGN,
      SCOPES.DELIVERY_MANAGE,
      SCOPES.DELIVERY_DISPATCH,
    ],
  },
  productGroups: {
    label: "Product Groups",
    scopes: [SCOPES.PRODUCT_GROUPS_READ, SCOPES.PRODUCT_GROUPS_MANAGE],
  },
  stock: {
    label: "Stock",
    scopes: [SCOPES.STOCK_READ, SCOPES.STOCK_MANAGE],
  },
  reviews: {
    label: "Reviews",
    scopes: [SCOPES.REVIEWS_READ, SCOPES.REVIEWS_MANAGE],
  },
  offers: {
    label: "Offers",
    scopes: [SCOPES.OFFERS_READ, SCOPES.OFFERS_MANAGE],
  },
  abandonedOrders: {
    label: "Abandoned Orders",
    scopes: [SCOPES.ABANDONED_ORDERS_READ, SCOPES.ABANDONED_ORDERS_MANAGE],
  },
  mcp: {
    label: "AI Agents (MCP)",
    scopes: [SCOPES.MCP_VIEW],
  },
} as const;
