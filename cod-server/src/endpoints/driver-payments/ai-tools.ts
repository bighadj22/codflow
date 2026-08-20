import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { createPaymentSchema } from "./validation";
import { getDb } from "@/db";

/**
 * AI Tools for Driver Payment Management
 * 
 * These tools allow the AI Agent to interact directly with the driver payments
 * and settlement logic.
 * 
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 * 
 * This ensures the AI agent can recover from validation errors without breaking the conversation.
 */
export const getDriverPaymentTools = (db: ReturnType<typeof getDb>) => ({
  listDriverPayments: tool({
    description: "Fetch all settlement and payment records for a specific driver. Returns history of COD remittances, fee payments, and net settlements.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        driverId: z.string().uuid().describe("The unique UUID of the driver to retrieve payments for"),
      });
      
      const parsed = validationSchema.safeParse(args);
      
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
        const payments = await queries.getDriverPayments(db, parsed.data.driverId);
        return { 
          success: true,
          count: payments.length,
          payments: payments.map(p => ({
            id: p.id,
            type: p.type,
            amount: p.amount,
            orderCount: p.orderCount,
            createdAt: p.createdAt,
            createdByName: p.createdByName,
            notes: p.notes
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

  getPendingSettlements: tool({
    description: "Finds all delivered orders for a driver that have not yet been settled (COD or fees). Use this to prepare a payment or remittance. Returns orders in 'delivered' status with no COD payment linked.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        driverId: z.string().uuid().describe("The unique UUID of the driver"),
      });
      
      const parsed = validationSchema.safeParse(args);
      
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
        const orders = await queries.getPendingSettlementOrders(db, parsed.data.driverId);
        return { 
          success: true,
          count: orders.length,
          orders: orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            codAmount: o.codAmount,
            driverFee: o.driverFee,
            updatedAt: o.updatedAt,
            status: o.status
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

  createDriverSettlement: tool({
    description: "Creates a new payment/settlement record for a driver. Use this to settle multiple delivered orders at once. Required: driverId (UUID), type (cod_remittance|fee_payment|net_settlement), orderIds (array of UUIDs), agentName (string). Optional: notes. Orders must be in 'delivered' status and not already settled.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = createPaymentSchema.extend({
        agentName: z.string().min(1).describe("The name of the AI agent or staff member creating the settlement"),
      });
      
      const parsed = validationSchema.safeParse(args);
      
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid settlement data: ${errorDetails}. Required: driverId (UUID), type (cod_remittance|fee_payment|net_settlement), orderIds (array of order UUIDs, min 1), agentName (string). Optional: notes (string). Orders must be in 'delivered' status and not already settled for the requested type.`,
        };
      }

      try {
        const result = await queries.createDriverPayment(
          db, 
          {
            driverId: parsed.data.driverId,
            type: parsed.data.type,
            orderIds: parsed.data.orderIds,
            notes: parsed.data.notes,
          }, 
          "ai-agent", // Hardcoded agent ID or generic placeholder
          parsed.data.agentName
        );
        return { 
          success: true, 
          settlement: result, 
          message: `Settlement created: ${result.type} for ${result.orderCount} order(s), amount: ${result.amount} DZD` 
        };
      } catch (error: any) {
        let errorMessage = error.message;
        
        // Parse BusinessLogicError with structured data
        if (error.data) {
          const data = error.data;
          if (data.settledOrderIds && data.settledCount) {
            errorMessage = `${error.message}. ${data.settledCount} order(s) are already settled. Check order settlement status before retrying.`;
          } else if (data.requestedCount && data.foundCount) {
            errorMessage = `${error.message}. Requested ${data.requestedCount} orders but only found ${data.foundCount} valid delivered orders for this driver. Verify order IDs, driver assignment, and order status.`;
          } else {
            errorMessage = `${error.message}: ${JSON.stringify(data)}`;
          }
        }
        
        return { 
          success: false, 
          error: errorMessage 
        };
      }
    },
  }),
});
