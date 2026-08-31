/**
 * Delivery Companies Routes
 *
 * CRUD endpoints for third-party delivery company management.
 * Built with defineRoute() — the standard route-builder pattern.
 *
 * RBAC stays on router.use() path patterns (not per-route auth) to preserve
 * the existing gating exactly — including the long-standing quirk that
 * POST / and PATCH/DELETE /:id are gated by delivery:read via the "/"
 * and "/:id" patterns rather than delivery:manage.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import * as webhookHandlers from "./webhook-handlers";
import { defineRoute } from "@/lib/route-builder";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import {
  DeliveryCompanySchema,
  StopDeskSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const deliveryCompaniesRouter = new OpenAPIHono<AppContext>();

// ─── Params & request schemas ────────────────────────────────────────────────

const idParams = z.object({
  id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
});

const listQuerySchema = z.object({
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
});

const createBodySchema = z.object({
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
});

const updateBodySchema = z.object({
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
});

const stopDesksQuerySchema = z.object({
  wilayaId: z.coerce.number().int().optional().openapi({
    description: "Filter by wilaya ID",
    example: 16,
  }),
  activeOnly: z.enum(["true", "false"]).default("true").openapi({
    description: "Filter by active flag (default true)",
    example: "true",
  }),
});

const toggleParams = z.object({
  id: z.string().openapi({ description: "Delivery company ID", example: "comp_abc123" }),
  code: z.string().openapi({ description: "Stop desk code", example: "16A" }),
});

const saveSecretBodySchema = z.object({
  secret: z.string().min(1).openapi({ description: "Webhook secret key from Yalidine dashboard" }),
});

const saveMappingBodySchema = z.object({
  mapping: z.record(z.string(), z.array(z.string())).openapi({
    description:
      "Keys must be valid our-status strings (new, preparing, assigned, out_for_delivery, delivered, returned, cancelled). " +
      "Values are arrays of ZR state names.",
    example: {
      delivered: ["Livré", "Delivered"],
      returned: ["Retourné", "Returned"],
    },
  }),
});

// ─── Route Definitions ─────────────────────────────────────────────────────────

const listRoute = defineRoute({
  method: "get",
  path: "/",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "List delivery companies",
  description: "List all delivery companies with optional filters",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of delivery companies",
      content: jsonContent(ListResponseSchema(DeliveryCompanySchema)),
    },
  },
  handler: handlers.listDeliveryCompanies,
});

const getRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Get delivery company",
  description: "Get a single delivery company by ID",
  params: idParams,
  responses: {
    200: {
      description: "Delivery company details",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
  },
  handler: handlers.getDeliveryCompany,
});

const createCompanyRoute = defineRoute({
  method: "post",
  path: "/",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Create delivery company",
  description: "Create a new delivery company integration",
  body: createBodySchema,
  responses: {
    201: {
      description: "Delivery company created",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
    409: { description: "Duplicate company code" },
  },
  handler: handlers.createDeliveryCompany,
});

const updateRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Update delivery company",
  description: "Update an existing delivery company",
  params: idParams,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Delivery company updated",
      content: jsonContent(SuccessResponseSchema(DeliveryCompanySchema)),
    },
    409: { description: "Duplicate company code" },
  },
  handler: handlers.updateDeliveryCompany,
});

const deleteRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Delete delivery company",
  description: "Delete a delivery company",
  params: idParams,
  responses: {
    200: {
      description: "Delivery company deleted",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
  },
  handler: handlers.deleteDeliveryCompany,
});

const getStopDesksRoute = defineRoute({
  method: "get",
  path: "/{id}/stop-desks",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Get company stop desks",
  description: "Read stop desks from DB (no live API call). Admin must sync first via POST .../sync-stop-desks",
  params: idParams,
  query: stopDesksQuerySchema,
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
  },
  handler: handlers.fetchCompanyStopDesks,
});

const syncStopDesksRoute = defineRoute({
  method: "post",
  path: "/{id}/sync-stop-desks",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Sync stop desks",
  description: "Fetch stop desks from carrier API and upsert into DB. Active flag is preserved.",
  params: idParams,
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
    422: { description: "Company not connected or provider does not support stop desks" },
    502: { description: "External API failure" },
  },
  handler: handlers.syncCompanyStopDesks,
});

const toggleStopDeskRoute = defineRoute({
  method: "patch",
  path: "/{id}/stop-desks/{code}/toggle",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Toggle stop desk active flag",
  description: "Toggle the active flag on a single stop desk. Admin can deactivate stop desks that can't be serviced.",
  params: toggleParams,
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
  },
  handler: handlers.toggleCompanyStopDesk,
});

const registerWebhookRoute = defineRoute({
  method: "post",
  path: "/{id}/webhook/register",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Register ZR Express webhook",
  description: "Registers a webhook endpoint with ZR Express via their API. Stores the endpointId and signing secret.",
  params: idParams,
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
  },
  handler: webhookHandlers.registerZrWebhook,
});

const unregisterWebhookRoute = defineRoute({
  method: "delete",
  path: "/{id}/webhook/register",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Unregister ZR Express webhook",
  description: "Deletes the registered webhook endpoint from ZR Express and clears the DB fields.",
  params: idParams,
  responses: {
    200: {
      description: "Webhook unregistered",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
  },
  handler: webhookHandlers.unregisterZrWebhook,
});

const saveYalidineSecretRoute = defineRoute({
  method: "patch",
  path: "/{id}/webhook/secret",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Save Yalidine webhook secret",
  description: "Stores the Yalidine webhook secret key (entered manually after setting up webhook in Yalidine dashboard).",
  params: idParams,
  body: saveSecretBodySchema,
  responses: {
    200: {
      description: "Secret saved",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
  },
  handler: webhookHandlers.saveYalidineSecret,
});

const saveZrMappingRoute = defineRoute({
  method: "patch",
  path: "/{id}/webhook/mapping",
  auth: "api-key",
  tags: ["Delivery Companies"],
  summary: "Save ZR status mapping",
  description: "Saves the custom ZR state name → our status mapping for this company.",
  params: idParams,
  body: saveMappingBodySchema,
  responses: {
    200: {
      description: "Mapping saved",
      content: jsonContent(z.object({ success: z.boolean() })),
    },
  },
  handler: webhookHandlers.saveZrStatusMapping,
});

// ─── Route Registrations ───────────────────────────────────────────────────────

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
deliveryCompaniesRouter.openapi(listRoute.route, listRoute.handler);

// GET /delivery-companies/:id — get single company
deliveryCompaniesRouter.openapi(getRoute.route, getRoute.handler);

// GET /delivery-companies/:id/stop-desks — read from company_stop_desks DB (no live API)
deliveryCompaniesRouter.openapi(getStopDesksRoute.route, getStopDesksRoute.handler);

// POST /delivery-companies/:id/sync-stop-desks — fetch from carrier API and upsert into DB
deliveryCompaniesRouter.openapi(syncStopDesksRoute.route, syncStopDesksRoute.handler);

// PATCH /delivery-companies/:id/stop-desks/:code/toggle — toggle admin active flag
deliveryCompaniesRouter.openapi(toggleStopDeskRoute.route, toggleStopDeskRoute.handler);

// POST /delivery-companies — create company
deliveryCompaniesRouter.openapi(createCompanyRoute.route, createCompanyRoute.handler);

// PATCH /delivery-companies/:id — update company
deliveryCompaniesRouter.openapi(updateRoute.route, updateRoute.handler);

// DELETE /delivery-companies/:id — delete company
deliveryCompaniesRouter.openapi(deleteRoute.route, deleteRoute.handler);

// ── Webhook Management ────────────────────────────────────────────────────────

// POST /delivery-companies/:id/webhook/register — register ZR Express webhook endpoint
deliveryCompaniesRouter.openapi(registerWebhookRoute.route, registerWebhookRoute.handler);

// DELETE /delivery-companies/:id/webhook/register — unregister ZR Express webhook endpoint
deliveryCompaniesRouter.openapi(unregisterWebhookRoute.route, unregisterWebhookRoute.handler);

// PATCH /delivery-companies/:id/webhook/secret — save Yalidine webhook secret
deliveryCompaniesRouter.openapi(saveYalidineSecretRoute.route, saveYalidineSecretRoute.handler);

// PATCH /delivery-companies/:id/webhook/mapping — save ZR custom state name mapping
deliveryCompaniesRouter.openapi(saveZrMappingRoute.route, saveZrMappingRoute.handler);

export default deliveryCompaniesRouter;
