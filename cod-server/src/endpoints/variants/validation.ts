import { z } from "zod";

export const createVariantSchema = z.object({
  variations: z.record(z.string(), z.string()), // {"Color": "Red", "Size": "M"}
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  inventory: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5).optional(),
  weightKg: z.number().min(0).optional().nullable(),
  imageId: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  position: z.number().int().min(1).default(1),
});

export const updateVariantSchema = z.object({
  variations: z.record(z.string(), z.string()).optional(),
  price: z.number().int().min(0).optional(),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  sku: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  inventory: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  weightKg: z.number().min(0).optional().nullable(),
  imageId: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(1).optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
