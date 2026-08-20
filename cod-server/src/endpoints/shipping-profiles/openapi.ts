/**
 * Shipping Profiles OpenAPI Paths
 *
 * Covers profile CRUD, bulk wilaya-rule replacement, commune-level overrides,
 * and the default-profile auto-fill endpoint. Profiles are referenced only by
 * products (products.shippingProfileId); drivers and delivery companies do NOT
 * link to shipping profiles — they have their own compensation data.
 */

const profileSchema = { $ref: "#/components/schemas/ShippingProfile" };
const ruleSchema = { $ref: "#/components/schemas/ShippingRule" };
const errorResponseSchema = { $ref: "#/components/schemas/ErrorResponse" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// ─── Reusable error payload skeletons ────────────────────────────────────────

const profileNotFoundResponse = {
  description: "Shipping profile not found",
  content: json({
    type: "object",
    properties: {
      error: { type: "string", example: "shipping_profile with ID profile_123 not found" },
      code: { type: "string", example: "SHIPPING_PROFILE_NOT_FOUND" },
      category: { type: "string", example: "BUSINESS_LOGIC" },
      context: {
        type: "object",
        properties: {
          entity: { type: "string", example: "shipping_profile" },
          id: { type: "string", example: "profile_123" },
        },
      },
    },
  }),
};

const ruleNotFoundResponse = {
  description: "No rule configured for this wilaya in this profile — configure one first via PUT /:id/rules.",
  content: json({
    type: "object",
    properties: {
      error: { type: "string", example: "shipping_rule with ID profile=profile_123 wilaya=16 not found" },
      code: { type: "string", example: "SHIPPING_RULE_NOT_FOUND" },
      category: { type: "string", example: "BUSINESS_LOGIC" },
    },
  }),
};

// ─── Commune-override schemas ────────────────────────────────────────────────

const communeOverrideResponseSchema = {
  type: "object",
  description:
    "A commune within a wilaya rule, showing both the raw override fields (null = inherited) and the effective values used at fee-resolution time.",
  properties: {
    communeId: { type: "string" },
    communeName: { type: "string", example: "Bab Ezzouar" },
    communeNameAr: { type: "string", example: "باب الزوار" },
    postalCode: { type: "string", nullable: true },
    homeEnabled: { type: "boolean", nullable: true, description: "null = inherited from wilaya rule" },
    stopDeskEnabled: { type: "boolean", nullable: true, description: "null = inherited from wilaya rule" },
    homePrice: { type: "number", nullable: true, description: "null = inherited from wilaya rule" },
    stopDeskPrice: { type: "number", nullable: true, description: "null = inherited from wilaya rule" },
    effectiveHomeEnabled: { type: "boolean" },
    effectiveStopDeskEnabled: { type: "boolean" },
    effectiveHomePrice: { type: "number" },
    effectiveStopDeskPrice: { type: "number" },
    hasOverride: { type: "boolean" },
  },
} as const;

const communeOverrideBodySchema = {
  type: "object",
  description:
    "Override fields for a single commune. Any field set to `null` (or omitted) inherits from the wilaya rule. If ALL four fields are null, the override row is deleted.",
  properties: {
    homeEnabled: { type: "boolean", nullable: true },
    stopDeskEnabled: { type: "boolean", nullable: true },
    homePrice: { type: "number", minimum: 0, nullable: true },
    stopDeskPrice: { type: "number", minimum: 0, nullable: true },
  },
} as const;

// ─── Paths ────────────────────────────────────────────────────────────────────

export const shippingProfilePaths = {
  "/api/shipping-profiles": {
    get: {
      tags: ["Shipping Profiles"],
      summary: "List shipping profiles",
      description:
        "Returns all shipping rate profiles with `ruleCount` (number of wilaya rules) and `productCount` (how many products override the store default with this profile).",
      operationId: "listShippingProfiles",
      responses: {
        "200": {
          description: "List of shipping profiles",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: profileSchema },
              count: { type: "integer" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Shipping Profiles"],
      summary: "Create shipping profile",
      description:
        "Creates a profile (rate-card metadata only). Use `PUT /:id/rules` afterwards to populate wilaya rates. Setting `isDefault: true` atomically unsets the current default profile.",
      operationId: "createShippingProfile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string", example: "Standard Rates" },
                isDefault: { type: "boolean", default: false },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Profile created",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: profileSchema,
            },
          }),
        },
        "400": { description: "Validation error — missing/empty name", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/shipping-profiles/default/rules": {
    get: {
      tags: ["Shipping Profiles"],
      summary: "Get default-profile rules",
      description:
        "Returns the wilaya rules of the currently-active default profile. Used by the order form to auto-fill `deliveryFee`. Returns an empty array if no profile is marked default.",
      operationId: "getDefaultRules",
      responses: {
        "200": {
          description: "Default profile rules (empty array if no default configured)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: ruleSchema },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorResponseSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/shipping-profiles/{id}": {
    get: {
      tags: ["Shipping Profiles"],
      summary: "Get shipping profile",
      description:
        "Returns a single profile with its full list of wilaya rules (including `homeEnabled` / `stopDeskEnabled`).",
      operationId: "getShippingProfile",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Profile with rules",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                allOf: [
                  profileSchema,
                  {
                    type: "object",
                    properties: {
                      rules: { type: "array", items: ruleSchema },
                    },
                  },
                ],
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorResponseSchema) },
        "404": profileNotFoundResponse,
      },
      security: [{ ApiKeyAuth: [] }],
    },

    patch: {
      tags: ["Shipping Profiles"],
      summary: "Update shipping profile",
      description: `Partial update of profile metadata. Include only the fields you want to change. Set \`notes\` to \`null\` to clear it.

**Default invariant:** the system always keeps exactly one profile marked \`isDefault\`. Setting \`isDefault: true\` here atomically unsets the current default. Setting \`isDefault: false\` on the **only** default profile is rejected with \`422 DEFAULT_PROFILE_REQUIRED\`.`,
      operationId: "updateShippingProfile",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                isDefault: { type: "boolean" },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Profile updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: profileSchema,
            },
          }),
        },
        "400": { description: "Validation error", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
        "404": profileNotFoundResponse,
        "422": {
          description: "Cannot unset the last default profile — one profile must always be default.",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot unset the last default shipping profile" },
              code: { type: "string", example: "DEFAULT_PROFILE_REQUIRED" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  profileId: { type: "string" },
                  profileName: { type: "string" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },

    delete: {
      tags: ["Shipping Profiles"],
      summary: "Delete shipping profile",
      description: `Permanently deletes a profile and all of its wilaya rules (commune overrides cascade).

**Blocked when:**
- The profile is currently referenced by one or more products → \`422 PROFILE_IN_USE\`
- The profile is the default profile → \`422 DEFAULT_PROFILE_REQUIRED\` (set another profile as default first)`,
      operationId: "deleteShippingProfile",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Profile deleted",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true } },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
        "404": profileNotFoundResponse,
        "422": {
          description: "Profile cannot be deleted. Disambiguate via `code`.",
          content: {
            "application/json": {
              schema: errorResponseSchema,
              examples: {
                inUse: {
                  summary: "Profile is still referenced by one or more products",
                  value: {
                    error: "Cannot delete shipping profile that is in use",
                    code: "PROFILE_IN_USE",
                    category: "BUSINESS_LOGIC",
                    context: {
                      profileId: "profile_123",
                      profileName: "Standard Rates",
                      productCount: 5,
                    },
                  },
                },
                defaultRequired: {
                  summary: "This is the sole default profile",
                  value: {
                    error: "Cannot delete the default shipping profile — there must always be a default",
                    code: "DEFAULT_PROFILE_REQUIRED",
                    category: "BUSINESS_LOGIC",
                    context: {
                      profileId: "profile_123",
                      profileName: "Standard Rates",
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/shipping-profiles/{id}/rules": {
    put: {
      tags: ["Shipping Profiles"],
      summary: "Replace wilaya rules",
      description: `Atomically replaces the full rules list for a profile — prior rules are deleted (commune overrides cascade) before new ones are inserted.

**Constraints:**
- Each \`wilayaId\` may appear **at most once** per profile. Duplicates are rejected with \`DUPLICATE_WILAYA_RULE\`.
- Setting both \`homeEnabled: false\` and \`stopDeskEnabled: false\` on a wilaya effectively disables delivery for that wilaya under this profile.
- Sending an empty \`rules\` array clears all rules for the profile.`,
      operationId: "setProfileRules",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["rules"],
              properties: {
                rules: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["wilayaId"],
                    properties: {
                      wilayaId: { type: "integer", minimum: 1, maximum: 58 },
                      homePrice: { type: "number", minimum: 0, default: 0 },
                      stopDeskPrice: { type: "number", minimum: 0, default: 0 },
                      homeEnabled: { type: "boolean", default: true },
                      stopDeskEnabled: { type: "boolean", default: false },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Rules replaced — returns the profile with its new rules",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                allOf: [
                  profileSchema,
                  {
                    type: "object",
                    properties: {
                      rules: { type: "array", items: ruleSchema },
                    },
                  },
                ],
              },
            },
          }),
        },
        "400": {
          description: "Validation error (including duplicate wilayaId)",
          content: {
            "application/json": {
              schema: validationErrorSchema,
              examples: {
                duplicate: {
                  summary: "Duplicate wilayaId in rules array",
                  value: {
                    error: "Each wilaya may appear at most once in the rules array",
                    code: "DUPLICATE_WILAYA_RULE",
                    category: "VALIDATION",
                    context: {
                      profileId: "profile_123",
                      duplicateWilayaIds: [16],
                    },
                  },
                },
              },
            },
          },
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
        "404": profileNotFoundResponse,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/shipping-profiles/{id}/rules/{wilayaId}/communes": {
    get: {
      tags: ["Shipping Profiles"],
      summary: "List commune overrides",
      description: `Returns every commune in a wilaya with its override status. For each commune the response includes:

- **Raw override fields** (\`homeEnabled\`, \`stopDeskEnabled\`, \`homePrice\`, \`stopDeskPrice\`) — \`null\` means that field inherits from the wilaya rule.
- **Effective values** (\`effectiveHome*\`, \`effectiveStopDesk*\`) — the actual values used during fee resolution (commune override merged onto the wilaya defaults).
- **hasOverride** — \`true\` if any override row exists for this commune.

Requires that the profile already has a rule for the given wilaya — otherwise responds \`404 SHIPPING_RULE_NOT_FOUND\`.`,
      operationId: "listCommuneOverrides",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Shipping profile ID" },
        { name: "wilayaId", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
      ],
      responses: {
        "200": {
          description: "All communes in this wilaya with override status",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: communeOverrideResponseSchema },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorResponseSchema) },
        "404": ruleNotFoundResponse,
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/shipping-profiles/{id}/rules/{wilayaId}/communes/{communeId}": {
    put: {
      tags: ["Shipping Profiles"],
      summary: "Set or update commune override",
      description: `Upserts a commune-level override on top of the wilaya rule.

**Semantics:**
- Any field set to \`null\` (or omitted — which is treated as null) **inherits** from the wilaya rule at fee-resolution time.
- If **all four** override fields (\`homeEnabled\`, \`stopDeskEnabled\`, \`homePrice\`, \`stopDeskPrice\`) are null, the override row is deleted (equivalent to \`DELETE\`).
- Prices must be ≥ 0 when provided.

**Effects on orders:** subsequent online orders with this wilaya + commune pair will use the overridden values. Disabling \`homeEnabled\` or \`stopDeskEnabled\` causes \`422 DELIVERY_NOT_AVAILABLE\` at order creation for that mode.`,
      operationId: "setCommuneOverride",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "wilayaId", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
        { name: "communeId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: { "application/json": { schema: communeOverrideBodySchema } },
      },
      responses: {
        "200": {
          description: "Override upserted (or removed if all fields null)",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true } },
          }),
        },
        "400": { description: "Validation error (e.g. negative price)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
        "404": ruleNotFoundResponse,
      },
      security: [{ ApiKeyAuth: [] }],
    },

    delete: {
      tags: ["Shipping Profiles"],
      summary: "Remove commune override",
      description:
        "Removes the commune override row — the commune will again inherit the wilaya rule. Returns `404 COMMUNE_OVERRIDE_NOT_FOUND` if no override row exists for this commune.",
      operationId: "deleteCommuneOverride",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "wilayaId", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
        { name: "communeId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Override removed — commune reverts to wilaya defaults",
          content: json({
            type: "object",
            properties: { success: { type: "boolean", example: true } },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorResponseSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorResponseSchema) },
        "404": {
          description: "No wilaya rule or no override configured for this commune",
          content: {
            "application/json": {
              schema: errorResponseSchema,
              examples: {
                noRule: ruleNotFoundResponse.content["application/json"].schema
                  ? { summary: "Profile has no rule for this wilaya", value: { error: "shipping_rule not found", code: "SHIPPING_RULE_NOT_FOUND", category: "BUSINESS_LOGIC" } }
                  : undefined,
                noOverride: {
                  summary: "Commune has no override to delete",
                  value: {
                    error: "commune_override with ID commune_123 not found",
                    code: "COMMUNE_OVERRIDE_NOT_FOUND",
                    category: "BUSINESS_LOGIC",
                  },
                },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
