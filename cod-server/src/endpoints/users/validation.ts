/**
 * Users Validation Schemas
 * 
 * Zod schemas for user management request validation.
 */

import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "staff"]).default("staff"),
  scopes: z.array(z.string()).default([]),
  /** Invite-email language. Falls back to the users.language column default ("en"). */
  language: z.enum(["ar", "en"]).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  role: z.enum(["admin", "staff"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "staff"]),
});

export const grantScopeSchema = z.object({
  scope: z.string().min(1, "Scope is required"),
});

export const userFiltersSchema = z.object({
  role: z.enum(["admin", "staff"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type GrantScopeInput = z.infer<typeof grantScopeSchema>;
export type UserFiltersInput = z.infer<typeof userFiltersSchema>;