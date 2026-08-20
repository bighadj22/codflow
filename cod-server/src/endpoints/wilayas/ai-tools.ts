import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { wilayaFiltersSchema } from "./validation";
import { getDb } from "@/db";

/**
 * AI Tools for Wilaya & Commune Reference Data
 *
 * Wilayas are Algeria's 58 administrative provinces. They are read-only
 * reference data used throughout the CRM for customer addresses, driver
 * coverage zones, and shipping profiles.
 *
 * Key domain facts:
 * - Wilaya IDs are integers 1–58 (NOT UUIDs) — they map to Algeria's
 *   official wilaya numbering system.
 * - Each wilaya has a French name (name) and an Arabic name (nameAr).
 *   Search works across both.
 * - Communes are sub-divisions of a wilaya. communeId (UUID) is used when
 *   creating/updating customers or orders for precise address targeting.
 * - These are purely read-only — no create, update, or delete operations exist.
 *
 * Typical agent workflow:
 *   1. Call listWilayas (optionally with search) to find the right wilaya
 *      and get its integer ID.
 *   2. Call listWilayaCommunes with that ID to get communes and their UUIDs.
 *   3. Use wilayaId (int) and communeId (UUID) when creating/updating
 *      customers, drivers, or orders.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getWilayaTools = (db: ReturnType<typeof getDb>) => ({

  listWilayas: tool({
    description:
      "List all 58 Algerian wilayas (administrative provinces), ordered by their official ID (1–58). " +
      "Each wilaya has an integer id, a French name, and an Arabic nameAr. " +
      "Optional: pass a search string to filter by name in either French or Arabic. " +
      "Use this to look up a wilaya's integer ID before creating or updating a customer, driver, or order.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = wilayaFiltersSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: search (string, optional — searches both French and Arabic names)`,
        };
      }

      try {
        const wilayaList = await queries.getAllWilayas(db, parsed.data);
        return {
          success: true,
          count: wilayaList.length,
          wilayas: wilayaList.map((w) => ({
            id: w.id,       // integer 1–58
            name: w.name,   // French name
            nameAr: w.nameAr, // Arabic name
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

  listWilayaCommunes: tool({
    description:
      "List all communes (sub-districts) for a specific wilaya, ordered alphabetically by name. " +
      "Each commune has a UUID id and a name. " +
      "Use the commune UUID as communeId when creating or updating a customer or order for precise address targeting. " +
      "wilayaId must be an integer between 1 and 58.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation — wilayaId is an integer 1–58, not a UUID
      const validationSchema = z.object({
        wilayaId: z
          .number()
          .int()
          .min(1)
          .max(58)
          .describe("Integer ID of the wilaya (1–58, Algeria's official numbering)"),
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: wilayaId (integer between 1 and 58). Use listWilayas first to find the correct integer ID.`,
        };
      }

      try {
        // Verify the wilaya exists before fetching communes
        const wilaya = await queries.getWilayaById(db, parsed.data.wilayaId);
        if (!wilaya) {
          return {
            success: false,
            error: `Wilaya not found with ID: ${parsed.data.wilayaId}. Valid IDs are integers 1–58.`,
          };
        }

        const communeList = await queries.getCommunesByWilaya(db, parsed.data.wilayaId);
        return {
          success: true,
          wilaya: {
            id: wilaya.id,
            name: wilaya.name,
            nameAr: wilaya.nameAr,
          },
          count: communeList.length,
          communes: communeList.map((c) => ({
            id: c.id,     // UUID — use this as communeId in customer/order creation
            name: c.name,
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
});
