import { z } from "@hono/zod-openapi";

export const wilayaFiltersSchema = z.object({
  search: z
    .string()
    .optional()
    .openapi({ description: "Search by name (Arabic or Latin)" }),
});

export type WilayaFiltersInput = z.infer<typeof wilayaFiltersSchema>;
