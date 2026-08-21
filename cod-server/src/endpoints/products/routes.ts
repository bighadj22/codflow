/**
 * Products Routes
 *
 * Product CRUD + nested image management + variant management under
 * /api/products. Image and variant handlers live in their own domain
 * directories and are mounted here because they share the path prefix.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import * as vh from "../variants/handlers";
import * as ih from "../images/handlers";
import {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
  productFiltersSchema,
} from "./validation";
import { createVariantSchema, updateVariantSchema } from "../variants/validation";
import {
  ProductSchema,
  ProductImageSchema,
  ProductVariantSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Product ID", example: "prod_abc123" }),
});

const productIdParams = z.object({
  productId: z.string().openapi({ description: "Product ID", example: "prod_abc123" }),
});

const variantIdParams = productIdParams.extend({
  variantId: z.string().openapi({ description: "Variant ID", example: "var_abc123" }),
});

const imageIdParams = idParams.extend({
  imageId: z.string().openapi({ description: "Image ID", example: "img_abc123" }),
});

// ─── Products ─────────────────────────────────────────────────────────────────

const listProductsRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Products"],
  summary: "List products",
  description:
    "Returns a paginated list of products. Soft-deleted products are never returned. Each item includes `variantsCount`, `totalInventory`, `primaryImageSrc`, and `variants` array.",
  operationId: "listProducts",
  request: {
    query: productFiltersSchema,
  },
  responses: {
    200: {
      description: "List of products",
      content: jsonContent(ListResponseSchema(ProductSchema)),
    },
    400: errorResponse("Invalid filter value e.g. unknown status (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createProductRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Create product",
  description:
    "Creates a product. SKU rules: simple products (`hasVariants=false`, the default) must include `sku`. Variant products (`hasVariants=true`) must omit `sku` here — set it on each variant instead. Returns the full product record including empty `variants` and `images` arrays.",
  operationId: "createProduct",
  request: {
    body: {
      required: true,
      content: jsonContent(createProductSchema),
    },
  },
  responses: {
    201: {
      description: "Product created",
      content: jsonContent(SuccessResponseSchema(ProductSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    409: errorResponse("Duplicate SKU (DUPLICATE_SKU)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getProductRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Products"],
  summary: "Get product",
  description:
    "Returns full product detail including `category`, `variants`, and `images`.",
  operationId: "getProduct",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Product detail",
      content: jsonContent(SuccessResponseSchema(ProductSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:read scope"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateProductRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Update product",
  description:
    "Partial update — only include fields you want to change. Setting `status` to `ACTIVE` auto-sets `publishedAt`. Send `variantOptions: null` to clear all variant options when converting a variant product to simple.",
  operationId: "updateProduct",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(updateProductSchema),
    },
  },
  responses: {
    200: {
      description: "Product updated. Returns full updated product record.",
      content: jsonContent(SuccessResponseSchema(ProductSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateProductStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Update product status",
  description:
    "Dedicated endpoint for status-only updates. Setting `ACTIVE` auto-sets `publishedAt`.",
  operationId: "updateProductStatus",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(updateStatusSchema),
    },
  },
  responses: {
    200: {
      description: "Status updated. Returns full updated product record.",
      content: jsonContent(SuccessResponseSchema(ProductSchema)),
    },
    400: errorResponse("Validation error (invalid status value)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteProductRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Delete product",
  description:
    "Soft-deletes the product by setting `deletedAt`. The product is excluded from all list and detail responses. Returns 422 if the product has existing orders (PRODUCT_HAS_ORDERS).",
  operationId: "deleteProduct",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Product deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Product deleted" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
    422: errorResponse("Cannot delete product with existing orders (PRODUCT_HAS_ORDERS)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Product images ───────────────────────────────────────────────────────────

const listProductImagesRoute = createRoute({
  method: "get",
  path: "/{id}/images",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Products"],
  summary: "List product images",
  description: "Returns all images for a product ordered by position.",
  operationId: "listProductImages",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "List of product images ordered by position",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(ProductImageSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const saveProductImageRoute = createRoute({
  method: "post",
  path: "/{id}/images",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Save product image",
  description:
    "Associates an already-uploaded R2 image with a product. Upload the file first via POST /api/images/upload, then call this endpoint with the returned `key` and `url`.",
  operationId: "saveProductImage",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          key: z.string().min(1).openapi({
            description: "R2 object key returned by the upload endpoint",
            example: "products/abc123def456.jpg",
          }),
          src: z.string().min(1).openapi({
            format: "uri",
            description: "Public URL of the image",
            example: "https://cdn.example.com/products/abc123.jpg",
          }),
          altText: z.string().nullable().optional().openapi({
            description: "Alt text for accessibility",
          }),
          position: z.number().int().min(1).optional().openapi({
            description: "Display order (auto-appended at end if not provided)",
          }),
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Image record created",
      content: jsonContent(SuccessResponseSchema(ProductImageSchema)),
    },
    400: errorResponse("Missing key or src"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const reorderProductImagesRoute = createRoute({
  method: "patch",
  path: "/{id}/images/reorder",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Reorder product images",
  description:
    "Sets the display order of a product's images. Send the complete ordered array of image IDs — every existing image ID must be included exactly once. The server assigns position 1, 2, 3… based on the array order. Returns the full reordered image list.",
  operationId: "reorderProductImages",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          imageIds: z.array(z.string()).min(1).openapi({
            description:
              "Complete ordered list of all image IDs for this product. All existing image IDs must be included — no duplicates, no omissions.",
            example: ["uuid-b", "uuid-a", "uuid-c"],
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Images reordered successfully. Returns updated image list in new order.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(ProductImageSchema),
        })
      ),
    },
    400: errorResponse(
      "Validation error — empty array, duplicate IDs, image IDs that don't belong to this product, or incomplete set"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteProductImageRoute = createRoute({
  method: "delete",
  path: "/{id}/images/{imageId}",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Delete product image",
  description:
    "Deletes the image record from the database and removes the object from R2.",
  operationId: "deleteProductImage",
  request: {
    params: imageIdParams,
  },
  responses: {
    200: {
      description: "Image deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Image not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Variants (nested under product) ──────────────────────────────────────────

const listVariantsRoute = createRoute({
  method: "get",
  path: "/{productId}/variants",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Products"],
  summary: "List product variants",
  description: "Returns variants ordered by position, with parsed `variations` objects.",
  operationId: "listVariants",
  request: {
    params: productIdParams,
  },
  responses: {
    200: {
      description: "List of variants ordered by position",
      content: jsonContent(ListResponseSchema(ProductVariantSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createVariantRoute = createRoute({
  method: "post",
  path: "/{productId}/variants",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Create product variant",
  operationId: "createVariant",
  request: {
    params: productIdParams,
    body: {
      required: true,
      content: jsonContent(createVariantSchema),
    },
  },
  responses: {
    201: {
      description: "Variant created",
      content: jsonContent(SuccessResponseSchema(ProductVariantSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getVariantRoute = createRoute({
  method: "get",
  path: "/{productId}/variants/{variantId}",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Products"],
  summary: "Get product variant",
  operationId: "getVariant",
  request: {
    params: variantIdParams,
  },
  responses: {
    200: {
      description: "Variant detail",
      content: jsonContent(SuccessResponseSchema(ProductVariantSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:read scope"),
    404: errorResponse("Variant not found (VARIANT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateVariantRoute = createRoute({
  method: "patch",
  path: "/{productId}/variants/{variantId}",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Update product variant",
  description: "Partial update — only include fields you want to change.",
  operationId: "updateVariant",
  request: {
    params: variantIdParams,
    body: {
      required: true,
      content: jsonContent(updateVariantSchema),
    },
  },
  responses: {
    200: {
      description: "Variant updated",
      content: jsonContent(SuccessResponseSchema(ProductVariantSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Variant not found (VARIANT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteVariantRoute = createRoute({
  method: "delete",
  path: "/{productId}/variants/{variantId}",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Products"],
  summary: "Delete product variant",
  description:
    "Permanently deletes the variant. Any order line items referencing this variant will have their `variantId` set to null — order history is fully preserved.",
  operationId: "deleteVariant",
  request: {
    params: variantIdParams,
  },
  responses: {
    200: {
      description: "Variant deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing products:manage scope"),
    404: errorResponse("Variant not found (VARIANT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listProductsRoute, h.listProducts);
router.openapi(createProductRoute, h.createProduct);
router.openapi(getProductRoute, h.getProduct);
router.openapi(updateProductRoute, h.updateProduct);
router.openapi(updateProductStatusRoute, h.updateProductStatus);
router.openapi(deleteProductRoute, h.deleteProduct);

router.openapi(listProductImagesRoute, ih.listProductImages);
router.openapi(saveProductImageRoute, ih.saveProductImage);
router.openapi(reorderProductImagesRoute, ih.reorderProductImages);
router.openapi(deleteProductImageRoute, ih.deleteProductImage);

router.openapi(listVariantsRoute, vh.listVariants);
router.openapi(createVariantRoute, vh.createVariant);
router.openapi(getVariantRoute, vh.getVariant);
router.openapi(updateVariantRoute, vh.updateVariant);
router.openapi(deleteVariantRoute, vh.deleteVariant);

export default router;
