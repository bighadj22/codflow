import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  adjustStockSchema,
  updateThresholdSchema,
  stockHistoryFiltersSchema,
  stockAlertsFiltersSchema,
  MOVEMENT_TYPES,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const getStockOverviewSchema = z.object({});
export const getStockAlertsSchema = stockAlertsFiltersSchema;
export const getProductStockHistoryToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the product"),
  variantId: z.string().uuid().optional().describe("UUID of a specific variant to filter history"),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export const adjustProductStockToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the simple product to adjust"),
  agentName: z.string().min(1).describe("Name of the AI agent or staff member making this adjustment"),
  type: z.enum(MOVEMENT_TYPES),
  delta: z.number().int().refine((v) => v !== 0, "delta must be non-zero"),
  reason: z.string().min(1).max(500).optional(),
});
export const adjustVariantStockToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the parent product"),
  variantId: z.string().uuid().describe("UUID of the variant to adjust"),
  agentName: z.string().min(1).describe("Name of the AI agent or staff member making this adjustment"),
  type: z.enum(MOVEMENT_TYPES),
  delta: z.number().int().refine((v) => v !== 0, "delta must be non-zero"),
  reason: z.string().min(1).max(500).optional(),
});
export const updateProductStockThresholdToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the simple product"),
  lowStockThreshold: updateThresholdSchema.shape.lowStockThreshold,
});
export const updateVariantStockThresholdToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the parent product"),
  variantId: z.string().uuid().describe("UUID of the variant"),
  lowStockThreshold: updateThresholdSchema.shape.lowStockThreshold,
});

export const STOCK_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  getStockOverview: getStockOverviewSchema.shape,
  getStockAlerts: getStockAlertsSchema.shape,
  getProductStockHistory: getProductStockHistoryToolSchema.shape,
  adjustProductStock: adjustProductStockToolSchema.shape,
  adjustVariantStock: adjustVariantStockToolSchema.shape,
  updateProductStockThreshold: updateProductStockThresholdToolSchema.shape,
  updateVariantStockThreshold: updateVariantStockThresholdToolSchema.shape,
};

