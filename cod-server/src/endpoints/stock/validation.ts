import { z } from "zod";
import { STOCK_MOVEMENT_TYPES } from "../../../../cod-shared/queries/stock";

// ─── Movement Type ────────────────────────────────────────────────────────────

/** Re-exported so downstream consumers (ai-tools, MCP server) keep their import path. */
export const MOVEMENT_TYPES = STOCK_MOVEMENT_TYPES;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Types that require a reason note from the user. */
const REASON_REQUIRED_TYPES: StockMovementType[] = [
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "OFFLINE_SALE",
];

// ─── Adjust Stock ─────────────────────────────────────────────────────────────

export const adjustStockSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES),
    delta: z
      .number()
      .int("يجب أن تكون الكمية عدداً صحيحاً")
      .refine((v) => v !== 0, "يجب ألا تكون الكمية صفراً"),
    reason: z.string().min(1).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (REASON_REQUIRED_TYPES.includes(data.type) && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "السبب مطلوب لهذا النوع من التعديل",
        path: ["reason"],
      });
    }
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// ─── Update Threshold ─────────────────────────────────────────────────────────

export const updateThresholdSchema = z.object({
  lowStockThreshold: z
    .number()
    .int("يجب أن يكون الحد عدداً صحيحاً")
    .min(0, "يجب أن يكون الحد 0 أو أكثر")
    .max(9999),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;

// ─── List Filters ─────────────────────────────────────────────────────────────

export const stockHistoryFiltersSchema = z.object({
  variantId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type StockHistoryFilters = z.infer<typeof stockHistoryFiltersSchema>;

export const stockAlertsFiltersSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type StockAlertsFilters = z.infer<typeof stockAlertsFiltersSchema>;
