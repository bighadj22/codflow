import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { createVariantSchema, updateVariantSchema } from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listProductVariantsSchema = z.object({
  productId: z.string().uuid().describe("UUID of the parent product"),
});
export const getVariantDetailsSchema = z.object({
  variantId: z.string().uuid().describe("UUID of the variant to retrieve"),
});
export const createProductVariantToolSchema = z.object({
  productId: z.string().uuid().describe("UUID of the parent product"),
  variant: createVariantSchema,
});
export const updateVariantToolSchema = z.object({
  variantId: z.string().uuid().describe("UUID of the variant to update"),
  updates: updateVariantSchema,
});
export const deleteProductVariantSchema = z.object({
  variantId: z.string().uuid().describe("UUID of the variant to delete"),
});

export const VARIANT_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listProductVariants: listProductVariantsSchema.shape,
  getVariantDetails: getVariantDetailsSchema.shape,
  createProductVariant: createProductVariantToolSchema.shape,
  updateVariant: updateVariantToolSchema.shape,
  deleteProductVariant: deleteProductVariantSchema.shape,
};

/**
 * AI Tools for Product Variant Management
 *
 * Variants represent distinct configurations of a product (e.g. Color: Red / Size: M).
 * Each variant has its own price, SKU, inventory, and optional image.
 *
 * Key domain rules:
 * - Variants are always children of a product. listProductVariants and createProductVariant
 *   require productId. getVariantDetails, updateVariant, deleteVariant only need variantId.
 * - variations is a Record<string, string> — keys are option axes (e.g. "Color", "Size"),
 *   values are the chosen option values (e.g. "Red", "M"). Must match the parent product's
 *   variantOptions axes.
 * - sku is required on create and must be a non-empty string (min 1 char).
 * - price is an integer in DZD (Algerian Dinar), minimum 0.
 * - position is 1-based integer controlling display order.
 * - isDefault marks the variant shown first in the storefront (only one should be true per product).
 * - active=false hides the variant from the storefront without deleting it.
 * - deleteProductVariant nulls out orderProducts.variantId first (order history preserved),
 *   then hard-deletes the variant. It is safe to call even if the variant has order history.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getVariantTools = (db: ReturnType<typeof getDb>) => ({

  listProductVariants: tool({
    description:
      "List all variants for a specific product, ordered by position. " +
      "Returns each variant's price, SKU, inventory, variations map, active status, and image reference. " +
      "Use this to inspect a product's full variant set before creating, updating, or deleting a variant.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = listProductVariantsSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: productId (UUID string)`,
        };
      }

      try {
        const variants = await queries.getVariantsByProduct(db, parsed.data.productId);
        return {
          success: true,
          count: variants.length,
          variants: variants.map((v) => ({
            id: v.id,
            productId: v.productId,
            variations: v.variations,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            sku: v.sku,
            barcode: v.barcode,
            inventory: v.inventory,
            lowStockThreshold: v.lowStockThreshold,
            weightKg: v.weightKg,
            imageId: v.imageId,
            isDefault: v.isDefault,
            active: v.active,
            position: v.position,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  getVariantDetails: tool({
    description:
      "Fetch full details for a specific variant by its UUID. " +
      "Use this before updating a variant or when you need its current price, inventory, or SKU.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = getVariantDetailsSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: variantId (UUID string)`,
        };
      }

      try {
        const variant = await queries.getVariantById(db, parsed.data.variantId);
        if (!variant) {
          return {
            success: false,
            error: `Variant not found with ID: ${parsed.data.variantId}`,
          };
        }
        return { success: true, variant };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  createProductVariant: tool({
    description:
      "Creates a new variant for an existing product. " +
      "Required: productId (UUID of the parent product), " +
      "variations (object mapping option axes to values, e.g. {\"Color\": \"Red\", \"Size\": \"M\"}), " +
      "price (integer DZD >= 0), sku (non-empty string, unique per product). " +
      "Optional: compareAtPrice (integer DZD, for showing a crossed-out original price), " +
      "barcode, inventory (default 0), lowStockThreshold (default 5), " +
      "weightKg (number >= 0), imageId (UUID of a product image to associate), " +
      "isDefault (boolean, default false — marks the variant shown first in storefront), " +
      "active (boolean, default true — set false to hide without deleting), " +
      "position (integer >= 1, default 1 — controls display order).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation — productId is separate from the variant body
      const validationSchema = createProductVariantToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid variant data: ${errorDetails}. ` +
            `Required: productId (UUID), variant.variations (object e.g. {"Color":"Red","Size":"M"}), ` +
            `variant.price (integer DZD >= 0), variant.sku (non-empty string). ` +
            `Optional: variant.compareAtPrice (int), variant.barcode (string), ` +
            `variant.inventory (int >= 0, default 0), variant.lowStockThreshold (int >= 0, default 5), ` +
            `variant.weightKg (number >= 0), variant.imageId (UUID), ` +
            `variant.isDefault (boolean, default false), variant.active (boolean, default true), ` +
            `variant.position (int >= 1, default 1).`,
        };
      }

      try {
        const variant = await queries.createVariant(
          db,
          parsed.data.productId,
          parsed.data.variant,
        );
        return {
          success: true,
          variant,
          message: `Variant created successfully for product ${parsed.data.productId}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create variant: ${error.message}`,
        };
      }
    },
  }),

  updateVariant: tool({
    description:
      "Partially updates an existing variant. All fields are optional — only include what you want to change. " +
      "variations replaces the entire map when provided (partial variation updates are not supported). " +
      "Set active=false to hide a variant from the storefront without deleting it. " +
      "Set isDefault=true to make this the default variant (you may want to set isDefault=false on the previous default first). " +
      "inventory changes here are direct overwrites — use stock adjustment tools for tracked movements.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateVariantToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid update arguments: ${errorDetails}. ` +
            `Expected: variantId (UUID), updates object with optional fields: ` +
            `variations (full Record<string,string> replacement), price (int DZD >= 0), ` +
            `compareAtPrice (int or null), sku (non-empty string), barcode (string or null), ` +
            `inventory (int >= 0), lowStockThreshold (int >= 0), weightKg (number or null), ` +
            `imageId (UUID or null), isDefault (boolean), active (boolean), position (int >= 1).`,
        };
      }

      try {
        const variant = await queries.updateVariant(
          db,
          parsed.data.variantId,
          parsed.data.updates,
        );
        if (!variant) {
          return {
            success: false,
            error: `Variant not found with ID: ${parsed.data.variantId}`,
          };
        }
        return {
          success: true,
          variant,
          message: "Variant updated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update variant: ${error.message}`,
        };
      }
    },
  }),

  deleteProductVariant: tool({
    description:
      "Permanently deletes a variant. " +
      "Order history is fully preserved — any order line items referencing this variant have their variantId set to null automatically. " +
      "Consider setting active=false instead if you may want to re-enable the variant later. " +
      "This action is irreversible.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = deleteProductVariantSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: variantId (UUID string)`,
        };
      }

      try {
        const existing = await queries.getVariantById(db, parsed.data.variantId);
        if (!existing) {
          return {
            success: false,
            error: `Variant not found with ID: ${parsed.data.variantId}`,
          };
        }

        await queries.deleteVariant(db, parsed.data.variantId);
        return {
          success: true,
          message: `Variant ${parsed.data.variantId} (${JSON.stringify(existing.variations)}) deleted successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to delete variant: ${error.message}`,
        };
      }
    },
  }),
});
