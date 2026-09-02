import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  productFiltersSchema,
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listProductsSchema = productFiltersSchema;
export const getProductDetailsSchema = z.object({
  productId: z.string().uuid().describe("The unique UUID of the product to retrieve"),
});
export const createNewProductSchema = createProductSchema;
export const updateProductDetailsSchema = z.object({
  productId: z.string().uuid().describe("The UUID of the product to update"),
  updates: updateProductSchema,
});
export const updateProductStatusToolSchema = z.object({
  productId: z.string().uuid().describe("The UUID of the product"),
  status: updateStatusSchema.shape.status,
});
export const deleteProductSchema = z.object({
  productId: z.string().uuid().describe("The UUID of the product to delete"),
});

export const PRODUCT_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listProducts: listProductsSchema.shape,
  getProductDetails: getProductDetailsSchema.shape,
  createNewProduct: createNewProductSchema.shape,
  updateProductDetails: updateProductDetailsSchema.shape,
  updateProductStatus: updateProductStatusToolSchema.shape,
  deleteProduct: deleteProductSchema.shape,
};

/**
 * AI Tools for Product Management
 *
 * These tools allow the AI Agent to interact directly with the products database
 * logic by reusing existing queries and validation schemas.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 *
 * This ensures the AI agent can recover from validation errors without breaking the conversation.
 *
 * Product domain notes:
 * - Simple products (hasVariants=false) MUST include a `sku` field.
 * - Variant products (hasVariants=true) carry SKU on each variant — omit `sku` at product level.
 * - Prices are always integers in DZD (Algerian Dinar), smallest unit.
 * - Status values: DRAFT | ACTIVE | ARCHIVED. Setting ACTIVE auto-sets publishedAt.
 * - Delete is a soft-delete (sets deletedAt). Blocked if the product has existing orders.
 */
