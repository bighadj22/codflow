import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  createProfileSchema,
  updateProfileSchema,
  bulkRulesSchema,
  communeOverrideSchema,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 *
 * communeId uses the communes table's canonical `c-XX-YYY` format (e.g. c-16-163,
 * Algiers) — NOT a UUID. There are 1551 seeded communes, all in this format.
 */
export const listShippingProfilesSchema = z.object({});
export const getShippingProfileSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile"),
});
export const getDefaultShippingRulesSchema = z.object({});
export const createShippingProfileToolSchema = createProfileSchema;
export const updateShippingProfileToolSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile to update"),
  updates: updateProfileSchema,
});
export const deleteShippingProfileSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile to delete"),
});
export const setShippingProfileRulesToolSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile"),
  rules: bulkRulesSchema.shape.rules,
});
export const listCommuneOverridesSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile"),
  wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
});
export const setShippingCommuneOverrideToolSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile"),
  wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
  communeId: z.string().regex(/^c-\d{2}-\d{3}$/, "communeId must match the communes table format c-XX-YYY (e.g. c-01-001)").describe("Commune ID in the communes table format c-XX-YYY (e.g. c-16-163)"),
  override: communeOverrideSchema,
});
export const resetShippingCommuneOverrideSchema = z.object({
  profileId: z.string().min(1).describe("ID of the shipping profile"),
  wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
  communeId: z.string().regex(/^c-\d{2}-\d{3}$/, "communeId must match the communes table format c-XX-YYY (e.g. c-01-001)").describe("Commune ID (c-XX-YYY) whose override should be reset"),
});

export const SHIPPING_PROFILE_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listShippingProfiles: listShippingProfilesSchema.shape,
  getShippingProfile: getShippingProfileSchema.shape,
  getDefaultShippingRules: getDefaultShippingRulesSchema.shape,
  createShippingProfile: createShippingProfileToolSchema.shape,
  updateShippingProfile: updateShippingProfileToolSchema.shape,
  deleteShippingProfile: deleteShippingProfileSchema.shape,
  setShippingProfileRules: setShippingProfileRulesToolSchema.shape,
  listCommuneOverrides: listCommuneOverridesSchema.shape,
  setShippingCommuneOverride: setShippingCommuneOverrideToolSchema.shape,
  resetShippingCommuneOverride: resetShippingCommuneOverrideSchema.shape,
};

