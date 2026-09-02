import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { 
  customerFiltersSchema, 
  createCustomerSchema, 
  updateCustomerSchema 
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listCustomersSchema = customerFiltersSchema;
export const getCustomerDetailsSchema = z.object({
  customerId: z.string().uuid().describe("The unique UUID of the customer to retrieve"),
});
export const findCustomerByPhoneSchema = z.object({
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number").describe("Algerian phone number starting with 05, 06, or 07"),
});
export const getCustomerOrderHistorySchema = z.object({
  customerId: z.string().uuid().describe("The unique UUID of the customer"),
});
export const getCustomerMembershipsSchema = z.object({
  customerId: z.string().uuid().describe("The UUID of the customer"),
});
export const createNewCustomerSchema = createCustomerSchema;
export const updateCustomerProfileSchema = z.object({
  customerId: z.string().uuid().describe("The UUID of the customer to update"),
  updates: updateCustomerSchema,
});
export const deleteCustomerSchema = z.object({
  customerId: z.string().uuid().describe("The UUID of the customer to delete"),
});

export const CUSTOMER_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listCustomers: listCustomersSchema.shape,
  getCustomerDetails: getCustomerDetailsSchema.shape,
  findCustomerByPhone: findCustomerByPhoneSchema.shape,
  getCustomerOrderHistory: getCustomerOrderHistorySchema.shape,
  getCustomerMemberships: getCustomerMembershipsSchema.shape,
  createNewCustomer: createNewCustomerSchema.shape,
  updateCustomerProfile: updateCustomerProfileSchema.shape,
  deleteCustomer: deleteCustomerSchema.shape,
};

/**
 * AI Tools for Customer Management
 *
 * These tools allow the AI Agent to interact directly with the customers database
 * logic by reusing existing queries and validation schemas.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 *
 * This ensures the AI agent can recover from validation errors without breaking the conversation.
 */
