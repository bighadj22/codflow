import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  createCustomerGroupSchema,
  updateCustomerGroupSchema,
  customerGroupFiltersSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listCustomerGroupsSchema = customerGroupFiltersSchema;
export const getCustomerGroupDetailsSchema = z.object({
  groupId: z.string().uuid().describe("UUID of the customer group"),
  withMembers: z.boolean().optional().default(false).describe("Include full member list"),
});
export const createCustomerGroupToolSchema = createCustomerGroupSchema;
export const updateCustomerGroupToolSchema = z.object({
  groupId: z.string().uuid().describe("UUID of the group to update"),
  updates: updateCustomerGroupSchema,
});
export const deleteCustomerGroupSchema = z.object({
  groupId: z.string().uuid().describe("UUID of the customer group to delete"),
});
export const addCustomerToGroupSchema = z.object({
  groupId: z.string().uuid().describe("UUID of the customer group"),
  customerId: z.string().uuid().describe("UUID of the customer to add"),
});
export const removeCustomerFromGroupSchema = z.object({
  groupId: z.string().uuid().describe("UUID of the customer group"),
  customerId: z.string().uuid().describe("UUID of the customer to remove"),
});

export const CUSTOMER_GROUP_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listCustomerGroups: listCustomerGroupsSchema.shape,
  getCustomerGroupDetails: getCustomerGroupDetailsSchema.shape,
  createCustomerGroup: createCustomerGroupToolSchema.shape,
  updateCustomerGroup: updateCustomerGroupToolSchema.shape,
  deleteCustomerGroup: deleteCustomerGroupSchema.shape,
  addCustomerToGroup: addCustomerToGroupSchema.shape,
  removeCustomerFromGroup: removeCustomerFromGroupSchema.shape,
};

/**
 * AI Tools for Customer Group Management
 *
 * Customer groups are named segments of customers used for targeted
 * marketing, reporting, and bulk operations (e.g. "VIP", "Wholesale").
 *
 * Key domain facts:
 *   - Each group has a name (1-100 chars), optional description (max 500),
 *     and a color (hex #RRGGBB, default #6366f1).
 *   - memberCount is a denormalized counter kept in sync automatically.
 *   - addCustomerToGroup is idempotent — adding an already-member customer
 *     is silently ignored (onConflictDoNothing).
 *   - deleteCustomerGroup is blocked when memberCount > 0 (GROUP_HAS_MEMBERS).
 *     Remove all members first, or use the group for reference only.
 *   - getCustomerGroupDetails accepts an optional withMembers flag to include
 *     the full member list with customer details.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getCustomerGroupTools = (db: ReturnType<typeof getDb>) => ({

  listCustomerGroups: tool({
    description:
      "List customer groups with optional name search and pagination. " +
      "Each group includes id, name, description, color (hex), and memberCount. " +
      "Optional: search (string), limit (1-100, default 50), offset (default 0).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = listCustomerGroupsSchema.safeParse(args);
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
        const groups = await queries.getAllGroups(db, parsed.data);
        return { success: true, count: groups.length, groups };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  getCustomerGroupDetails: tool({
    description:
      "Fetch a customer group by ID. " +
      "Set withMembers: true to include the full member list (each member includes id, name, phone, wilaya, totalOrders, totalSpent, assignedAt). " +
      "Required: groupId (UUID). Optional: withMembers (boolean, default false).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = getCustomerGroupDetailsSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: groupId (UUID), withMembers (boolean, optional)`,
        };
      }
      try {
        const group = parsed.data.withMembers
          ? await queries.getGroupWithMembers(db, parsed.data.groupId)
          : await queries.getGroupById(db, parsed.data.groupId);
        if (!group) {
          return { success: false, error: `Customer group not found with ID: ${parsed.data.groupId}` };
        }
        return { success: true, group };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  createCustomerGroup: tool({
    description:
      "Creates a new customer group. " +
      "Required: name (1-100 chars). " +
      "Optional: description (max 500 chars), color (hex color string e.g. '#6366f1', default #6366f1).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = createCustomerGroupToolSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid group data: ${errorDetails}. Required: name (1-100 chars). Optional: description (max 500 chars), color (hex #RRGGBB, default #6366f1)`,
        };
      }
      try {
        const group = await queries.createGroup(db, parsed.data);
        return {
          success: true,
          group,
          message: `Customer group "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to create customer group: ${error.message}` };
      }
    },
  }),

  updateCustomerGroup: tool({
    description:
      "Partially updates a customer group. All fields are optional. " +
      "Set description: null to clear it. " +
      "color must be a valid hex string e.g. '#ef4444'.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = updateCustomerGroupToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid update arguments: ${errorDetails}. Expected: groupId (UUID), updates with optional fields: name (1-100 chars), description (max 500 or null), color (hex #RRGGBB)`,
        };
      }
      try {
        const group = await queries.updateGroup(db, parsed.data.groupId, parsed.data.updates);
        if (!group) {
          return { success: false, error: `Customer group not found with ID: ${parsed.data.groupId}` };
        }
        return { success: true, group, message: "Customer group updated successfully" };
      } catch (error: any) {
        return { success: false, error: `Failed to update customer group: ${error.message}` };
      }
    },
  }),

  deleteCustomerGroup: tool({
    description:
      "Permanently deletes a customer group. " +
      "BLOCKED if the group has any members (GROUP_HAS_MEMBERS) — remove all members first using removeCustomerFromGroup. " +
      "This action is irreversible.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = deleteCustomerGroupSchema;
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
          return { success: false, error: `Customer group not found with ID: ${parsed.data.groupId}` };
        }
        if (group.memberCount > 0) {
          return {
            success: false,
            error: `Cannot delete group "${group.name}" — it has ${group.memberCount} member(s). Remove all members first using removeCustomerFromGroup.`,
          };
        }
        await queries.deleteGroup(db, parsed.data.groupId);
        return {
          success: true,
          message: `Customer group "${group.name}" (${parsed.data.groupId}) deleted successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to delete customer group: ${error.message}` };
      }
    },
  }),

  addCustomerToGroup: tool({
    description:
      "Adds a customer to a customer group. Idempotent — adding an already-member customer is silently ignored. " +
      "Required: groupId (UUID), customerId (UUID). " +
      "Both the group and the customer must exist.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = addCustomerToGroupSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: groupId (UUID), customerId (UUID)`,
        };
      }
      try {
        const group = await queries.getGroupById(db, parsed.data.groupId);
        if (!group) {
          return { success: false, error: `Customer group not found with ID: ${parsed.data.groupId}` };
        }
        await queries.addMember(db, parsed.data.groupId, parsed.data.customerId);
        return {
          success: true,
          message: `Customer ${parsed.data.customerId} added to group "${group.name}"`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to add member: ${error.message}` };
      }
    },
  }),

  removeCustomerFromGroup: tool({
    description:
      "Removes a customer from a customer group. " +
      "Required: groupId (UUID), customerId (UUID). " +
      "If the customer is not a member, the operation completes silently.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = removeCustomerFromGroupSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: groupId (UUID), customerId (UUID)`,
        };
      }
      try {
        const group = await queries.getGroupById(db, parsed.data.groupId);
        if (!group) {
          return { success: false, error: `Customer group not found with ID: ${parsed.data.groupId}` };
        }
        await queries.removeMember(db, parsed.data.groupId, parsed.data.customerId);
        return {
          success: true,
          message: `Customer ${parsed.data.customerId} removed from group "${group.name}"`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to remove member: ${error.message}` };
      }
    },
  }),
});
