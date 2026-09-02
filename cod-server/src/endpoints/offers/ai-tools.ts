import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { createOfferSchema, updateOfferSchema } from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listOffersSchema = z.object({});
export const getOfferDetailsSchema = z.object({
  offerId: z.string().uuid().describe("The unique UUID of the offer to retrieve"),
});
export const createOfferToolSchema = createOfferSchema;
export const updateOfferToolSchema = z.object({
  offerId: z.string().uuid().describe("The UUID of the offer to update"),
  updates: updateOfferSchema,
});
export const deleteOfferSchema = z.object({
  offerId: z.string().uuid().describe("The UUID of the offer to delete"),
});

export const OFFER_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listOffers: listOffersSchema.shape,
  getOfferDetails: getOfferDetailsSchema.shape,
  createOffer: createOfferToolSchema.shape,
  updateOffer: updateOfferToolSchema.shape,
  deleteOffer: deleteOfferSchema.shape,
};

/**
 * AI Tools for Offer Management
 *
 * Offers are "Buy X Get Y" promotions that are auto-applied server-side when
 * a store order meets the trigger conditions — no coupon code is needed.
 *
 * Two discount types:
 *   - "free"          → customer gets rewardQuantity units of rewardProduct at $0
 *   - "free_shipping" → delivery fee is waived; no reward product involved
 *
 * Trigger logic (applied at order time, not here):
 *   - Order contains triggerProductId (and triggerVariantId if set)
 *   - Ordered quantity >= triggerQuantity
 *   - Offer status is "active" and current time is within startsAt/endsAt window
 *   - If reward item is out of stock, offer is silently skipped (order still succeeds)
 *
 * Cross-field rule enforced in Layer 2:
 *   - discountType "free"          → rewardProductId is REQUIRED
 *   - discountType "free_shipping" → rewardProductId must be omitted / null
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getOfferTools = (db: ReturnType<typeof getDb>) => ({

  listOffers: tool({
    description:
      "List all Buy X Get Y promotional offers, ordered newest first. " +
      "Each offer includes fully resolved triggerProduct, triggerVariant, rewardProduct, and rewardVariant objects. " +
      "Use this to see what promotions are currently configured and their active/inactive status.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (_args) => {
      // No filters on this endpoint — list always returns all offers
      try {
        const offerList = await queries.listOffers(db);
        return {
          success: true,
          count: offerList.length,
          offers: offerList.map((o) => ({
            id: o.id,
            name: o.name,
            status: o.status,
            discountType: o.discountType,
            triggerProduct: o.triggerProduct,
            triggerVariant: o.triggerVariant,
            triggerQuantity: o.triggerQuantity,
            rewardProduct: o.rewardProduct,
            rewardVariant: o.rewardVariant,
            rewardQuantity: o.rewardQuantity,
            startsAt: o.startsAt,
            endsAt: o.endsAt,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
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

  getOfferDetails: tool({
    description:
      "Fetch full details for a specific offer by its UUID. " +
      "Returns the offer with fully resolved product and variant references. " +
      "Use this before updating an offer or to confirm its current configuration.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = getOfferDetailsSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: offerId (UUID string)`,
        };
      }

      try {
        const offer = await queries.getOfferById(db, parsed.data.offerId);
        if (!offer) {
          return {
            success: false,
            error: `Offer not found with ID: ${parsed.data.offerId}`,
          };
        }
        return { success: true, offer };
      } catch (error: any) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    },
  }),

  createOffer: tool({
    description:
      "Creates a new Buy X Get Y promotional offer. " +
      "Required: name (2-200 chars), triggerProductId (UUID), triggerQuantity (int 1-1000). " +
      "discountType rules: " +
      '  "free" (default) → rewardProductId is REQUIRED; rewardQuantity defaults to 1. ' +
      '  "free_shipping"  → omit rewardProductId and rewardVariantId; set rewardQuantity to 0. ' +
      "Optional: triggerVariantId (lock trigger to a specific variant), " +
      "rewardVariantId (lock reward to a specific variant), " +
      "startsAt / endsAt (ISO-8601 datetime strings for scheduling), " +
      'status ("active" | "inactive", default "active").',
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation (includes cross-field rewardProductId rule)
      const parsed = createOfferToolSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid offer data: ${errorDetails}. ` +
            `Required: name (2-200 chars), triggerProductId (UUID), triggerQuantity (int 1-1000). ` +
            `discountType "free" (default): rewardProductId (UUID) is required, rewardQuantity defaults to 1. ` +
            `discountType "free_shipping": omit rewardProductId; set rewardQuantity to 0. ` +
            `Optional: triggerVariantId (UUID), rewardVariantId (UUID), ` +
            `startsAt (ISO-8601 datetime), endsAt (ISO-8601 datetime), ` +
            `status ("active" | "inactive", default "active").`,
        };
      }

      try {
        const { id } = await queries.createOffer(db, parsed.data);
        const offer = await queries.getOfferById(db, id);
        return {
          success: true,
          offer,
          message: `Offer "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create offer: ${error.message}`,
        };
      }
    },
  }),

  updateOffer: tool({
    description:
      "Partially updates an existing offer. All fields are optional — only include what you want to change. " +
      "If you change discountType to 'free', ensure rewardProductId is also set (either already on the offer or included in this update). " +
      "If you change discountType to 'free_shipping', clear rewardProductId and rewardVariantId by setting them to null. " +
      "Changing triggerProductId or triggerVariantId takes effect immediately for new orders.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = updateOfferToolSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid update arguments: ${errorDetails}. ` +
            `Expected: offerId (UUID), updates object with optional fields: ` +
            `name (2-200 chars), discountType ("free" | "free_shipping"), ` +
            `triggerProductId (UUID), triggerVariantId (UUID or null), triggerQuantity (int 1-1000), ` +
            `rewardProductId (UUID or null), rewardVariantId (UUID or null), rewardQuantity (int 0-1000), ` +
            `startsAt (ISO-8601 or null), endsAt (ISO-8601 or null), status ("active" | "inactive").`,
        };
      }

      try {
        const existing = await queries.getOfferById(db, parsed.data.offerId);
        if (!existing) {
          return {
            success: false,
            error: `Offer not found with ID: ${parsed.data.offerId}`,
          };
        }

        await queries.updateOffer(db, parsed.data.offerId, parsed.data.updates);
        const offer = await queries.getOfferById(db, parsed.data.offerId);
        return {
          success: true,
          offer,
          message: "Offer updated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to update offer: ${error.message}`,
        };
      }
    },
  }),

  deleteOffer: tool({
    description:
      "Permanently deletes an offer. Already-placed orders that used this offer are NOT affected — " +
      "their reward line items remain intact. " +
      "This action is immediate and irreversible. " +
      "Consider setting status to 'inactive' instead if you may want to re-enable the offer later.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = deleteOfferSchema;

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: offerId (UUID string)`,
        };
      }

      try {
        const existing = await queries.getOfferById(db, parsed.data.offerId);
        if (!existing) {
          return {
            success: false,
            error: `Offer not found with ID: ${parsed.data.offerId}`,
          };
        }

        await queries.deleteOffer(db, parsed.data.offerId);
        return {
          success: true,
          message: `Offer "${existing.name}" (${parsed.data.offerId}) deleted successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to delete offer: ${error.message}`,
        };
      }
    },
  }),
});
