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
import { toolOutput, timestampSchema } from "@/lib/tool-output-schema";
import { eq } from "drizzle-orm";
import { productImages } from "@/db/schema";
import type { Env } from "@/types/env";
import { sniffImageType } from "@/lib/image-dimensions";

const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;

const productImageFileSchema = z.strictObject({
  download_url: z
    .url({ protocol: /^https?$/, message: "download_url must be an http(s) URL" })
    .describe("Direct fetchable URL filled in by the chat client"),
  file_id: z.string().min(1).describe("Client-side file identifier"),
  mime_type: z.string().optional().describe("MIME type when known"),
  file_name: z.string().optional().describe("Original file name when known"),
});

/**
 * Chat clients deliver `image` in two shapes. The canonical one is the
 * openai/fileParams file object — what ChatGPT dispatches at runtime. Some
 * runtimes hand over the model-visible form instead: a bare string carrying
 * the direct download URL (the file parameter is masked to `string` for the
 * model). This normaliser rewrites that string into the file object BEFORE
 * validation, so the JSON Schema clients scan keeps the canonical file object
 * (all four properties, download_url + file_id required) while execution
 * accepts both shapes.
 */
function normalizeProductImageInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return { download_url: trimmed, file_id: trimmed };
}

async function readImageResponse(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PRODUCT_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("Image exceeds the 10 MB limit.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("The image response has no readable body.");

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PRODUCT_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("Image exceeds the 10 MB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function productImageExtension(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      throw new Error(`Unsupported image type: ${contentType}`);
  }
}

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
export const uploadProductImageSchema = z.strictObject({
  productId: z.string().uuid().describe("The UUID of the product to receive this image"),
  image: z.preprocess(normalizeProductImageInput, productImageFileSchema).describe(
    "The conversation image: the chat client's file object ({download_url, file_id, mime_type?, file_name?}) " +
      "or a directly-fetchable http(s) download URL string. The client fills download_url; do not inline image data.",
  ),
  altText: z.string().max(1000).optional().describe("Alt text for accessibility"),
  position: z.number().int().min(1).optional().describe("Stack position; omit to append"),
});

export const PRODUCT_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listProducts: listProductsSchema.shape,
  getProductDetails: getProductDetailsSchema.shape,
  createNewProduct: createNewProductSchema.shape,
  updateProductDetails: updateProductDetailsSchema.shape,
  updateProductStatus: updateProductStatusToolSchema.shape,
  deleteProduct: deleteProductSchema.shape,
  uploadProductImage: uploadProductImageSchema.shape,
};

export const PRODUCT_TOOL_META: Record<string, Record<string, unknown>> = {
  uploadProductImage: {
    "openai/fileParams": ["image"],
  },
};

const productRowSchema = z.looseObject({
  id: z.string().describe("Product UUID"),
  name: z.string(),
  handle: z.string().describe("Unique URL slug"),
  price: z.number().describe("Price in DZD (integer, smallest unit)"),
  sku: z.string().nullable().optional().describe("Merchant-facing code — set on simple products only"),
  status: z.string().optional().describe("DRAFT | ACTIVE | ARCHIVED"),
  visibility: z.boolean().optional().describe("Master internal switch — off means hidden everywhere"),
  hasVariants: z.boolean().optional().describe("True → stock and pricing live on variants"),
  descriptionFormat: z.enum(["text", "html"]).describe(
    "How description is stored: 'text' renders as literal text (legacy), 'html' is sanitised rich text"
  ),
  descriptionPlain: z.string().nullable().describe(
    "Tag-free rendering of description for SEO/meta; identical to description for text rows"
  ),
});

