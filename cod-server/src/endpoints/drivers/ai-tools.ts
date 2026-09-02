import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  driverFiltersSchema,
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema as updateDriverStatusInputSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listDriversSchema = driverFiltersSchema;
export const getDriverDetailsSchema = z.object({
  driverId: z.string().uuid().describe("The unique UUID of the driver to retrieve"),
});
export const createNewDriverSchema = createDriverSchema;
export const updateDriverProfileSchema = z.object({
  driverId: z.string().uuid().describe("The UUID of the driver to update"),
  updates: updateDriverSchema,
});
export const updateDriverStatusSchema = z.object({
  driverId: z.string().uuid().describe("The UUID of the driver"),
  status: updateDriverStatusInputSchema.shape.status,
});
export const deleteDriverSchema = z.object({
  driverId: z.string().uuid().describe("The UUID of the driver to delete"),
});

export const DRIVER_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listDrivers: listDriversSchema.shape,
  getDriverDetails: getDriverDetailsSchema.shape,
  createNewDriver: createNewDriverSchema.shape,
  updateDriverProfile: updateDriverProfileSchema.shape,
  updateDriverStatus: updateDriverStatusSchema.shape,
  deleteDriver: deleteDriverSchema.shape,
};

/**
 * AI Tools for Driver Management
 *
 * These tools allow the AI Agent to interact directly with the drivers database
 * logic by reusing existing queries and validation schemas.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 *
 * This ensures the AI agent can recover from validation errors without breaking the conversation.
 */
export const getDriverTools = (db: ReturnType<typeof getDb>) => ({
  
  listDrivers: tool({
    description: "Search and filter drivers in the CRM. Returns driver profile info, availability status, and performance metrics. Use this to find available drivers or those covering specific wilayas.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation with graceful error handling
      const parsed = listDriversSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: wilayaId (1-58), status (available|busy|inactive), vehicleType (motorcycle|car|van), search (string), limit (1-100), offset (number)`,
        };
      }

      try {
        const drivers = await queries.getAllDrivers(db, parsed.data);
        return { 
          success: true,
          count: drivers.length,
          drivers: drivers.map(d => ({
            id: d.id,
            firstName: d.firstName,
            lastName: d.lastName,
            phone: d.phone,
            status: d.status,
            vehicleType: d.vehicleType,
            compensationWilayaCount: d.compensationWilayaCount,
            totalDelivered: d.totalDelivered,
            pendingCash: d.pendingCash
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

  getDriverDetails: tool({
    description: "Fetch comprehensive profile data for a specific driver, including compensation summary and recent delivery history.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = getDriverDetailsSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: driverId (UUID string)`,
        };
      }

      try {
        const driver = await queries.getDriverById(db, parsed.data.driverId);
        if (!driver) {
          return { 
            success: false, 
            error: `Driver not found with ID: ${parsed.data.driverId}` 
          };
        }
        return { success: true, driver };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Database error: ${error.message}` 
        };
      }
    },
  }),

  createNewDriver: tool({
    description: "Registers a new delivery driver in the CRM. Required: firstName, lastName, phone (Algerian format: 0[5-7]XXXXXXXX). Optional: phone2, vehicleType (motorcycle|car|van), status (available|busy|inactive), notes. Per-wilaya pay is configured separately via driver compensation endpoints.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = createNewDriverSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid driver data: ${errorDetails}. Required fields: firstName (string), lastName (string), phone (Algerian format: 0[5-7]XXXXXXXX). Optional: phone2, vehicleType (motorcycle|car|van), status (available|busy|inactive, default: available), notes (string)`,
        };
      }

      try {
        const driver = await queries.createDriver(db, parsed.data);
        return { 
          success: true, 
          driver, 
          message: `Driver ${parsed.data.firstName} ${parsed.data.lastName} created successfully` 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Failed to create driver: ${error.message}` 
        };
      }
    },
  }),

  updateDriverProfile: tool({
    description: "Updates an existing driver's personal info or vehicle details. Only include fields you want to change.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = updateDriverProfileSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid update arguments: ${errorDetails}. Expected: driverId (UUID), updates object with optional fields: firstName, lastName, phone (0[5-7]XXXXXXXX), phone2, vehicleType (motorcycle|car|van), notes (string or null)`,
        };
      }

      try {
        const driver = await queries.updateDriver(db, parsed.data.driverId, parsed.data.updates);
        if (!driver) {
          return { 
            success: false, 
            error: `Driver not found with ID: ${parsed.data.driverId}` 
          };
        }
        return { 
          success: true, 
          driver, 
          message: "Driver profile updated successfully" 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Failed to update driver: ${error.message}` 
        };
      }
    },
  }),

  updateDriverStatus: tool({
    description: "Changes a driver's availability status. Valid statuses: available, busy, inactive.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = updateDriverStatusSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: driverId (UUID), status (one of: available, busy, inactive)`,
        };
      }

      try {
        const driver = await queries.updateDriverStatus(db, parsed.data.driverId, parsed.data.status);
        if (!driver) {
          return { 
            success: false, 
            error: `Driver not found with ID: ${parsed.data.driverId}` 
          };
        }
        return { 
          success: true, 
          driver, 
          message: `Driver status updated to ${parsed.data.status}` 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: `Failed to update status: ${error.message}` 
        };
      }
    },
  }),

  deleteDriver: tool({
    description: "Removes a driver record from the CRM. Warning: This only works if the driver has no active (assigned or out for delivery) orders. Use with caution - this action is permanent.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = deleteDriverSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: driverId (UUID string)`,
        };
      }

      try {
        await queries.deleteDriver(db, parsed.data.driverId);
        return { 
          success: true, 
          message: `Driver ${parsed.data.driverId} deleted successfully` 
        };
      } catch (error: any) {
        // Parse structured error from ConflictError
        let errorMessage = error.message;
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.code === "DRIVER_HAS_ACTIVE_ORDERS") {
            errorMessage = `Cannot delete driver because they have ${parsed.context?.activeOrderCount || 'active'} order(s) in assigned or out_for_delivery status. Complete or reassign those orders first.`;
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
