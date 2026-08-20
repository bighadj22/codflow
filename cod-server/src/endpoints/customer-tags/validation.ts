import { z } from "zod";

export const createCustomerTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
});

export const updateCustomerTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
});

export const assignTagSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
});

export const customerTagFiltersSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateCustomerTagInput = z.infer<typeof createCustomerTagSchema>;
export type UpdateCustomerTagInput = z.infer<typeof updateCustomerTagSchema>;
export type AssignTagInput = z.infer<typeof assignTagSchema>;
export type CustomerTagFiltersInput = z.infer<typeof customerTagFiltersSchema>;
