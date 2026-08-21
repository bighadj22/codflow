/**
 * Shipping Profiles Route Handlers
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { NotFoundError, BusinessLogicError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/**
 * GET /shipping-profiles
 * List all shipping profiles with rule counts.
 */
export async function listProfiles(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.getAllProfiles(db);
  return c.json({ success: true, data, count: data.length }, 200);
}

/**
 * GET /shipping-profiles/default/rules
 * Get all rules for the default profile (used by order form for auto-fill).
 */
export async function getDefaultRules(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.getDefaultProfileRules(db);
  return c.json({ success: true, data }, 200);
}

/**
 * GET /shipping-profiles/:id
 * Get a single profile with all its wilaya rules.
 */
export async function getProfile(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const profile = await queries.getProfileById(db, c.req.param("id")!);
  if (!profile) {
    throw new NotFoundError("shipping_profile", c.req.param("id")!);
  }
  return c.json({ success: true, data: profile }, 200);
}

/**
 * POST /shipping-profiles
 * Create a new shipping profile.
 */
export async function createProfile(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? validation.createProfileSchema.parse(await c.req.json());
  const profile = await queries.createProfile(db, body);
  return c.json({ success: true, data: profile }, 201);
}

/**
 * PATCH /shipping-profiles/:id
 * Update profile name, notes, or set as default.
 */
export async function updateProfile(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? validation.updateProfileSchema.parse(await c.req.json());
  const profile = await queries.updateProfile(db, id, body);
  if (!profile) {
    throw new NotFoundError("shipping_profile", id);
  }
  return c.json({ success: true, data: profile }, 200);
}

/**
 * DELETE /shipping-profiles/:id
 * Delete a shipping profile and all its rules.
 */
export async function deleteProfile(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  
  // Check if profile exists
  const profile = await queries.getProfileById(db, id);
  if (!profile) {
    throw new NotFoundError("shipping_profile", id);
  }
  
  // Check if profile is in use by products
  if (profile.productCount > 0) {
    throw new BusinessLogicError(
      "Cannot delete shipping profile that is in use",
      ERROR_CODES.PROFILE_IN_USE,
      {
        profileId: id,
        profileName: profile.name,
        productCount: profile.productCount,
      }
    );
  }

  // Can't delete the default profile — it's the fallback for products with no override
  if (profile.isDefault) {
    throw new BusinessLogicError(
      "Cannot delete the default shipping profile — there must always be a default",
      ERROR_CODES.DEFAULT_PROFILE_REQUIRED,
      { profileId: id, profileName: profile.name },
    );
  }
  
  await queries.deleteProfile(db, id);
  return c.json({ success: true }, 200);
}

/**
 * PUT /shipping-profiles/:id/rules
 * Replace all wilaya rules for a profile.
 */
export async function setProfileRules(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? validation.bulkRulesSchema.parse(await c.req.json());
  const profile = await queries.setProfileRules(db, id, body);
  if (!profile) {
    throw new NotFoundError("shipping_profile", id);
  }
  return c.json({ success: true, data: profile }, 200);
}

/**
 * GET /shipping-profiles/:id/rules/:wilayaId/communes
 * List all communes in a wilaya with their current override status for this rule.
 * Returns effective values (after applying wilaya rule defaults) for each commune.
 */
export async function listCommuneOverrides(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const profileId = c.req.param("id")!;
  const wilayaId = parseInt(c.req.param("wilayaId")!, 10);

  const rule = await queries.getWilayaRule(db, profileId, wilayaId);
  if (!rule) {
    throw new NotFoundError("shipping_rule", `profile=${profileId} wilaya=${wilayaId}`);
  }

  const communes = await queries.getCommunesWithOverrides(db, rule.id, wilayaId, {
    homeEnabled: Boolean(rule.homeEnabled ?? true),
    stopDeskEnabled: Boolean(rule.stopDeskEnabled ?? false),
    homePrice: rule.homePrice ?? 0,
    stopDeskPrice: rule.stopDeskPrice ?? 0,
  });

  return c.json({ success: true, data: communes }, 200);
}

/**
 * PUT /shipping-profiles/:id/rules/:wilayaId/communes/:communeId
 * Set or update a commune-level delivery mode override.
 * Pass null for a field to reset it to wilaya rule default.
 * If both fields are null, the override row is deleted.
 */
export async function setCommuneOverride(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const profileId = c.req.param("id")!;
  const wilayaId = parseInt(c.req.param("wilayaId")!, 10);
  const communeId = c.req.param("communeId")!;

  const rule = await queries.getWilayaRule(db, profileId, wilayaId);
  if (!rule) {
    throw new NotFoundError("shipping_rule", `profile=${profileId} wilaya=${wilayaId}`);
  }

  const body = validation.communeOverrideSchema.parse(
    (c.req as any).valid?.("json") ?? await c.req.json()
  );
  await queries.setCommuneOverride(db, rule.id, communeId, body);

  return c.json({ success: true }, 200);
}

/**
 * DELETE /shipping-profiles/:id/rules/:wilayaId/communes/:communeId
 * Remove a commune override — resets to wilaya rule defaults.
 */
export async function deleteCommuneOverride(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const profileId = c.req.param("id")!;
  const wilayaId = parseInt(c.req.param("wilayaId")!, 10);
  const communeId = c.req.param("communeId")!;

  const rule = await queries.getWilayaRule(db, profileId, wilayaId);
  if (!rule) {
    throw new NotFoundError("shipping_rule", `profile=${profileId} wilaya=${wilayaId}`);
  }

  const deleted = await queries.deleteCommuneOverride(db, rule.id, communeId);
  if (!deleted) {
    throw new NotFoundError("commune_override", communeId);
  }

  return c.json({ success: true }, 200);
}