export const getCustomerTools = (db: ReturnType<typeof getDb>) => ({

  
  listCustomers: tool({
    description: "Search and filter customers in the CRM. Returns basic profile info for multiple customers. Use this for discovery, finding groups by wilaya, or general search.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = customerFiltersSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: wilayaId (1-58), search (string), groupId (UUID), tagId (UUID), limit (1-100), offset (number)`,
        };
      }

      try {
        const customers = await queries.getAllCustomers(db, parsed.data);
        return { 
          success: true,
          count: customers.length,
          customers: customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            wilaya: c.wilaya,
            commune: c.commune,
            totalSpent: c.totalSpent,
            totalOrders: c.totalOrders,
            lastOrderAt: c.lastOrderAt
          }))
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  getCustomerDetails: tool({
    description: "Fetch comprehensive profile data for a specific customer, including their address and recent order history. Requires a valid customer UUID.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = getCustomerDetailsSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: customerId (UUID string)`,
        };
      }

      try {
        const customer = await queries.getCustomerById(db, parsed.data.customerId);
        if (!customer) {
          return { 
            success: false, 
            error: `Customer not found with ID: ${parsed.data.customerId}` 
          };
        }
        return { success: true, customer };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  findCustomerByPhone: tool({
    description: "Quick lookup for a customer using their Algerian phone number (e.g., 0555123456). Returns the customer profile if found.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = findCustomerByPhoneSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: phone (Algerian format: 0[5-7]XXXXXXXX)`,
        };
      }

      try {
        const customer = await queries.getCustomerByPhone(db, parsed.data.phone);
        if (!customer) {
          return { 
            success: false, 
            error: `No customer record found for phone number: ${parsed.data.phone}` 
          };
        }
        return { success: true, customer };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  createNewCustomer: tool({
    description: "Registers a new customer in the CRM. Required: name (string), phone (Algerian format: 0[5-7]XXXXXXXX), wilayaId (number 1-58). Optional: phone2, communeId (UUID), address (string). Note: wilayaId must be a number between 1 and 58.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = createCustomerSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid customer data: ${errorDetails}. Required: name (string), phone (Algerian format: 0[5-7]XXXXXXXX), wilayaId (number 1-58). Optional: phone2, communeId (UUID), address (string)`,
        };
      }

      try {
        const customer = await queries.createCustomer(db, parsed.data);
        return { 
          success: true, 
          customer, 
          message: `Customer ${parsed.data.name} created successfully` 
        };
      } catch (error: any) {
        // Check for duplicate phone error
        if (error.message && error.message.includes("DUPLICATE_PHONE")) {
          return { 
            success: false, 
            error: `A customer with phone number ${parsed.data.phone} already exists. Use findCustomerByPhone to retrieve the existing record.` 
          };
        }
        return { 
          success: false, 
          error: `Failed to create customer: ${error.message}` 
        };
      }
    },
  }),

  updateCustomerProfile: tool({
    description: "Updates an existing customer's information. Only provided fields will be modified. Required: customerId (UUID), updates object with optional fields: name, phone (0[5-7]XXXXXXXX), phone2, wilayaId (1-58), communeId (UUID or null), address (string or null).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = updateCustomerProfileSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid update arguments: ${errorDetails}. Expected: customerId (UUID), updates object with optional fields: name, phone (0[5-7]XXXXXXXX), phone2, wilayaId (1-58), communeId (UUID or null), address (string or null)`,
        };
      }

      try {
        const customer = await queries.updateCustomer(db, parsed.data.customerId, parsed.data.updates);
        if (!customer) {
          return { 
            success: false, 
            error: `Customer not found with ID: ${parsed.data.customerId}` 
          };
        }
        return { 
          success: true, 
          customer, 
          message: "Customer profile updated successfully" 
        };
      } catch (error: any) {
        // Check for duplicate phone error
        if (error.message && error.message.includes("DUPLICATE_PHONE")) {
          return { 
            success: false, 
            error: `Phone number ${parsed.data.updates.phone} is already used by another customer. Choose a different phone number.` 
          };
        }
        return { 
          success: false, 
          error: `Failed to update customer: ${error.message}` 
        };
      }
    },
  }),

  getCustomerOrderHistory: tool({
    description: "Retrieves the complete list of orders for a specific customer with status history and payment info.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = getCustomerOrderHistorySchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: customerId (UUID string)`,
        };
      }

      try {
        const orders = await queries.getOrdersByCustomerId(db, parsed.data.customerId);
        return { 
          success: true, 
          count: orders.length, 
          orders: orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            totalPrice: o.price,
            createdAt: o.createdAt,
            wilaya: o.wilaya,
            commune: o.commune
          }))
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  getCustomerMemberships: tool({
    description: "Get the groups and tags assigned to a customer. Useful for understanding customer segmentation.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = getCustomerMembershipsSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: customerId (UUID string)`,
        };
      }

      try {
        const [groups, tags] = await Promise.all([
          queries.getCustomerGroupMemberships(db, parsed.data.customerId),
          queries.getCustomerTagMemberships(db, parsed.data.customerId)
        ]);
        return { 
          success: true, 
          groups, 
          tags,
          groupCount: groups.length,
          tagCount: tags.length
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  deleteCustomer: tool({
    description: "Removes a customer record from the CRM. Warning: This only works if the customer has no associated orders. Use with caution - this action is permanent.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = deleteCustomerSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: customerId (UUID string)`,
        };
      }

      try {
        await queries.deleteCustomer(db, parsed.data.customerId);
        return { 
          success: true, 
          message: `Customer ${parsed.data.customerId} deleted successfully` 
        };
      } catch (error: any) {
        let errorMessage = error.message;
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.code === "CUSTOMER_HAS_ORDERS") {
            errorMessage = `Cannot delete customer because they have ${errorData.orderCount} associated order(s). Customers with order history cannot be deleted. Consider archiving or tagging them instead.`;
          }
        } catch (e) {
          // Not JSON, use original message
        }
        return { 
          success: false, 
          error: errorMessage 
        };
      }
    },
  }),
});
