/**
 * Delivery Companies Routes
 *
 * CRUD endpoints for third-party delivery company management.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import * as webhookHandlers from "./webhook-handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import {
  DeliveryCompanySchema,
  StopDeskSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const deliveryCompaniesRouter = new OpenAPIHono<AppContext>();

// ── Route Definitions ─────────────────────────────────────────────────────────

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "List delivery companies",
  description: "List all delivery companies with optional filters",
  request: {
    query: z.object({
      active: z.enum(["true", "false"]).optional().openapi({
        description: "Filter by active status",
        example: "true",
      }),
      search: z.string().optional().openapi({
        description: "Search in company name (EN/AR) and code",
      }),
      limit: z.coerce.number().int().positive().max(100).default(50).openapi({
        description: "Maximum number of results",
        example: 50,
      }),
      offset: z.coerce.number().int().min(0).default(0).openapi({
        description: "Pagination offset",
        example: 0,
      }),
    }),
  },
  responses: {
    200: {
      description: "List of delivery companies",
      content: jsonContent(ListResponseSchema(DeliveryCompanySchema)),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const getRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "Get delivery company",
  description: "Get a single delivery company by ID",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
  },
  responses: {
    200: {
      description: "Delivery company details",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const createRoute_definition = createRoute({
  method: "post",
  path: "/",
  summary: "Create delivery company",
  description: "Create a new delivery company integration",
  request: {
    body: {
      content: jsonContent(
        z.object({
          name: z.string().min(1).openapi({ example: "Yalidine" }),
          nameAr: z.string().min(1).openapi({ example: "ياليدين" }),
          code: z
            .string()
            .min(1)
            .regex(/^[a-z0-9_]+$/)
            .openapi({ example: "yalidine", description: "Lowercase alphanumeric with underscores" }),
          website: z.string().url().optional().nullable().openapi({ example: "https://www.yalidine.com" }),
          active: z.boolean().default(true).openapi({ example: true }),
          apiEndpoint: z.string().url().optional().nullable().openapi({ example: "https://api.yalidine.app/v1" }),
          apiToken: z.string().optional().nullable().openapi({ description: "API authentication token" }),
          apiUserGuid: z.string().optional().nullable().openapi({ description: "Tenant/user GUID for ZR Express" }),
          supportsHomeDelivery: z.boolean().default(true),
          supportsStopDesk: z.boolean().default(true),
          supportsTracking: z.boolean().default(false),
          autoValidate: z.boolean().optional().openapi({
            description:
              "When true, orders are auto-validated on dispatch (locked at carrier). " +
              "When false, orders stay editable. If omitted, a safe default is derived per provider.",
          }),
          notes: z.string().optional().nullable(),
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Delivery company created",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
    400: { description: "Validation error", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    409: { description: "Duplicate company code", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  summary: "Update delivery company",
  description: "Update an existing delivery company",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
    body: {
      content: jsonContent(
        z.object({
          name: z.string().min(1).optional(),
          nameAr: z.string().min(1).optional(),
          code: z
            .string()
            .min(1)
            .regex(/^[a-z0-9_]+$/)
            .optional(),
          website: z.string().url().optional().nullable(),
          active: z.boolean().optional(),
          apiEndpoint: z.string().url().optional().nullable(),
          apiToken: z.string().optional().nullable(),
          apiUserGuid: z.string().optional().nullable(),
          supportsHomeDelivery: z.boolean().optional(),
          supportsStopDesk: z.boolean().optional(),
          supportsTracking: z.boolean().optional(),
          autoValidate: z.boolean().optional(),
          notes: z.string().optional().nullable(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Delivery company updated",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
    400: { description: "Validation error", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
    409: { description: "Duplicate company code", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "Delete delivery company",
  description: "Delete a delivery company",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
  },
  responses: {
    200: {
      description: "Delivery company deleted",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const getStopDesksRoute = createRoute({
  method: "get",
  path: "/{id}/stop-desks",
  summary: "Get company stop desks",
  description: "Read stop desks from DB (no live API call). Admin must sync first via POST .../sync-stop-desks",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
    query: z.object({
      wilayaId: z.coerce.number().int().optional().openapi({
        description: "Filter by wilaya ID",
        example: 16,
      }),
      activeOnly: z.enum(["true", "false"]).default("true").openapi({
        description: "Filter by active flag (default true)",
        example: "true",
      }),
    }),
  },
  responses: {
    200: {
      description: "Stop desks list",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.object({
            stopDesks: z.array(StopDeskSchema),
            total: z.number().int(),
            company: z.object({
              id: z.string(),
              name: z.string(),
              code: z.string(),
            }),
          }),
        })
      ),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const syncStopDesksRoute = createRoute({
  method: "post",
  path: "/{id}/sync-stop-desks",
  summary: "Sync stop desks",
  description: "Fetch stop desks from carrier API and upsert into DB. Active flag is preserved.",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
  },
  responses: {
    200: {
      description: "Stop desks synced",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.object({
            total: z.number().int().openapi({ description: "Total desks upserted", example: 1359 }),
            removed: z.number().int().openapi({ description: "Stale desks removed", example: 3 }),
            syncedAt: z.string().datetime(),
          }),
        })
      ),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
    422: {
      description: "Company not connected or provider does not support stop desks",
      content: jsonContent(ErrorResponseSchema),
    },
    502: { description: "External API failure", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const toggleStopDeskRoute = createRoute({
  method: "patch",
  path: "/{id}/stop-desks/{code}/toggle",
  summary: "Toggle stop desk active flag",
  description: "Toggle the active flag on a single stop desk. Admin can deactivate stop desks that can't be serviced.",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
      code: z.string().openapi({ description: "Stop desk code", example: "16A" }),
    }),
  },
  responses: {
    200: {
      description: "Stop desk toggled",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.object({
            code: z.string(),
            active: z.boolean(),
          }),
        })
      ),
    },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Stop desk not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const registerWebhookRoute = createRoute({
  method: "post",
  path: "/{id}/webhook/register",
  summary: "Register ZR Express webhook",
  description: "Registers a webhook endpoint with ZR Express via their API. Stores the endpointId and signing secret.",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
  },
  responses: {
    200: {
      description: "Webhook registered",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          webhookUrl: z.string().url().openapi({ example: "https://your-worker.workers.dev/webhooks/zr_express" }),
          endpointId: z.string().openapi({ example: "ep_1234567890" }),
        })
      ),
    },
    400: { description: "Invalid configuration or ZR API error", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const unregisterWebhookRoute = createRoute({
  method: "delete",
  path: "/{id}/webhook/register",
  summary: "Unregister ZR Express webhook",
  description: "Deletes the registered webhook endpoint from ZR Express and clears the DB fields.",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
  },
  responses: {
    200: {
      description: "Webhook unregistered",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
    400: { description: "Invalid configuration or ZR API error", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found or no webhook registered", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const saveYalidineSecretRoute = createRoute({
  method: "patch",
  path: "/{id}/webhook/secret",
  summary: "Save Yalidine webhook secret",
  description: "Stores the Yalidine webhook secret key (entered manually after setting up webhook in Yalidine dashboard).",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
    body: {
      content: jsonContent(
        z.object({
          secret: z.string().min(1).openapi({ description: "Webhook secret key from Yalidine dashboard" }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Secret saved",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
    400: { description: "Invalid request or wrong company type", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

const saveZrMappingRoute = createRoute({
  method: "patch",
  path: "/{id}/webhook/mapping",
  summary: "Save ZR status mapping",
  description: "Saves the custom ZR state name → our status mapping for this company.",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
    }),
    body: {
      content: jsonContent(
        z.object({
          mapping: z.record(z.string(), z.array(z.string())).openapi({
            description:
              "Keys must be valid our-status strings (new, preparing, assigned, out_for_delivery, delivered, returned, cancelled). " +
              "Values are arrays of ZR state names.",
            example: {
              delivered: ["Livré", "Delivered"],
              returned: ["Retourné", "Returned"],
            },
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Mapping saved",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
    400: { description: "Invalid mapping or wrong company type", content: jsonContent(ErrorResponseSchema) },
    401: { description: "Not authenticated", content: jsonContent(ErrorResponseSchema) },
    403: { description: "Insufficient permissions", content: jsonContent(ErrorResponseSchema) },
    404: { description: "Company not found", content: jsonContent(ErrorResponseSchema) },
  },
  security: [{ ApiKeyAuth: [] }],
});

// ── Route Registrations ───────────────────────────────────────────────────────

// Apply RBAC middleware to all routes
deliveryCompaniesRouter.use("/", requireScope(SCOPES.DELIVERY_READ));
deliveryCompaniesRouter.use("/:id", requireScope(SCOPES.DELIVERY_READ));
deliveryCompaniesRouter.use("/:id/stop-desks", requireScope(SCOPES.DELIVERY_READ));
deliveryCompaniesRouter.use("/:id/sync-stop-desks", requireScope(SCOPES.DELIVERY_MANAGE));
deliveryCompaniesRouter.use("/:id/stop-desks/:code/toggle", requireScope(SCOPES.DELIVERY_MANAGE));
deliveryCompaniesRouter.use("/:id/webhook/register", requireScope(SCOPES.DELIVERY_MANAGE));
deliveryCompaniesRouter.use("/:id/webhook/secret", requireScope(SCOPES.DELIVERY_MANAGE));
deliveryCompaniesRouter.use("/:id/webhook/mapping", requireScope(SCOPES.DELIVERY_MANAGE));

// GET /delivery-companies — list all companies
deliveryCompaniesRouter.openapi(listRoute, handlers.listDeliveryCompanies);

// GET /delivery-companies/:id — get single company
deliveryCompaniesRouter.openapi(getRoute, handlers.getDeliveryCompany);

// GET /delivery-companies/:id/stop-desks — read from company_stop_desks DB (no live API)
deliveryCompaniesRouter.openapi(getStopDesksRoute, handlers.fetchCompanyStopDesks);

// POST /delivery-companies/:id/sync-stop-desks — fetch from carrier API and upsert into DB
deliveryCompaniesRouter.openapi(syncStopDesksRoute, handlers.syncCompanyStopDesks);

// PATCH /delivery-companies/:id/stop-desks/:code/toggle — toggle admin active flag
deliveryCompaniesRouter.openapi(toggleStopDeskRoute, handlers.toggleCompanyStopDesk);

// POST /delivery-companies — create company
deliveryCompaniesRouter.openapi(createRoute_definition, handlers.createDeliveryCompany);

// PATCH /delivery-companies/:id — update company
deliveryCompaniesRouter.openapi(updateRoute, handlers.updateDeliveryCompany);

// DELETE /delivery-companies/:id — delete company
deliveryCompaniesRouter.openapi(deleteRoute, handlers.deleteDeliveryCompany);

// ── Webhook Management ────────────────────────────────────────────────────────

// POST /delivery-companies/:id/webhook/register — register ZR Express webhook endpoint
deliveryCompaniesRouter.openapi(registerWebhookRoute, webhookHandlers.registerZrWebhook);

// DELETE /delivery-companies/:id/webhook/register — unregister ZR Express webhook endpoint
deliveryCompaniesRouter.openapi(unregisterWebhookRoute, webhookHandlers.unregisterZrWebhook);

// PATCH /delivery-companies/:id/webhook/secret — save Yalidine webhook secret
deliveryCompaniesRouter.openapi(saveYalidineSecretRoute, webhookHandlers.saveYalidineSecret);

// PATCH /delivery-companies/:id/webhook/mapping — save ZR custom state name mapping
deliveryCompaniesRouter.openapi(saveZrMappingRoute, webhookHandlers.saveZrStatusMapping);

export default deliveryCompaniesRouter;
