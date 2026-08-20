import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  groupFiltersSchema,
  createGroupSchema,
  updateGroupSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * AI Tools for Product Group Management
 *
 * Product groups are the category/collection tree for the product catalog.
 * They support a parent-child hierarchy (parentId links a sub-group to its parent).
 * Each group tracks how many active products are assigned to it (productsCount).
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 *
 * Domain rules encoded here:
 * - slug must be lowercase letters, numbers, and hyphens only (auto-generated from name if omitted)
 * - imageUrl must be a valid URL when provided
 * - position is an integer >= 0 (controls display order, default 0)
 * - deleteProductGroup is blocked when productsCount > 0 (PRODUCT_GROUP_HAS_PRODUCTS)
 */
export const getProductGroupTools = (db: ReturnType<typeof getDb>) => ({

  listProductGroups: tool({
    description:
      "List all product groups (categories/collections) in the catalog. " +
      "Returns each group with its productsCount (number of active products assigned). " +
      "Supports filtering by name search or by parentId to get sub-groups of a specific parent. " +
      "Results are ordered by position.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = groupFiltersSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: search (string, optional), parentId (string UUID, optional — pass to get only sub-groups of that parent)`,
        };
      }

      try {
        const groups = await queries.getAllGroups(db, parsed.data);
        return {
          success: true,
          count: groups.length,
          groups: groups.map((g) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            description: g.description,
            parentId: g.parentId,
            imageUrl: g.imageUrl,
            metaTitle: g.metaTitle,
            metaDescription: g.metaDescription,
            metaKeywords: g.metaKeywords,
            position: g.position,
            productsCount: g.productsCount,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  getProductGroupDetails: tool({
    description:
      "Fetch full details for a specific product group, including its direct children (sub-groups) and productsCount. " +
      "Use this before updating a group or when you need to inspect its hierarchy.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        groupId: z.string().uuid().describe("The unique UUID of the product group to retrieve"),
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: groupId (UUID string)`,
        };
      }

      try {
        const group = await queries.getGroupById(db, parsed.data.groupId);
        if (!group) {
          return {
            success: false,
            error: `Product group not found with ID: ${parsed.data.groupId}`,
          };
        }
        return { success: true, group };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  createProductGroup: tool({
    description:
      "Creates a new product group (category/collection). " +
      "Required: name (string). " +
      "Optional: slug (auto-generated from name if omitted — must be lowercase letters, numbers, hyphens only e.g. 'smart-phones'), " +
      "description, parentId (UUID of parent group to nest this under), " +
      "imageUrl (valid URL), position (integer >= 0, controls display order, default 0), " +
      "metaTitle (SEO page title, max 60 chars), metaDescription (SEO description, max 160 chars), " +
      "metaKeywords (comma-separated keywords for search engines).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = createGroupSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid group data: ${errorDetails}. ` +
            `Required: name (non-empty string). ` +
            `Optional: slug (lowercase letters/numbers/hyphens only, e.g. "smart-phones" — auto-generated if omitted), ` +
            `description (string or null), parentId (UUID or null), ` +
            `imageUrl (valid URL or null), position (integer >= 0, default 0), ` +
            `metaTitle (string max 60 chars or null), metaDescription (string max 160 chars or null), ` +
            `metaKeywords (comma-separated string or null).`,
        };
      }

      try {
        const group = await queries.createGroup(db, parsed.data);
        return {
          success: true,
          group,
          message: `Product group "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create product group: ${error.message}`,
        };
      }
    },
  }),

  updateProductGroup: tool({
    description:
      "Partially updates an existing product group. Only include fields you want to change — all fields are optional. " +
      "slug must remain lowercase letters, numbers, and hyphens only. " +
      "Set parentId to null to move a group to the top level. " +
      "position controls display order (integer >= 0). " +
      "SEO fields: metaTitle (max 60 chars), metaDescription (max 160 chars), metaKeywords (comma-separated). Set any to null to clear.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        groupId: z.string().uuid().describe("The UUID of the product group to update"),
        updates: updateGroupSchema,
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid update arguments: ${errorDetails}. ` +
            `Expected: groupId (UUID), updates object with optional fields: ` +
            `name (string), slug (lowercase/numbers/hyphens), description (string or null), ` +
            `parentId (UUID or null), imageUrl (valid URL or null), position (integer >= 0), ` +
            `metaTitle (string max 60 chars or null), metaDescription (string max 160 chars or null), ` +
            `metaKeywords (comma-separated string or null).`,
        };
      }

      try {
        const group = await queries.updateGroup(db, parsed.data.groupId, parsed.data.updates);
        if (!group) {
          return {
            success: false,
            error: `Product group not found with ID: ${parsed.data.groupId}`,
          };
        }
        return {
          success: true,
          group,
          message: "Product group updated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update product group: ${error.message}`,
        };
      }
    },
  }),

  deleteProductGroup: tool({
    description:
      "Permanently deletes a product group. " +
      "WARNING: This will FAIL if the group has any active products assigned to it (PRODUCT_GROUP_HAS_PRODUCTS). " +
      "Before deleting, reassign or remove all products from the group, or use listProducts with categoryId to find them. " +
      "This action is permanent — there is no soft-delete for groups.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        groupId: z.string().uuid().describe("The UUID of the product group to delete"),
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: groupId (UUID string)`,
        };
      }

      try {
        // Verify group exists and check productsCount before attempting delete
        const group = await queries.getGroupById(db, parsed.data.groupId);
        if (!group) {
          return {
            success: false,
            error: `Product group not found with ID: ${parsed.data.groupId}`,
          };
        }

        if (group.productsCount > 0) {
          return {
            success: false,
            error:
              `Cannot delete product group "${group.name}" because it has ${group.productsCount} active product(s) assigned to it. ` +
              `Reassign those products to another group (or clear their categoryId) before deleting.`,
          };
        }

        await queries.deleteGroup(db, parsed.data.groupId);
        return {
          success: true,
          message: `Product group "${group.name}" (${parsed.data.groupId}) deleted successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to delete product group: ${error.message}`,
        };
      }
    },
  }),
});
