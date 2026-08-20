import { z } from "zod";

export const createDeliveryCompanySchema = z.object({
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().min(1, "Arabic name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^[a-z0-9_]+$/, "Code must be lowercase alphanumeric with underscores"),
  website: z.string().url("Invalid URL").optional().nullable(),
  active: z.boolean().default(true),

  // API config
  apiEndpoint: z.string().url("Invalid API endpoint URL").optional().nullable(),
  apiToken: z.string().optional().nullable(),
  apiUserGuid: z.string().optional().nullable(),

  // Capabilities
  supportsHomeDelivery: z.boolean().default(true),
  supportsStopDesk: z.boolean().default(true),
  supportsTracking: z.boolean().default(false),

  /**
   * When true, the server calls `validateShipment` immediately after `createShipment`
   * on dispatch — the order is locked at the carrier (no edits/deletes).
   * When false, the order stays editable and the team must manually confirm it.
   * If omitted, the create handler derives a safe default per provider
   * (false for EcoTrack-family carriers, true for everyone else).
   */
  autoValidate: z.boolean().optional(),

  notes: z.string().optional().nullable(),
});

export const updateDeliveryCompanySchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  nameAr: z.string().min(1, "Arabic name is required").optional(),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^[a-z0-9_]+$/, "Code must be lowercase alphanumeric with underscores")
    .optional(),
  website: z.string().url("Invalid URL").optional().nullable(),
  active: z.boolean().optional(),
  apiEndpoint: z.string().url("Invalid API endpoint URL").optional().nullable(),
  apiToken: z.string().optional().nullable(),
  apiUserGuid: z.string().optional().nullable(),
  supportsHomeDelivery: z.boolean().optional(),
  supportsStopDesk: z.boolean().optional(),
  supportsTracking: z.boolean().optional(),
  /** Toggle the post-dispatch auto-validate behavior. See create schema for semantics. */
  autoValidate: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export const deliveryCompanyFiltersSchema = z.object({
  active: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateDeliveryCompanyInput = z.infer<typeof createDeliveryCompanySchema>;
export type UpdateDeliveryCompanyInput = z.infer<typeof updateDeliveryCompanySchema>;
export type DeliveryCompanyFiltersInput = z.infer<typeof deliveryCompanyFiltersSchema>;
