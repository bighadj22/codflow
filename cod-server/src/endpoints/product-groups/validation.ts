import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createGroupSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(slugRegex, "Slug must be lowercase letters, numbers and hyphens").optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  metaTitle: z.string().max(60).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
  metaKeywords: z.string().optional().nullable(),
  position: z.number().int().min(0).default(0),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(slugRegex, "Slug must be lowercase letters, numbers and hyphens").optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  metaTitle: z.string().max(60).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
  metaKeywords: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const groupFiltersSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type GroupFiltersInput = z.infer<typeof groupFiltersSchema>;