/**
 * AI Tools for Stock / Inventory Management
 *
 * Stock is tracked at two levels:
 *   - Simple products (hasVariants=false): inventory lives on the product row.
 *   - Variant products (hasVariants=true):  inventory lives on each variant row.
 *
 * Movement types and their rules:
 *   PURCHASE          → stock arriving from supplier (delta > 0, no reason required)
 *   ADJUSTMENT_ADD    → manual positive correction  (delta > 0, reason REQUIRED)
 *   ADJUSTMENT_REMOVE → manual negative correction  (delta < 0, reason REQUIRED)
 *   ORDER_DEDUCTED    → auto-deducted when order placed (system use, delta < 0)
 *   ORDER_CANCELLED   → auto-restored when order cancelled (system use, delta > 0)
 *   ORDER_RETURNED    → stock returned after delivery (delta > 0)
 *   OFFLINE_SALE      → sale recorded outside the platform (delta < 0, reason REQUIRED)
 *
 * Delta sign convention: positive = stock arriving, negative = stock leaving.
 * Delta must be non-zero. The server rejects adjustments that would result in
 * negative inventory (INSUFFICIENT_STOCK error).
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getStockTools = (db: ReturnType<typeof getDb>) => ({

  getStockOverview: tool({
    description:
      "Returns aggregated inventory health metrics across all tracked SKUs. " +
      "Includes: totalSkus, outOfStockCount, lowStockCount, totalInventoryValue (DZD), " +
      "and three lists — outOfStockItems, lowStockItems (at or below threshold but still in stock), " +
      "and allItems (every tracked SKU sorted out-of-stock first then by inventory ascending). " +
      "Use this for a quick inventory health check or to find which products need restocking.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input — no parameters
    execute: async (_args) => {
      try {
        const overview = await queries.getStockOverview(db);
        return { success: true, overview };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  getStockAlerts: tool({
    description:
      "Paginated list of all SKUs at or below their low stock threshold, including out-of-stock items. " +
      "Sorted: out-of-stock first, then by inventory ascending. " +
      "Each item includes productId, variantId (null for simple products), productName, variantLabel, " +
      "inventory, lowStockThreshold, and isOutOfStock. " +
      "Optional: limit (1-100, default 50), offset (default 0).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = stockAlertsFiltersSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: limit (1-100, default 50), offset (integer >= 0, default 0)`,
        };
      }

      try {
        const result = await queries.getStockAlerts(db, parsed.data);
        return { success: true, ...result };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  getProductStockHistory: tool({
    description:
      "Paginated movement log for a product, ordered newest-first. " +
      "Each movement records: type, delta, qtyBefore, qtyAfter, reason, reference (orderId for ORDER_* types), " +
      "createdByName, and createdAt. " +
      "Required: productId (UUID). " +
      "Optional: variantId (UUID) to narrow to a specific variant's history, " +
      "limit (1-100, default 20), offset (default 0).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = getProductStockHistoryToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: productId (UUID), optional variantId (UUID), limit (1-100), offset (int >= 0)`,
        };
      }

      try {
        const result = await queries.getStockHistory(db, parsed.data.productId, {
          variantId: parsed.data.variantId,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        });
        return { success: true, ...result };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  adjustProductStock: tool({
    description:
      "Applies a signed integer delta to a simple product's inventory and records a movement log entry. " +
      "Required: productId (UUID), type (movement type), delta (non-zero integer — positive = stock in, negative = stock out), agentName (string). " +
      "reason is REQUIRED for types: ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE. " +
      "Movement types: PURCHASE (restock), ADJUSTMENT_ADD (manual correction up), ADJUSTMENT_REMOVE (manual correction down), " +
      "ORDER_RETURNED (returned stock), OFFLINE_SALE (sale outside platform). " +
      "The server rejects adjustments that would result in negative inventory (INSUFFICIENT_STOCK). " +
      "Use adjustVariantStock instead for variant products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = adjustProductStockToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid arguments: ${errorDetails}. ` +
            `Required: productId (UUID), agentName (string), type (${MOVEMENT_TYPES.join("|")}), delta (non-zero integer). ` +
            `reason is required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE.`,
        };
      }

      // Run through adjustStockSchema to catch the reason-required superRefine rule
      const bodyParsed = adjustStockSchema.safeParse({
        type: parsed.data.type,
        delta: parsed.data.delta,
        reason: parsed.data.reason,
      });

      if (!bodyParsed.success) {
        const errorDetails = bodyParsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Validation error: ${errorDetails}. reason is required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, and OFFLINE_SALE.`,
        };
      }

      try {
        const result = await queries.adjustStock(db, {
          productId: parsed.data.productId,
          variantId: null,
          createdBy: "ai-agent",
          createdByName: parsed.data.agentName,
          type: bodyParsed.data.type,
          delta: bodyParsed.data.delta,
          reason: bodyParsed.data.reason,
        });
        return {
          success: true,
          movement: result.movement,
          currentInventory: result.currentInventory,
          message: `Stock adjusted: ${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta} units. New inventory: ${result.currentInventory}`,
        };
      } catch (error: any) {
        // Parse INSUFFICIENT_STOCK structured error
        let errorMessage = error.message;
        if (error.data) {
          const d = error.data;
          if (d.available !== undefined && d.required !== undefined) {
            errorMessage =
              `${error.message}. ` +
              `Available: ${d.available}, Required: ${d.required}. ` +
              `Reduce the delta magnitude or restock first.`;
          }
        }
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  }),

  adjustVariantStock: tool({
    description:
      "Applies a signed integer delta to a specific product variant's inventory and records a movement log entry. " +
      "Required: productId (UUID), variantId (UUID), type (movement type), delta (non-zero integer), agentName (string). " +
      "reason is REQUIRED for types: ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE. " +
      "Delta sign: positive = stock in, negative = stock out. " +
      "The server rejects adjustments that would result in negative inventory (INSUFFICIENT_STOCK). " +
      "Use adjustProductStock instead for simple (non-variant) products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = adjustVariantStockToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid arguments: ${errorDetails}. ` +
            `Required: productId (UUID), variantId (UUID), agentName (string), type (${MOVEMENT_TYPES.join("|")}), delta (non-zero integer). ` +
            `reason is required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, OFFLINE_SALE.`,
        };
      }

      // Run through adjustStockSchema to catch the reason-required superRefine rule
      const bodyParsed = adjustStockSchema.safeParse({
        type: parsed.data.type,
        delta: parsed.data.delta,
        reason: parsed.data.reason,
      });

      if (!bodyParsed.success) {
        const errorDetails = bodyParsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Validation error: ${errorDetails}. reason is required for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE, and OFFLINE_SALE.`,
        };
      }

      try {
        const result = await queries.adjustStock(db, {
          productId: parsed.data.productId,
          variantId: parsed.data.variantId,
          createdBy: "ai-agent",
          createdByName: parsed.data.agentName,
          type: bodyParsed.data.type,
          delta: bodyParsed.data.delta,
          reason: bodyParsed.data.reason,
        });
        return {
          success: true,
          movement: result.movement,
          currentInventory: result.currentInventory,
          message: `Variant stock adjusted: ${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta} units. New inventory: ${result.currentInventory}`,
        };
      } catch (error: any) {
        let errorMessage = error.message;
        if (error.data) {
          const d = error.data;
          if (d.available !== undefined && d.required !== undefined) {
            errorMessage =
              `${error.message}. ` +
              `Available: ${d.available}, Required: ${d.required}. ` +
              `Reduce the delta magnitude or restock first.`;
          }
        }
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  }),

  updateProductStockThreshold: tool({
    description:
      "Sets the low stock alert threshold for a simple (non-variant) product. " +
      "When inventory drops to or below this value, the product appears in stock alerts. " +
      "Required: productId (UUID), lowStockThreshold (integer 0–9999). " +
      "Use updateVariantStockThreshold for variant products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateProductStockThresholdToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: productId (UUID), lowStockThreshold (integer 0–9999)`,
        };
      }

      try {
        const updated = await queries.updateProductThreshold(db, parsed.data.productId, {
          lowStockThreshold: parsed.data.lowStockThreshold,
        });
        if (!updated) {
          return {
            success: false,
            error: `Product not found with ID: ${parsed.data.productId}`,
          };
        }
        return {
          success: true,
          message: `Low stock threshold updated to ${parsed.data.lowStockThreshold} for product ${parsed.data.productId}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update threshold: ${error.message}`,
        };
      }
    },
  }),

  updateVariantStockThreshold: tool({
    description:
      "Sets the low stock alert threshold for a specific product variant. " +
      "When the variant's inventory drops to or below this value, it appears in stock alerts. " +
      "Required: productId (UUID), variantId (UUID), lowStockThreshold (integer 0–9999). " +
      "Use updateProductStockThreshold for simple (non-variant) products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateVariantStockThresholdToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: productId (UUID), variantId (UUID), lowStockThreshold (integer 0–9999)`,
        };
      }

      try {
        // Note: updateVariantThreshold signature is (db, variantId, productId, data)
        const updated = await queries.updateVariantThreshold(
          db,
          parsed.data.variantId,
          parsed.data.productId,
          { lowStockThreshold: parsed.data.lowStockThreshold },
        );
        if (!updated) {
          return {
            success: false,
            error: `Variant not found with ID: ${parsed.data.variantId} under product ${parsed.data.productId}`,
          };
        }
        return {
          success: true,
          message: `Low stock threshold updated to ${parsed.data.lowStockThreshold} for variant ${parsed.data.variantId}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update threshold: ${error.message}`,
        };
      }
    },
  }),
});
