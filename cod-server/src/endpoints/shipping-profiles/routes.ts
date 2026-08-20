/**
 * Shipping Profiles Routes
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const shippingProfiles = new Hono<AppContext>();

// GET /shipping-profiles/default/rules — must be before /:id
shippingProfiles.get("/default/rules", requireScope(SCOPES.DELIVERY_READ), handlers.getDefaultRules);

// GET /shipping-profiles — list all profiles
shippingProfiles.get("/", requireScope(SCOPES.DELIVERY_READ), handlers.listProfiles);

// POST /shipping-profiles — create new profile
shippingProfiles.post("/", requireScope(SCOPES.DELIVERY_MANAGE), handlers.createProfile);

// GET /shipping-profiles/:id — get profile with rules
shippingProfiles.get("/:id", requireScope(SCOPES.DELIVERY_READ), handlers.getProfile);

// PATCH /shipping-profiles/:id — update profile metadata
shippingProfiles.patch("/:id", requireScope(SCOPES.DELIVERY_MANAGE), handlers.updateProfile);

// DELETE /shipping-profiles/:id — delete profile
shippingProfiles.delete("/:id", requireScope(SCOPES.DELIVERY_MANAGE), handlers.deleteProfile);

// PUT /shipping-profiles/:id/rules — replace all rules
shippingProfiles.put("/:id/rules", requireScope(SCOPES.DELIVERY_MANAGE), handlers.setProfileRules);

// ── Commune-level overrides ────────────────────────────────────────────────────

// GET /shipping-profiles/:id/rules/:wilayaId/communes — list communes with override status
shippingProfiles.get("/:id/rules/:wilayaId/communes", requireScope(SCOPES.DELIVERY_READ), handlers.listCommuneOverrides);

// PUT /shipping-profiles/:id/rules/:wilayaId/communes/:communeId — set override
shippingProfiles.put("/:id/rules/:wilayaId/communes/:communeId", requireScope(SCOPES.DELIVERY_MANAGE), handlers.setCommuneOverride);

// DELETE /shipping-profiles/:id/rules/:wilayaId/communes/:communeId — reset to wilaya default
shippingProfiles.delete("/:id/rules/:wilayaId/communes/:communeId", requireScope(SCOPES.DELIVERY_MANAGE), handlers.deleteCommuneOverride);

export default shippingProfiles;
