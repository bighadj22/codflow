import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  createCustomerTagSchema,
  updateCustomerTagSchema,
  customerTagFiltersSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listCustomerTagsSchema = customerTagFiltersSchema;
export const getCustomerTagDetailsSchema = z.object({
  tagId: z.string().uuid().describe("UUID of the customer tag"),
  withCustomers: z.boolean().optional().default(false).describe("Include full list of assigned customers"),
});
export const createCustomerTagToolSchema = createCustomerTagSchema;
export const updateCustomerTagToolSchema = z.object({
  tagId: z.string().uuid().describe("UUID of the tag to update"),
  updates: updateCustomerTagSchema,
});
export const deleteCustomerTagSchema = z.object({
  tagId: z.string().uuid().describe("UUID of the customer tag to delete"),
});
export const assignTagToCustomerSchema = z.object({
  tagId: z.string().uuid().describe("UUID of the customer tag"),
  customerId: z.string().uuid().describe("UUID of the customer to tag"),
});
export const unassignTagFromCustomerSchema = z.object({
  tagId: z.string().uuid().describe("UUID of the customer tag"),
  customerId: z.string().uuid().describe("UUID of the customer to untag"),
});

export const CUSTOMER_TAG_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listCustomerTags: listCustomerTagsSchema.shape,
  getCustomerTagDetails: getCustomerTagDetailsSchema.shape,
  createCustomerTag: createCustomerTagToolSchema.shape,
  updateCustomerTag: updateCustomerTagToolSchema.shape,
  deleteCustomerTag: deleteCustomerTagSchema.shape,
  assignTagToCustomer: assignTagToCustomerSchema.shape,
  unassignTagFromCustomer: unassignTagFromCustomerSchema.shape,
};