export const PRODUCT_TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  listProducts: toolOutput({
    count: z.number().int(),
    products: z.array(
      z.looseObject({
        id: z.string().describe("Product UUID"),
        name: z.string(),
        handle: z.string().describe("Unique URL slug"),
        sku: z.string().nullable().describe("Null on variant products (SKU lives on each variant)"),
        price: z.number().describe("Price in DZD"),
        status: z.string().describe("DRAFT | ACTIVE | ARCHIVED"),
        visibility: z.boolean(),
        hasVariants: z.boolean(),
        variantsCount: z.number().int(),
        totalInventory: z.number().int().describe("Variant stock sum, or own stock for simple products"),
        primaryImageSrc: z.string().nullable(),
        categoryId: z.string().nullable(),
        tags: z.array(z.string()),
        reviewCount: z.number().int().describe("Approved reviews only"),
        avgRating: z.number().nullable().describe("Average of approved reviews, or null"),
        showInStore: z.boolean().describe("Storefront-only visibility switch"),
        storeFeatured: z.boolean(),
      }),
    ).describe("Products matching the filters"),
  }),
  getProductDetails: toolOutput({
    product: productRowSchema.describe("Full product: variants, images, category, and review aggregates"),
  }),
  createNewProduct: toolOutput({
    product: productRowSchema.describe("The created product"),
    message: z.string(),
  }),
  updateProductDetails: toolOutput({
    product: productRowSchema.describe("The updated product"),
    message: z.string(),
  }),
  updateProductStatus: toolOutput({
    product: productRowSchema.describe("The product with its new status"),
    message: z.string(),
  }),
  deleteProduct: toolOutput({
    message: z.string(),
  }),
  uploadProductImage: toolOutput({
    image: z.looseObject({
      id: z.string(),
      productId: z.string(),
      src: z.string(),
      r2Key: z.string(),
      altText: z.string().nullable(),
      position: z.number().int(),
    }),
    message: z.string(),
  }),
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
export const getProductTools = (
  db: ReturnType<typeof getDb>,
  env?: Pick<Env, "IMAGES" | "MEDIA_DOMAIN">,
) => ({

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
      "To attach an image from this conversation, create the product first, then call uploadProductImage with its returned ID. " +
      "SIMPLE PRODUCTS (hasVariants=false, the default): must include `sku` (unique), `name`, and `price` (integer DZD). " +
      "VARIANT PRODUCTS (hasVariants=true): omit `sku` here — each variant carries its own SKU added via createProductVariant. " +
      "Optional: description, descriptionFormat ('text'|'html'; 'text' renders literally, 'html' is sanitised server-side against the rich-text allow-list), handle (auto-generated from name if omitted), compareAtPrice, costPrice, type (PHYSICAL|DIGITAL), " +
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
        // Identity conflict check before insert — spans soft-deleted rows too,
        // because the database's unique indexes (handle, sku) do.
        const conflict = await queries.findProductIdentityConflict(db, {
          ...(parsed.data.handle !== undefined ? { handle: parsed.data.handle } : {}),
          ...(parsed.data.sku !== undefined ? { sku: parsed.data.sku } : {}),
        });
        if (conflict) {
          const suffix = conflict.deleted ? " (held by a deleted product)" : "";
          return conflict.field === "sku"
            ? {
                success: false,
                error: `A product with SKU "${parsed.data.sku}" already exists${suffix} (ID: ${conflict.existingId}). Use a different SKU.`,
              }
            : {
                success: false,
                error: `A product with handle "${parsed.data.handle}" already exists${suffix} (ID: ${conflict.existingId}). Use a different handle, or omit it to auto-generate one.`,
              };
        }

        const product = await queries.createProduct(db, parsed.data);
        return {
          success: true,
          product,
          message: `Product "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        const msg = String(error?.message ?? error);
        if (/UNIQUE constraint failed: products\.handle/i.test(msg)) {
          return {
            success: false,
            error: `A product with handle "${parsed.data.handle}" already exists. Use a different handle, or omit it to auto-generate one.`,
          };
        }
        if (/UNIQUE constraint failed: products\.sku/i.test(msg)) {
          return {
            success: false,
            error: `A product with SKU "${parsed.data.sku}" already exists. Use a different SKU.`,
          };
        }
        return {
          success: false,
          error: `Failed to create product: ${msg}`,
        };
      }
    },
  }),

  uploadProductImage: tool({
    description:
      "Upload an image from this conversation and attach it to an existing product. " +
      "Pass `image` as the chat client's file object ({download_url, file_id, mime_type?, file_name?}) — the client fills download_url — " +
      "or as a directly-fetchable http(s) download URL string. Do not inline image data. " +
      "After createNewProduct succeeds, call this tool with the returned product ID to add its image. " +
      "Images must be PNG, JPEG, WebP, or GIF and at most 10 MB.",
    inputSchema: z.object({}).passthrough(),
    execute: async (args) => {
      const parsed = uploadProductImageSchema.safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid image upload arguments: ${issues}. ` +
            "Expected: productId (UUID), image (client file object with download_url and file_id, or a direct http(s) download URL string), optional altText and position.",
        };
      }

      if (!env?.IMAGES || !env.MEDIA_DOMAIN) {
        return {
          success: false,
          error: "Product image upload is unavailable because R2 storage or MEDIA_DOMAIN is not configured.",
        };
      }

      const { productId, image, altText, position } = parsed.data;
      try {
        const product = await queries.getProductById(db, productId);
        if (!product) return { success: false, error: `Product ${productId} not found.` };
      } catch (error) {
        return {
          success: false,
          error: `Failed to verify product ${productId}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      let bytes: Uint8Array;
      try {
        const response = await fetch(image.download_url, { redirect: "follow" });
        if (!response.ok) {
          return {
            success: false,
            error: `Could not download the image (HTTP ${response.status}). Re-attach the image and try again.`,
          };
        }
        bytes = await readImageResponse(response);
      } catch (error) {
        return {
          success: false,
          error: `Failed to download the image: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      const contentType = sniffImageType(bytes);
      if (!contentType) {
        return {
          success: false,
          error: "The downloaded file is not a supported PNG, JPEG, WebP, or GIF image.",
        };
      }

      const r2Key = `products/${crypto.randomUUID().replace(/-/g, "")}.${productImageExtension(contentType)}`;
      try {
        await env.IMAGES.put(r2Key, bytes, {
          httpMetadata: {
            contentType,
            cacheControl: "public, max-age=31536000, immutable",
          },
          customMetadata: {
            source: "ai",
            uploadedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        return {
          success: false,
          error: `Failed to store product image: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      const src = `https://${env.MEDIA_DOMAIN}/${r2Key}`;
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      let resolvedPosition = position;
      try {
        if (resolvedPosition === undefined) {
          const existing = await db
            .select({ position: productImages.position })
            .from(productImages)
            .where(eq(productImages.productId, productId))
            .all();
          resolvedPosition = existing.reduce(
            (max, row) => Math.max(max, row.position),
            0,
          ) + 1;
        }
        await db.insert(productImages).values({
          id,
          productId,
          src,
          r2Key,
          srcSm: null,
          srcMd: null,
          srcLg: null,
          altText: altText ?? null,
          width: null,
          height: null,
          type: 1,
          position: resolvedPosition,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        try {
          await env.IMAGES.delete(r2Key);
        } catch (cleanupError) {
          return {
            success: false,
            error:
              `Failed to attach product image: ${error instanceof Error ? error.message : String(error)}. ` +
              `R2 cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}.`,
          };
        }
        return {
          success: false,
          error: `Failed to attach product image: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      return {
        success: true,
        image: { id, productId, src, r2Key, altText: altText ?? null, position: resolvedPosition },
        message: "Product image uploaded and attached successfully.",
      };
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
