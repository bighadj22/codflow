/**
 * Shipping Profiles Routes
 *
 * Profile CRUD, bulk wilaya-rule replacement, commune-level overrides, and
 * the default-profile auto-fill endpoint. All routes require an API key with
 * the appropriate delivery scope.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import {
  ShippingProfileSchema,
  ShippingProfileWithRulesSchema,
  ShippingRuleSchema,
  CommuneOverrideSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Shipping profile ID", example: "profile_123" }),
});

const ruleParams = z.object({
  ...idParams.shape,
  wilayaId: z.coerce.number().int().min(1).max(58).openapi({
    description: "Wilaya ID (1–58)",
    example: 16,
  }),
});

const communeParams = z.object({
  ...ruleParams.shape,
  communeId: z.string().openapi({ description: "Commune ID", example: "16001" }),
});

const listProfilesRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Shipping Profiles"],
  summary: "List shipping profiles",
  description:
    "Returns all shipping rate profiles with `ruleCount` (number of wilaya rules) and `productCount` (how many products override the store default with this profile).",
  operationId: "listShippingProfiles",
  responses: {
    200: {
      description: "List of shipping profiles",
      content: jsonContent(ListResponseSchema(ShippingProfileSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createProfileRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Create shipping profile",
  description:
    "Creates a profile (rate-card metadata only). Use `PUT /{id}/rules` afterwards to populate wilaya rates. Setting `isDefault: true` atomically unsets the current default profile.",
  operationId: "createShippingProfile",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1, "Name is required").openapi({ example: "Standard Rates" }),
          isDefault: z.boolean().default(false).optional(),
          notes: z.string().nullable().optional(),
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Profile created",
      content: jsonContent(SuccessResponseSchema(ShippingProfileWithRulesSchema)),
    },
    400: errorResponse("Validation error — missing/empty name"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getDefaultRulesRoute = createRoute({
  method: "get",
  path: "/default/rules",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Shipping Profiles"],
  summary: "Get default-profile rules",
  description:
    "Returns the wilaya rules of the currently-active default profile. Used by the order form to auto-fill `deliveryFee`. Returns an empty array if no profile is marked default.",
  operationId: "getDefaultRules",
  responses: {
    200: {
      description: "Default profile rules (empty array if no default configured)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(ShippingRuleSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getProfileRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Shipping Profiles"],
  summary: "Get shipping profile",
  description:
    "Returns a single profile with its full list of wilaya rules (including `homeEnabled` / `stopDeskEnabled`).",
  operationId: "getShippingProfile",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Profile with rules",
      content: jsonContent(SuccessResponseSchema(ShippingProfileWithRulesSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
    404: errorResponse("Shipping profile not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateProfileRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Update shipping profile",
  description:
    "Partial update of profile metadata. Include only the fields you want to change. Set `notes` to `null` to clear it.\n\n" +
    "**Default invariant:** the system always keeps exactly one profile marked `isDefault`. Setting `isDefault: true` here atomically unsets the current default. Setting `isDefault: false` on the **only** default profile is rejected with `422 DEFAULT_PROFILE_REQUIRED`.",
  operationId: "updateShippingProfile",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1, "Name is required").optional(),
          isDefault: z.boolean().optional(),
          notes: z.string().nullable().optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Profile updated",
      content: jsonContent(SuccessResponseSchema(ShippingProfileWithRulesSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Shipping profile not found"),
    422: errorResponse(
      "Cannot unset the last default profile — one profile must always be default (code: DEFAULT_PROFILE_REQUIRED)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteProfileRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Delete shipping profile",
  description:
    "Permanently deletes a profile and all of its wilaya rules (commune overrides cascade).\n\n" +
    "**Blocked when:**\n" +
    "- The profile is currently referenced by one or more products → `422 PROFILE_IN_USE`\n" +
    "- The profile is the default profile → `422 DEFAULT_PROFILE_REQUIRED` (set another profile as default first)",
  operationId: "deleteShippingProfile",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Profile deleted",
      content: jsonContent(
        z.object({ success: z.boolean().openapi({ example: true }) })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Shipping profile not found"),
    422: errorResponse(
      "Profile cannot be deleted — disambiguate via `code`: PROFILE_IN_USE or DEFAULT_PROFILE_REQUIRED"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const setProfileRulesRoute = createRoute({
  method: "put",
  path: "/{id}/rules",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Replace wilaya rules",
  description:
    "Atomically replaces the full rules list for a profile — prior rules are deleted (commune overrides cascade) before new ones are inserted.\n\n" +
    "**Constraints:**\n" +
    "- Each `wilayaId` may appear **at most once** per profile. Duplicates are rejected with `DUPLICATE_WILAYA_RULE`.\n" +
    "- Setting both `homeEnabled: false` and `stopDeskEnabled: false` on a wilaya effectively disables delivery for that wilaya under this profile.\n" +
    "- Sending an empty `rules` array clears all rules for the profile.",
  operationId: "setProfileRules",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          rules: z.array(
            z.object({
              wilayaId: z.number().int().min(1).max(58),
              homePrice: z.number().min(0).default(0),
              stopDeskPrice: z.number().min(0).default(0),
              homeEnabled: z.boolean().default(true).optional(),
              stopDeskEnabled: z.boolean().default(false).optional(),
            })
          ),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Rules replaced — returns the profile with its new rules",
      content: jsonContent(SuccessResponseSchema(ShippingProfileWithRulesSchema)),
    },
    400: errorResponse(
      "Validation error, including duplicate wilayaId in rules array (code: DUPLICATE_WILAYA_RULE)"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse("Shipping profile not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCommuneOverridesRoute = createRoute({
  method: "get",
  path: "/{id}/rules/{wilayaId}/communes",
  middleware: [requireScope(SCOPES.DELIVERY_READ)],
  tags: ["Shipping Profiles"],
  summary: "List commune overrides",
  description:
    "Returns every commune in a wilaya with its override status. For each commune the response includes:\n\n" +
    "- **Raw override fields** (`homeEnabled`, `stopDeskEnabled`, `homePrice`, `stopDeskPrice`) — `null` means that field inherits from the wilaya rule.\n" +
    "- **Effective values** (`effectiveHome*`, `effectiveStopDesk*`) — the actual values used during fee resolution (commune override merged onto the wilaya defaults).\n" +
    "- **hasOverride** — `true` if any override row exists for this commune.\n\n" +
    "Requires that the profile already has a rule for the given wilaya — otherwise responds `404 SHIPPING_RULE_NOT_FOUND`.",
  operationId: "listCommuneOverrides",
  request: {
    params: ruleParams,
  },
  responses: {
    200: {
      description: "All communes in this wilaya with override status",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(CommuneOverrideSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:read scope"),
    404: errorResponse(
      "No rule configured for this wilaya in this profile — configure one first via PUT /{id}/rules (code: SHIPPING_RULE_NOT_FOUND)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const setCommuneOverrideRoute = createRoute({
  method: "put",
  path: "/{id}/rules/{wilayaId}/communes/{communeId}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Set or update commune override",
  description:
    "Upserts a commune-level override on top of the wilaya rule.\n\n" +
    "**Semantics:**\n" +
    "- Any field set to `null` (or omitted — which is treated as null) **inherits** from the wilaya rule at fee-resolution time.\n" +
    "- If **all four** override fields (`homeEnabled`, `stopDeskEnabled`, `homePrice`, `stopDeskPrice`) are null, the override row is deleted (equivalent to `DELETE`).\n" +
    "- Prices must be ≥ 0 when provided.\n\n" +
    "**Effects on orders:** subsequent online orders with this wilaya + commune pair will use the overridden values. Disabling `homeEnabled` or `stopDeskEnabled` causes `422 DELIVERY_NOT_AVAILABLE` at order creation for that mode.",
  operationId: "setCommuneOverride",
  request: {
    params: communeParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          homeEnabled: z.boolean().nullable().optional(),
          stopDeskEnabled: z.boolean().nullable().optional(),
          homePrice: z.number().min(0).nullable().optional(),
          stopDeskPrice: z.number().min(0).nullable().optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Override upserted (or removed if all fields null)",
      content: jsonContent(
        z.object({ success: z.boolean().openapi({ example: true }) })
      ),
    },
    400: errorResponse("Validation error (e.g. negative price)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse(
      "No rule configured for this wilaya in this profile (code: SHIPPING_RULE_NOT_FOUND)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteCommuneOverrideRoute = createRoute({
  method: "delete",
  path: "/{id}/rules/{wilayaId}/communes/{communeId}",
  middleware: [requireScope(SCOPES.DELIVERY_MANAGE)],
  tags: ["Shipping Profiles"],
  summary: "Remove commune override",
  description:
    "Removes the commune override row — the commune will again inherit the wilaya rule. Returns `404 COMMUNE_OVERRIDE_NOT_FOUND` if no override row exists for this commune.",
  operationId: "deleteCommuneOverride",
  request: {
    params: communeParams,
  },
  responses: {
    200: {
      description: "Override removed — commune reverts to wilaya defaults",
      content: jsonContent(
        z.object({ success: z.boolean().openapi({ example: true }) })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing delivery:manage scope"),
    404: errorResponse(
      "No wilaya rule for this profile/wilaya (SHIPPING_RULE_NOT_FOUND) or no override configured for this commune (COMMUNE_OVERRIDE_NOT_FOUND)"
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listProfilesRoute, handlers.listProfiles);
router.openapi(createProfileRoute, handlers.createProfile);
router.openapi(getDefaultRulesRoute, handlers.getDefaultRules);
router.openapi(getProfileRoute, handlers.getProfile);
router.openapi(updateProfileRoute, handlers.updateProfile);
router.openapi(deleteProfileRoute, handlers.deleteProfile);
router.openapi(setProfileRulesRoute, handlers.setProfileRules);
router.openapi(listCommuneOverridesRoute, handlers.listCommuneOverrides);
router.openapi(setCommuneOverrideRoute, handlers.setCommuneOverride);
router.openapi(deleteCommuneOverrideRoute, handlers.deleteCommuneOverride);

export default router;