/**
 * AI Tools for Customer Tag Management
 *
 * Customer tags are lightweight labels applied to individual customers
 * for filtering, segmentation, and quick identification (e.g. "loyal",
 * "wholesale", "at-risk"). Unlike groups, tags have no description field.
 *
 * Key domain facts:
 *   - Each tag has a name (1-50 chars) and a color (hex #RRGGBB, default #64748b).
 *   - assignmentCount is a denormalized counter kept in sync automatically.
 *   - assignTagToCustomer is idempotent — assigning an already-tagged customer
 *     is silently ignored (onConflictDoNothing).
 *   - deleteCustomerTag is blocked when assignmentCount > 0 (TAG_HAS_ASSIGNMENTS).
 *     Unassign all customers first.
 *   - getCustomerTagDetails accepts an optional withCustomers flag to include
 *     the full list of assigned customers with their details.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getCustomerTagTools = (db: ReturnType<typeof getDb>) => ({

  listCustomerTags: tool({
    description:
      "List customer tags with optional name search and pagination. " +
      "Each tag includes id, name, color (hex), and assignmentCount (how many customers have this tag). " +
      "Optional: search (string), limit (1-100, default 50), offset (default 0).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = listCustomerTagsSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: search (string, optional), limit (1-100, default 50), offset (int >= 0, default 0)`,
        };
      }
      try {
        const tags = await queries.getAllTags(db, parsed.data);
        return { success: true, count: tags.length, tags };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  getCustomerTagDetails: tool({
    description:
      "Fetch a customer tag by ID. " +
      "Set withCustomers: true to include the full list of assigned customers " +
      "(each entry includes id, name, phone, wilaya, totalOrders, totalSpent, assignedAt). " +
      "Required: tagId (UUID). Optional: withCustomers (boolean, default false).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = getCustomerTagDetailsSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: tagId (UUID), withCustomers (boolean, optional)`,
        };
      }
      try {
        const tag = parsed.data.withCustomers
          ? await queries.getTagWithCustomers(db, parsed.data.tagId)
          : await queries.getTagById(db, parsed.data.tagId);
        if (!tag) {
          return { success: false, error: `Customer tag not found with ID: ${parsed.data.tagId}` };
        }
        return { success: true, tag };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  createCustomerTag: tool({
    description:
      "Creates a new customer tag. " +
      "Required: name (1-50 chars). " +
      "Optional: color (hex color string e.g. '#64748b', default #64748b).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = createCustomerTagToolSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid tag data: ${errorDetails}. Required: name (1-50 chars). Optional: color (hex #RRGGBB, default #64748b)`,
        };
      }
      try {
        const tag = await queries.createTag(db, parsed.data);
        return {
          success: true,
          tag,
          message: `Customer tag "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to create customer tag: ${error.message}` };
      }
    },
  }),

  updateCustomerTag: tool({
    description:
      "Partially updates a customer tag. All fields are optional. " +
      "color must be a valid hex string e.g. '#22c55e'.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = updateCustomerTagToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid update arguments: ${errorDetails}. Expected: tagId (UUID), updates with optional fields: name (1-50 chars), color (hex #RRGGBB)`,
        };
      }
      try {
        const tag = await queries.updateTag(db, parsed.data.tagId, parsed.data.updates);
        if (!tag) {
          return { success: false, error: `Customer tag not found with ID: ${parsed.data.tagId}` };
        }
        return { success: true, tag, message: "Customer tag updated successfully" };
      } catch (error: any) {
        return { success: false, error: `Failed to update customer tag: ${error.message}` };
      }
    },
  }),

  deleteCustomerTag: tool({
    description:
      "Permanently deletes a customer tag. " +
      "BLOCKED if the tag is assigned to any customers (TAG_HAS_ASSIGNMENTS) — unassign all customers first using unassignTagFromCustomer. " +
      "This action is irreversible.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = deleteCustomerTagSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: tagId (UUID string)`,
        };
      }
      try {
        const tag = await queries.getTagById(db, parsed.data.tagId);
        if (!tag) {
          return { success: false, error: `Customer tag not found with ID: ${parsed.data.tagId}` };
        }
        if (tag.assignmentCount > 0) {
          return {
            success: false,
            error: `Cannot delete tag "${tag.name}" — it is assigned to ${tag.assignmentCount} customer(s). Unassign all customers first using unassignTagFromCustomer.`,
          };
        }
        await queries.deleteTag(db, parsed.data.tagId);
        return {
          success: true,
          message: `Customer tag "${tag.name}" (${parsed.data.tagId}) deleted successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to delete customer tag: ${error.message}` };
      }
    },
  }),

  assignTagToCustomer: tool({
    description:
      "Assigns a tag to a customer. Idempotent — assigning an already-tagged customer is silently ignored. " +
      "Required: tagId (UUID), customerId (UUID). " +
      "Both the tag and the customer must exist.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = assignTagToCustomerSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: tagId (UUID), customerId (UUID)`,
        };
      }
      try {
        const tag = await queries.getTagById(db, parsed.data.tagId);
        if (!tag) {
          return { success: false, error: `Customer tag not found with ID: ${parsed.data.tagId}` };
        }
        await queries.assignTag(db, parsed.data.tagId, parsed.data.customerId);
        return {
          success: true,
          message: `Tag "${tag.name}" assigned to customer ${parsed.data.customerId}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to assign tag: ${error.message}` };
      }
    },
  }),

  unassignTagFromCustomer: tool({
    description:
      "Removes a tag from a customer. " +
      "Required: tagId (UUID), customerId (UUID). " +
      "If the customer does not have this tag, the operation completes silently.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = unassignTagFromCustomerSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: tagId (UUID), customerId (UUID)`,
        };
      }
      try {
        const tag = await queries.getTagById(db, parsed.data.tagId);
        if (!tag) {
          return { success: false, error: `Customer tag not found with ID: ${parsed.data.tagId}` };
        }
        await queries.unassignTag(db, parsed.data.tagId, parsed.data.customerId);
        return {
          success: true,
          message: `Tag "${tag.name}" removed from customer ${parsed.data.customerId}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to unassign tag: ${error.message}` };
      }
    },
  }),
});