export const getProductTools = (db: ReturnType<typeof getDb>) => ({

  listProducts: tool({
    description:
      "Search and filter the product catalog. Returns product info including inventory levels, variant counts, primary image, review stats, and status. Use this to find products by name, category, status, or visibility.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation with graceful error handling
      const parsed = listProductsSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: categoryId (string, optional), status (DRAFT|ACTIVE|ARCHIVED, optional), visibility (boolean, optional), search (string, optional), limit (1-100, default 50), offset (number, default 0)`,
        };
      }

      try {
        const products = await queries.getAllProducts(db, parsed.data);
        return {
          success: true,
          count: products.length,
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            handle: p.handle,
            sku: p.sku,
            price: p.price,
            status: p.status,
            visibility: p.visibility,
            hasVariants: p.hasVariants,
            variantsCount: p.variantsCount,
            totalInventory: p.totalInventory,
            primaryImageSrc: p.primaryImageSrc,
            categoryId: p.categoryId,
            tags: p.tags,
            reviewCount: p.reviewCount,
            avgRating: p.avgRating,
            showInStore: p.showInStore,
            storeFeatured: p.storeFeatured,
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

  getProductDetails: tool({
    description:
      "Fetch full details for a specific product, including its category, all variants (with their SKUs, prices, and inventory), and images. Use this before updating or when you need complete product data.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = getProductDetailsSchema;

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
        const product = await queries.getProductById(db, parsed.data.productId);
        if (!product) {
          return {
            success: false,
            error: `Product not found with ID: ${parsed.data.productId}`,
          };
        }
        return { success: true, product };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  createNewProduct: tool({
    description:
      "Creates a new product in the catalog. " +
      "SIMPLE PRODUCTS (hasVariants=false, the default): must include `sku` (unique), `name`, and `price` (integer DZD). " +
      "VARIANT PRODUCTS (hasVariants=true): omit `sku` here — each variant carries its own SKU added via createProductVariant. " +
      "Optional: description, handle (auto-generated from name if omitted), compareAtPrice, costPrice, type (PHYSICAL|DIGITAL), " +
      "variantOptions (array of {name, values}), inventory (default 0), lowStockThreshold (default 5), trackInventory (default true), " +
      "categoryId, tags (string array), visibility (default true), status (DRAFT|ACTIVE|ARCHIVED, default ACTIVE), " +
      "showInStore (default true), storeFeatured (default false), shippingProfileId.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = createNewProductSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid product data: ${errorDetails}. ` +
            `Required: name (string), price (integer DZD ≥ 0). ` +
            `SKU rules: required for simple products (hasVariants=false), must be unique. ` +
            `Optional: description, handle, compareAtPrice, costPrice, type (PHYSICAL|DIGITAL), ` +
            `hasVariants (boolean), variantOptions (array), inventory (int ≥ 0), ` +
            `lowStockThreshold (int ≥ 0), trackInventory (boolean), categoryId, tags (string[]), ` +
            `visibility (boolean), status (DRAFT|ACTIVE|ARCHIVED), showInStore (boolean), ` +
            `storeFeatured (boolean), shippingProfileId.`,
        };
      }

      try {
        // Duplicate SKU check before insert
        if (parsed.data.sku) {
          const { products } = await import("@/db/schema");
          const { eq, isNull, and } = await import("drizzle-orm");
          const existing = await db
            .select()
            .from(products)
            .where(and(eq(products.sku, parsed.data.sku), isNull(products.deletedAt)))
            .get();
          if (existing) {
            return {
              success: false,
              error: `A product with SKU "${parsed.data.sku}" already exists (ID: ${existing.id}). Use a different SKU.`,
            };
          }
        }

        const product = await queries.createProduct(db, parsed.data);
        return {
          success: true,
          product,
          message: `Product "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create product: ${error.message}`,
        };
      }
    },
  }),

  updateProductDetails: tool({
    description:
      "Partially updates an existing product. Only include fields you want to change — all fields are optional. " +
      "Setting status to ACTIVE auto-sets publishedAt. " +
      "Send variantOptions: null to clear variant options when converting a variant product to simple. " +
      "Cannot change SKU to null — if provided, must be a non-empty string.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateProductDetailsSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid update arguments: ${errorDetails}. ` +
            `Expected: productId (UUID), updates object with optional fields: ` +
            `name, description, handle, price (int DZD), compareAtPrice, costPrice, ` +
            `type (PHYSICAL|DIGITAL), hasVariants, variantOptions (array or null), ` +
            `sku (non-empty string), inventory (int ≥ 0), lowStockThreshold, trackInventory, ` +
            `categoryId (string or null), tags (string[]), visibility, ` +
            `status (DRAFT|ACTIVE|ARCHIVED), showInStore, storeFeatured, shippingProfileId.`,
        };
      }

      try {
        const product = await queries.updateProduct(
          db,
          parsed.data.productId,
          parsed.data.updates,
        );
        if (!product) {
          return {
            success: false,
            error: `Product not found with ID: ${parsed.data.productId}`,
          };
        }
        return {
          success: true,
          product,
          message: "Product updated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update product: ${error.message}`,
        };
      }
    },
  }),

  updateProductStatus: tool({
    description:
      "Changes a product's publication status. Valid values: DRAFT (hidden, not published), ACTIVE (live — auto-sets publishedAt), ARCHIVED (discontinued). Use this for quick status changes without touching other fields.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateProductStatusToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: productId (UUID), status (one of: DRAFT, ACTIVE, ARCHIVED)`,
        };
      }

      try {
        const product = await queries.updateProduct(db, parsed.data.productId, {
          status: parsed.data.status,
        });
        if (!product) {
          return {
            success: false,
            error: `Product not found with ID: ${parsed.data.productId}`,
          };
        }
        return {
          success: true,
          product,
          message: `Product status updated to ${parsed.data.status}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update product status: ${error.message}`,
        };
      }
    },
  }),

  deleteProduct: tool({
    description:
      "Soft-deletes a product (sets deletedAt — the product is excluded from all future queries). " +
      "WARNING: This will FAIL if the product has any existing orders (PRODUCT_HAS_ORDERS). " +
      "Consider archiving the product (updateProductStatus → ARCHIVED) instead of deleting if it has order history. " +
      "This action is permanent and cannot be undone via the API.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = deleteProductSchema;

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
        // Verify product exists before attempting delete
        const existing = await queries.getProductById(db, parsed.data.productId);
        if (!existing) {
          return {
            success: false,
            error: `Product not found with ID: ${parsed.data.productId}`,
          };
        }

        // Check for existing orders
        const { orderProducts } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const ordersWithProduct = await db
          .select()
          .from(orderProducts)
          .where(eq(orderProducts.productId, parsed.data.productId))
          .get();

        if (ordersWithProduct) {
          return {
            success: false,
            error:
              `Cannot delete product "${existing.name}" because it has existing orders. ` +
              `Archive it instead by calling updateProductStatus with status: "ARCHIVED".`,
          };
        }

        await queries.deleteProduct(db, parsed.data.productId);
        return {
          success: true,
          message: `Product "${existing.name}" (${parsed.data.productId}) deleted successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to delete product: ${error.message}`,
        };
      }
    },
  }),
});
