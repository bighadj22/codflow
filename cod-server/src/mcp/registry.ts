/**
 * Scope-gated tool registry.
 *
 * `buildToolsForUser()` is the only function the MCP agent calls during
 * `init()`. It returns the exact set of Vercel-AI-SDK tools this user is
 * allowed to use, based on their OAuth scopes (and admin role).
 *
 * Two invariants the rest of the MCP layer relies on:
 *
 *   1. A tool never reaches the LLM if the user lacks the scope.
 *      This is enforced at registration time — not at execute time — so
 *      the MCP client (Claude, ChatGPT, etc.) literally cannot see tools
 *      it has no permission to call. That's a stronger guarantee than
 *      per-call scope checks would give.
 *
 *   2. Admin (`role === "admin"` OR scopes include `"*"`) sees every tool
 *      in every entry, regardless of per-entry scope requirements. This
 *      matches the existing RBAC middleware semantics in
 *      `cod-shared/rbac/utils.ts::hasPermission`.
 *
 * The `TOOL_REGISTRY` array below holds one entry per scope requirement. Each
 * entry picks a subset of tools from one of the 14 ai-tools factories. Adding a
 * new tool domain is a single `TOOL_REGISTRY.push({ ... })` entry — no other
 * file needs to change.
 */

import type { Tool } from "ai";
import { hasPermission } from "../../../cod-shared/rbac/utils";
import { SCOPES } from "../../../cod-shared/rbac/scopes";
import { getDb } from "@/db";
import type { Env } from "@/types/env";
import type { McpProps } from "./props";

// Factories from the existing ai-tools files. These are Vercel-AI-SDK
// tool bundles — NOT MCP tools yet. The CodMcpAgent adapter (src/mcp/server.ts)
// translates each to an MCP-SDK tool at registration time.
import { getCustomerTools }      from "@/endpoints/customers/ai-tools";
import { getDriverTools }        from "@/endpoints/drivers/ai-tools";
import { getDriverPaymentTools } from "@/endpoints/driver-payments/ai-tools";
import { getProductTools }       from "@/endpoints/products/ai-tools";
import { getProductGroupTools }  from "@/endpoints/product-groups/ai-tools";
import { getOfferTools }         from "@/endpoints/offers/ai-tools";
import { getVariantTools }       from "@/endpoints/variants/ai-tools";
import { getWilayaTools }        from "@/endpoints/wilayas/ai-tools";
import { getStockTools }         from "@/endpoints/stock/ai-tools";
import { getShippingProfileTools } from "@/endpoints/shipping-profiles/ai-tools";
import { getReviewTools }        from "@/endpoints/reviews/ai-tools";
import { getCustomerGroupTools } from "@/endpoints/customer-groups/ai-tools";
import { getCustomerTagTools }   from "@/endpoints/customer-tags/ai-tools";
import { getOrderTools }         from "@/endpoints/orders/ai-tools";

type ToolFactory = (
  db: ReturnType<typeof getDb>,
  props: McpProps,
) => Record<string, Tool>;

export interface ToolRegistryEntry {
  /**
   * Scopes required to register this entry's tools. Semantics: ALL scopes
   * in the array must match (AND). Keep this short — 1 or 2 scopes.
   * For "any of these scopes" semantics split into multiple entries.
   */
  requires: string[];
  /** Factory that returns one or more tool definitions. Called only when scopes pass. */
  build: ToolFactory;
}

/**
 * Sub-selects named keys from a domain's full ai-tools bundle.
 * Returns a fresh object so other entries can't see our selection.
 */
function pick<K extends string, T extends Record<string, Tool>>(
  source: T,
  keys: readonly K[],
): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key as keyof T];
  }
  return out;
}

/**
 * Source of truth for which tools exist at MCP level and what scope gates them.
 * Order does not matter — entries are additive. Duplicates between entries
 * are silently deduped by Object.assign in buildToolsForUser().
 *
 * Keep this table readable: one row per {scope × tool-group}. If a tool
 * requires TWO scopes (rare), put all required scopes in `requires`.
 * Admins bypass everything via the `role === "admin"` check in
 * buildToolsForUser — no special wildcard row needed here.
 *
 * New domains (orders, products, stock, reviews, offers) are added in
 * MCP-14 when their ai-tools.ts files land.
 */
