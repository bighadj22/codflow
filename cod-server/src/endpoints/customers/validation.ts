/**
 * Customers Validation Schemas
 * 
 * Zod schemas for customer management request validation.
 */

import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").describe("The full name of the customer"),
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").describe("Primary Algerian phone number (e.g., 0555123456)"),
  phone2: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").optional()
  ).describe("Secondary Algerian phone number (optional)"),
  wilayaId: z.number().int().min(1).max(58).describe("The numeric ID of the Algerian wilaya (1-58)"),
  communeId: z.string().min(1, "Commune is required").describe("The UUID or ID of the commune"),
  address: z.string().optional().describe("Full residential or business address (optional)"),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").optional().describe("Updated full name of the customer"),
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").optional().describe("Updated primary Algerian phone number"),
  phone2: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").nullable().optional()
  ).describe("Updated secondary Algerian phone number (can be null)"),
  wilayaId: z.number().int().min(1).max(58).optional().describe("Updated numeric ID of the wilaya (1-58)"),
  communeId: z.string().min(1, "Commune is required").nullable().optional().describe("Updated ID of the commune (can be null to clear)"),
  address: z.string().optional().nullable().describe("Updated full address"),
});

export const customerFiltersSchema = z.object({
  wilayaId: z.coerce.number().int().min(1).max(58).optional().describe("Filter by Algerian wilaya ID (1-58)"),
  search: z.string().optional().describe("Search term for name or phone number"),
  groupId: z.string().optional().describe("Filter by customer group UUID"),
  tagId: z.string().optional().describe("Filter by customer tag UUID"),
  limit: z.coerce.number().int().positive().max(100).default(50).describe("Maximum number of results to return (max 100)"),
  offset: z.coerce.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFiltersInput = z.infer<typeof customerFiltersSchema>;