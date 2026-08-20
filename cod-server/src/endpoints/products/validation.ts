import { z } from "zod";

const variantOptionSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.object({
    value: z.string().min(1),
    hexColor: z.string().optional().nullable(),
  })).min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  handle: z.string().optional(), // auto-generated if not provided
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).optional(),
  costPrice: z.number().int().min(0).optional(),
  type: z.enum(["PHYSICAL", "DIGITAL"]).default("PHYSICAL"),
  hasVariants: z.boolean().default(false),
  variantOptions: z.array(variantOptionSchema).optional().nullable(),
  // Required for simple products (hasVariants=false). Variant products carry SKU on each variant.
  sku: z.string().min(1).optional(),
  inventory: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5).optional(),
  trackInventory: z.boolean().default(true),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  visibility: z.boolean().default(true),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  showInStore: z.boolean().default(true),
  storeFeatured: z.boolean().default(false),
  shippingProfileId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.hasVariants && !data.sku) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SKU is required for simple products (hasVariants=false)",
      path: ["sku"],
    });
  }
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  handle: z.string().optional(),
  price: z.number().int().min(0).optional(),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  costPrice: z.number().int().min(0).optional().nullable(),
  type: z.enum(["PHYSICAL", "DIGITAL"]).optional(),
  hasVariants: z.boolean().optional(),
  variantOptions: z.array(variantOptionSchema).optional().nullable(),
  sku: z.string().min(1).optional(),
  inventory: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  trackInventory: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  visibility: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  showInStore: z.boolean().optional(),
  storeFeatured: z.boolean().optional(),
  shippingProfileId: z.string().optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

export const productFiltersSchema = z.object({
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  visibility: z.string().transform((v) => v === "true").optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
