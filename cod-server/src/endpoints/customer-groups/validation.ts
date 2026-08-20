import { z } from "zod";

export const createCustomerGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
});

export const updateCustomerGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
});

export const addMemberSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
});

export const customerGroupFiltersSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateCustomerGroupInput = z.infer<typeof createCustomerGroupSchema>;
export type UpdateCustomerGroupInput = z.infer<typeof updateCustomerGroupSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type CustomerGroupFiltersInput = z.infer<typeof customerGroupFiltersSchema>;
