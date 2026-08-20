import { z } from "zod";

export const wilayaFiltersSchema = z.object({
  search: z.string().optional(),
});

export type WilayaFiltersInput = z.infer<typeof wilayaFiltersSchema>;