/**
 * AI Tools for Shipping Profile Management
 *
 * Shipping profiles define what the CUSTOMER pays for delivery.
 * They are referenced only by products (products.shippingProfileId).
 * Drivers and delivery companies have NO relationship to these profiles —
 * they have their own compensation data.
 *
 * Data model:
 *   ShippingProfile
 *     └── ShippingRule[]  (one per wilaya, wilayaId 1–58)
 *           └── CommuneOverride[]  (optional per-commune price/mode overrides)
 *
 * Key invariants:
 *   - Exactly ONE profile must always be marked isDefault at any time.
 *     Setting isDefault: true atomically unsets the previous default.
 *     Setting isDefault: false on the ONLY default is rejected (DEFAULT_PROFILE_REQUIRED).
 *   - A profile cannot be deleted if it is the default (DEFAULT_PROFILE_REQUIRED)
 *     or if any products reference it (PROFILE_IN_USE).
 *   - setShippingProfileRules is a full atomic replace — all existing rules
 *     (and their commune overrides via CASCADE) are deleted before new ones are inserted.
 *     Each wilayaId may appear at most once per profile (DUPLICATE_WILAYA_RULE).
 *   - Commune overrides inherit from the wilaya rule for any null field.
 *     Sending all-null fields to setCommuneOverride deletes the override row.
 *
 * Typical agent workflow for commune overrides:
 *   1. getShippingProfile → inspect rules to find the wilayaId you need
 *   2. listCommuneOverrides (profileId + wilayaId) → see current override state
 *   3. setShippingCommuneOverride (profileId + wilayaId + communeId + fields)
 *      The tool resolves the ruleId internally.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getShippingProfileTools = (db: ReturnType<typeof getDb>) => ({

  listShippingProfiles: tool({
    description:
      "List all shipping rate profiles. Each profile includes ruleCount (number of wilaya rules configured) " +
      "and productCount (how many products use this profile instead of the store default). " +
      "Use this to find a profile's ID before updating its rules or setting it as default.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input — no parameters
    execute: async (_args) => {
      try {
        const profiles = await queries.getAllProfiles(db);
        return { success: true, count: profiles.length, profiles };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  getShippingProfile: tool({
    description:
      "Fetch a single shipping profile with its full list of wilaya rules. " +
      "Each rule includes wilayaId, wilayaName, homePrice, stopDeskPrice, homeEnabled, stopDeskEnabled. " +
      "Use this before updating rules or inspecting commune overrides.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = getShippingProfileSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid arguments: ${parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ")}. Expected: profileId (string)`,
        };
      }

      try {
        const profile = await queries.getProfileById(db, parsed.data.profileId);
        if (!profile) {
          return { success: false, error: `Shipping profile not found with ID: ${parsed.data.profileId}` };
        }
        return { success: true, profile };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  getDefaultShippingRules: tool({
    description:
      "Returns the wilaya rules of the currently active default shipping profile. " +
      "Used to see what delivery fees apply to orders that don't have a product-specific profile. " +
      "Returns an empty array if no default profile is configured.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input — no parameters
    execute: async (_args) => {
      try {
        const rules = await queries.getDefaultProfileRules(db);
        return { success: true, count: rules.length, rules };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  createShippingProfile: tool({
    description:
      "Creates a new shipping profile (metadata only — no rules). " +
      "Use setShippingProfileRules afterwards to populate wilaya rates. " +
      "Required: name (non-empty string). " +
      "Optional: isDefault (boolean, default false — setting true atomically unsets the current default), " +
      "notes (string or null).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = createProfileSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid profile data: ${errorDetails}. Required: name (non-empty string). Optional: isDefault (boolean, default false), notes (string or null).`,
        };
      }

      try {
        const profile = await queries.createProfile(db, parsed.data);
        return {
          success: true,
          profile,
          message: `Shipping profile "${parsed.data.name}" created successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to create shipping profile: ${error.message}` };
      }
    },
  }),

  updateShippingProfile: tool({
    description:
      "Partially updates a shipping profile's metadata. All fields are optional. " +
      "Setting isDefault: true atomically unsets the previous default profile. " +
      "Setting isDefault: false on the ONLY default profile is rejected (DEFAULT_PROFILE_REQUIRED) — " +
      "set another profile as default first. " +
      "Set notes: null to clear the notes field.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = updateShippingProfileToolSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid update arguments: ${errorDetails}. Expected: profileId (string), updates object with optional fields: name (string), isDefault (boolean), notes (string or null).`,
        };
      }

      try {
        const profile = await queries.updateProfile(db, parsed.data.profileId, parsed.data.updates);
        if (!profile) {
          return { success: false, error: `Shipping profile not found with ID: ${parsed.data.profileId}` };
        }
        return { success: true, profile, message: "Shipping profile updated successfully" };
      } catch (error: any) {
        // Surface DEFAULT_PROFILE_REQUIRED clearly
        let errorMessage = error.message;
        if (error.data?.profileName) {
          errorMessage = `${error.message} (profile: "${error.data.profileName}"). Set another profile as default first, then unset this one.`;
        }
        return { success: false, error: errorMessage };
      }
    },
  }),

  deleteShippingProfile: tool({
    description:
      "Permanently deletes a shipping profile and all its wilaya rules (commune overrides cascade). " +
      "BLOCKED if: the profile is the default (DEFAULT_PROFILE_REQUIRED — set another as default first), " +
      "or if any products reference it (PROFILE_IN_USE — reassign those products first). " +
      "This action is irreversible.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = deleteShippingProfileSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: profileId (string)`,
        };
      }

      try {
        // Replicate handler-level guards before calling the shared deleteProfile
        const profile = await queries.getProfileById(db, parsed.data.profileId);
        if (!profile) {
          return { success: false, error: `Shipping profile not found with ID: ${parsed.data.profileId}` };
        }

        if (profile.isDefault) {
          return {
            success: false,
            error: `Cannot delete the default shipping profile "${profile.name}". Set another profile as default first, then delete this one.`,
          };
        }

        if (profile.productCount > 0) {
          return {
            success: false,
            error: `Cannot delete shipping profile "${profile.name}" — it is referenced by ${profile.productCount} product(s). Reassign those products to another profile first.`,
          };
        }

        await queries.deleteProfile(db, parsed.data.profileId);
        return {
          success: true,
          message: `Shipping profile "${profile.name}" (${parsed.data.profileId}) deleted successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to delete shipping profile: ${error.message}` };
      }
    },
  }),

  setShippingProfileRules: tool({
    description:
      "Atomically replaces ALL wilaya rules for a shipping profile. " +
      "Existing rules (and their commune overrides) are deleted before new ones are inserted. " +
      "Required: profileId (string), rules (array of rule objects). " +
      "Each rule: wilayaId (integer 1–58, required), homePrice (number >= 0, default 0), " +
      "stopDeskPrice (number >= 0, default 0), homeEnabled (boolean, default true), " +
      "stopDeskEnabled (boolean, default false). " +
      "Each wilayaId may appear at most once — duplicates are rejected (DUPLICATE_WILAYA_RULE). " +
      "Send rules: [] to clear all rules for the profile.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = setShippingProfileRulesToolSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid rules data: ${errorDetails}. ` +
            `Expected: profileId (string), rules (array). ` +
            `Each rule: wilayaId (int 1–58), homePrice (number >= 0), stopDeskPrice (number >= 0), ` +
            `homeEnabled (boolean, default true), stopDeskEnabled (boolean, default false). ` +
            `Each wilayaId must be unique within the array.`,
        };
      }

      try {
        const profile = await queries.setProfileRules(db, parsed.data.profileId, {
          rules: parsed.data.rules,
        });
        if (!profile) {
          return { success: false, error: `Shipping profile not found with ID: ${parsed.data.profileId}` };
        }
        return {
          success: true,
          profile,
          message: `Rules updated: ${parsed.data.rules.length} wilaya rule(s) set for profile "${profile.name}"`,
        };
      } catch (error: any) {
        // Surface DUPLICATE_WILAYA_RULE clearly
        let errorMessage = error.message;
        if (error.data?.duplicateWilayaIds) {
          errorMessage = `${error.message}. Duplicate wilayaIds: ${error.data.duplicateWilayaIds.join(", ")}. Remove duplicates and retry.`;
        }
        return { success: false, error: errorMessage };
      }
    },
  }),

  listCommuneOverrides: tool({
    description:
      "Lists all communes in a wilaya with their current override status for a specific shipping profile rule. " +
      "Each commune shows raw override fields (null = inherits from wilaya rule) and effective values " +
      "(after applying wilaya defaults). hasOverride=true means a custom override row exists. " +
      "Required: profileId (string), wilayaId (integer 1–58). " +
      "The profile must already have a rule for this wilaya — use setShippingProfileRules to add one first.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = listCommuneOverridesSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: profileId (string), wilayaId (integer 1–58).`,
        };
      }

      try {
        const rule = await queries.getWilayaRule(db, parsed.data.profileId, parsed.data.wilayaId);
        if (!rule) {
          return {
            success: false,
            error: `No shipping rule found for wilaya ${parsed.data.wilayaId} in profile ${parsed.data.profileId}. Add a rule for this wilaya via setShippingProfileRules first.`,
          };
        }

        const communes = await queries.getCommunesWithOverrides(db, rule.id, parsed.data.wilayaId, {
          homeEnabled: Boolean(rule.homeEnabled ?? true),
          stopDeskEnabled: Boolean(rule.stopDeskEnabled ?? false),
          homePrice: rule.homePrice ?? 0,
          stopDeskPrice: rule.stopDeskPrice ?? 0,
        });

        return { success: true, count: communes.length, communes };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  setShippingCommuneOverride: tool({
    description:
      "Sets or updates a commune-level delivery override on top of a wilaya rule. " +
      "Required: profileId (string), wilayaId (integer 1–58), communeId (c-XX-YYY, e.g. c-16-163). " +
      "Override fields (all optional, all nullable): homeEnabled (boolean or null), " +
      "stopDeskEnabled (boolean or null), homePrice (number >= 0 or null), stopDeskPrice (number >= 0 or null). " +
      "null = inherit from the wilaya rule at fee-resolution time. " +
      "If ALL four fields are null (or omitted), the override row is deleted (same as resetShippingCommuneOverride). " +
      "The profile must already have a rule for this wilaya.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = setShippingCommuneOverrideToolSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid arguments: ${errorDetails}. ` +
            `Expected: profileId (string), wilayaId (int 1–58), communeId (c-XX-YYY), ` +
            `override object with optional nullable fields: homeEnabled (boolean|null), ` +
            `stopDeskEnabled (boolean|null), homePrice (number >= 0 | null), stopDeskPrice (number >= 0 | null).`,
        };
      }

      try {
        // Resolve ruleId from profileId + wilayaId
        const rule = await queries.getWilayaRule(db, parsed.data.profileId, parsed.data.wilayaId);
        if (!rule) {
          return {
            success: false,
            error: `No shipping rule found for wilaya ${parsed.data.wilayaId} in profile ${parsed.data.profileId}. Add a rule for this wilaya via setShippingProfileRules first.`,
          };
        }

        await queries.setCommuneOverride(db, rule.id, parsed.data.communeId, parsed.data.override);
        return {
          success: true,
          message: `Commune override set for commune ${parsed.data.communeId} in wilaya ${parsed.data.wilayaId}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to set commune override: ${error.message}` };
      }
    },
  }),

  resetShippingCommuneOverride: tool({
    description:
      "Removes a commune-level override — the commune reverts to inheriting the wilaya rule defaults. " +
      "Required: profileId (string), wilayaId (integer 1–58), communeId (c-XX-YYY, e.g. c-16-163). " +
      "Returns an error if no override exists for this commune.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = resetShippingCommuneOverrideSchema;

      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: profileId (string), wilayaId (int 1–58), communeId (c-XX-YYY).`,
        };
      }

      try {
        // Resolve ruleId from profileId + wilayaId
        const rule = await queries.getWilayaRule(db, parsed.data.profileId, parsed.data.wilayaId);
        if (!rule) {
          return {
            success: false,
            error: `No shipping rule found for wilaya ${parsed.data.wilayaId} in profile ${parsed.data.profileId}.`,
          };
        }

        const deleted = await queries.deleteCommuneOverride(db, rule.id, parsed.data.communeId);
        if (!deleted) {
          return {
            success: false,
            error: `No override found for commune ${parsed.data.communeId} in wilaya ${parsed.data.wilayaId} — nothing to reset.`,
          };
        }

        return {
          success: true,
          message: `Commune override removed for commune ${parsed.data.communeId} — now inherits wilaya ${parsed.data.wilayaId} defaults`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to reset commune override: ${error.message}` };
      }
    },
  }),
});