export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  // ─── Customers ────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.CUSTOMERS_READ],
    build: (db) => pick(getCustomerTools(db), [
      "listCustomers",
      "getCustomerDetails",
      "findCustomerByPhone",
      "getCustomerOrderHistory",
      "getCustomerMemberships",
    ]),
  },
  {
    requires: [SCOPES.CUSTOMERS_CREATE],
    build: (db) => pick(getCustomerTools(db), ["createNewCustomer"]),
  },
  {
    requires: [SCOPES.CUSTOMERS_UPDATE],
    build: (db) => pick(getCustomerTools(db), ["updateCustomerProfile"]),
  },
  {
    requires: [SCOPES.CUSTOMERS_DELETE],
    build: (db) => pick(getCustomerTools(db), ["deleteCustomer"]),
  },

  // ─── Drivers (scope family is "delivery:*") ───────────────────────────────
  {
    requires: [SCOPES.DELIVERY_READ],
    build: (db) => pick(getDriverTools(db), ["listDrivers", "getDriverDetails"]),
  },
  {
    requires: [SCOPES.DELIVERY_CREATE],
    build: (db) => pick(getDriverTools(db), ["createNewDriver"]),
  },
  {
    requires: [SCOPES.DELIVERY_UPDATE],
    build: (db) => pick(getDriverTools(db), [
      "updateDriverProfile",
      "updateDriverStatus",
    ]),
  },
  {
    requires: [SCOPES.DELIVERY_DELETE],
    build: (db) => pick(getDriverTools(db), ["deleteDriver"]),
  },

  // ─── Driver payments ──────────────────────────────────────────────────────
  // Read and write both live under DELIVERY_MANAGE (matching the existing
  // REST routes). The risky `createDriverSettlement` gets an extra HITL
  // elicitation gate — wired in MCP-11 via the DANGEROUS_TOOLS set.
  {
    requires: [SCOPES.DELIVERY_MANAGE],
    build: (db) => pick(getDriverPaymentTools(db), [
      "listDriverPayments",
      "getPendingSettlements",
      "createDriverSettlement",
    ]),
  },

  // ─── Products ─────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.PRODUCTS_READ],
    build: (db) => pick(getProductTools(db), [
      "listProducts",
      "getProductDetails",
    ]),
  },
  {
    requires: [SCOPES.PRODUCTS_MANAGE],
    build: (db) => pick(getProductTools(db), [
      "createNewProduct",
      "updateProductDetails",
      "updateProductStatus",
      "deleteProduct",
    ]),
  },

  // ─── Product Groups ───────────────────────────────────────────────────────
  {
    requires: [SCOPES.PRODUCT_GROUPS_READ],
    build: (db) => pick(getProductGroupTools(db), [
      "listProductGroups",
      "getProductGroupDetails",
    ]),
  },
  {
    requires: [SCOPES.PRODUCT_GROUPS_MANAGE],
    build: (db) => pick(getProductGroupTools(db), [
      "createProductGroup",
      "updateProductGroup",
      "deleteProductGroup",
    ]),
  },

  // ─── Offers ───────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.OFFERS_READ],
    build: (db) => pick(getOfferTools(db), [
      "listOffers",
      "getOfferDetails",
    ]),
  },
  {
    requires: [SCOPES.OFFERS_MANAGE],
    build: (db) => pick(getOfferTools(db), [
      "createOffer",
      "updateOffer",
      "deleteOffer",
    ]),
  },

  // ─── Variants ─────────────────────────────────────────────────────────────
  // Variants are sub-resources of products and share the same scope family.
  {
    requires: [SCOPES.PRODUCTS_READ],
    build: (db) => pick(getVariantTools(db), [
      "listProductVariants",
      "getVariantDetails",
    ]),
  },
  {
    requires: [SCOPES.PRODUCTS_MANAGE],
    build: (db) => pick(getVariantTools(db), [
      "createProductVariant",
      "updateVariant",
      "deleteProductVariant",
    ]),
  },

  // ─── Wilayas (read-only reference data) ──────────────────────────────────
  // Wilaya/commune lookups are needed by any agent working with customers,
  // drivers, or orders. Register under both CUSTOMERS_READ and DELIVERY_READ
  // so the tools appear for either scope — Object.assign in buildToolsForUser
  // deduplicates if both scopes are present.
  {
    requires: [SCOPES.CUSTOMERS_READ],
    build: (db) => pick(getWilayaTools(db), ["listWilayas", "listWilayaCommunes"]),
  },
  {
    requires: [SCOPES.DELIVERY_READ],
    build: (db) => pick(getWilayaTools(db), ["listWilayas", "listWilayaCommunes"]),
  },

  // ─── Stock ────────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.STOCK_READ],
    build: (db) => pick(getStockTools(db), [
      "getStockOverview",
      "getStockAlerts",
      "getProductStockHistory",
    ]),
  },
  {
    requires: [SCOPES.STOCK_MANAGE],
    build: (db) => pick(getStockTools(db), [
      "adjustProductStock",
      "adjustVariantStock",
      "updateProductStockThreshold",
      "updateVariantStockThreshold",
    ]),
  },

  // ─── Shipping Profiles ────────────────────────────────────────────────────
  {
    requires: [SCOPES.DELIVERY_READ],
    build: (db) => pick(getShippingProfileTools(db), [
      "listShippingProfiles",
      "getShippingProfile",
      "getDefaultShippingRules",
      "listCommuneOverrides",
    ]),
  },
  {
    requires: [SCOPES.DELIVERY_MANAGE],
    build: (db) => pick(getShippingProfileTools(db), [
      "createShippingProfile",
      "updateShippingProfile",
      "deleteShippingProfile",
      "setShippingProfileRules",
      "setShippingCommuneOverride",
      "resetShippingCommuneOverride",
    ]),
  },

  // ─── Reviews ──────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.REVIEWS_READ],
    build: (db) => pick(getReviewTools(db), ["listReviews"]),
  },
  {
    requires: [SCOPES.REVIEWS_MANAGE],
    build: (db) => pick(getReviewTools(db), [
      "moderateReview",
      "deleteReview",
    ]),
  },

  // ─── Customer Groups ──────────────────────────────────────────────────────
  {
    requires: [SCOPES.CUSTOMER_GROUPS_READ],
    build: (db) => pick(getCustomerGroupTools(db), [
      "listCustomerGroups",
      "getCustomerGroupDetails",
    ]),
  },
  {
    requires: [SCOPES.CUSTOMER_GROUPS_MANAGE],
    build: (db) => pick(getCustomerGroupTools(db), [
      "createCustomerGroup",
      "updateCustomerGroup",
      "deleteCustomerGroup",
      "addCustomerToGroup",
      "removeCustomerFromGroup",
    ]),
  },

  // ─── Customer Tags ────────────────────────────────────────────────────────
  {
    requires: [SCOPES.CUSTOMER_TAGS_READ],
    build: (db) => pick(getCustomerTagTools(db), [
      "listCustomerTags",
      "getCustomerTagDetails",
    ]),
  },
  {
    requires: [SCOPES.CUSTOMER_TAGS_MANAGE],
    build: (db) => pick(getCustomerTagTools(db), [
      "createCustomerTag",
      "updateCustomerTag",
      "deleteCustomerTag",
      "assignTagToCustomer",
      "unassignTagFromCustomer",
    ]),
  },

  // ─── Orders ───────────────────────────────────────────────────────────────
  {
    requires: [SCOPES.ORDERS_READ],
    build: (db) => pick(getOrderTools(db), [
      "listOrders",
      "getOrderDetails",
    ]),
  },
  {
    requires: [SCOPES.ORDERS_CREATE],
    build: (db) => pick(getOrderTools(db), ["createOrder"]),
  },
  {
    requires: [SCOPES.ORDERS_UPDATE],
    build: (db) => pick(getOrderTools(db), [
      "updateOrderStatus",
      "recordOrderProductReturn",
    ]),
  },
  {
    requires: [SCOPES.ORDERS_ASSIGN],
    build: (db) => pick(getOrderTools(db), [
      "assignDriverToOrder",
      "unassignDriverFromOrder",
    ]),
  },
  {
    requires: [SCOPES.ORDERS_DELETE],
    build: (db) => pick(getOrderTools(db), ["deleteOrder"]),
  },
];

/**
 * Compose the tool map Claude / any MCP client will see for this session.
 * Pure function over `TOOL_REGISTRY` + caller's scopes — safe to call
 * many times; `getDb` returns the same Drizzle wrapper for a given env.
 */
export function buildToolsForUser(env: Env, props: McpProps): Record<string, Tool> {
  const db = getDb(env.DB);
  const isAdmin = props.role === "admin";
  const out: Record<string, Tool> = {};

  for (const entry of TOOL_REGISTRY) {
    const allowed = isAdmin || entry.requires.every((s) => hasPermission(props.scopes, s));
    if (!allowed) continue;
    Object.assign(out, entry.build(db, props));
  }

  return out;
}
