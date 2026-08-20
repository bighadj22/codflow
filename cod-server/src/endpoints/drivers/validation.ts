/**
 * Drivers Validation Schemas
 */
import { z } from "zod";

export const createDriverSchema = z.object({
  firstName: z.string().min(1, "First name is required").describe("The driver's first name"),
  lastName: z.string().min(1, "Last name is required").describe("The driver's last name"),
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number (0[5-7]XXXXXXXX)").describe("Primary Algerian phone number (e.g., 0555123456)"),
  phone2: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").optional()
  ).describe("Secondary Algerian phone number (optional)"),
  vehicleType: z.enum(["motorcycle", "car", "van"]).optional().nullable().describe("The type of vehicle used by the driver"),
  status: z.enum(["available", "busy", "inactive"]).default("available").describe("Current availability status of the driver"),
  notes: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().optional().nullable()
  ).describe("Internal notes about the driver"),
});

export const updateDriverSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional().describe("Updated first name"),
  lastName: z.string().min(1, "Last name is required").optional().describe("Updated last name"),
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").optional().describe("Updated primary phone number"),
  phone2: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").nullable().optional()
  ).describe("Updated secondary phone number (can be null)"),
  vehicleType: z.enum(["motorcycle", "car", "van"]).optional().nullable().describe("Updated vehicle type"),
  notes: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().nullable().optional()
  ).describe("Updated internal notes (send null or omit to clear)"),
});

export const updateDriverStatusSchema = z.object({
  status: z.enum(["available", "busy", "inactive"]).describe("New availability status for the driver"),
});

export const driverFiltersSchema = z.object({
  wilayaId: z.coerce.number().int().min(1).max(58).optional().describe("Filter to drivers with a compensation row for this wilaya (1-58)"),
  status: z.enum(["available", "busy", "inactive"]).optional().describe("Filter by driver availability status"),
  vehicleType: z.enum(["motorcycle", "car", "van"]).optional().describe("Filter by type of vehicle"),
  search: z.string().optional().describe("Search term for first name, last name, or phone number"),
  limit: z.coerce.number().int().positive().max(100).default(50).describe("Maximum number of results to return (max 100)"),
  offset: z.coerce.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
});

/** PUT /drivers/:id/compensations/:wilayaId — upsert one wilaya compensation row. */
export const setCompensationSchema = z.object({
  feePerDelivery: z.number().min(0).describe("What the store pays this driver per delivery in this wilaya (DZD)."),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
export type DriverFiltersInput = z.infer<typeof driverFiltersSchema>;
export type SetCompensationInput = z.infer<typeof setCompensationSchema>;
