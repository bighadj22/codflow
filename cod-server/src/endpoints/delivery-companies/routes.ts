/**
 * Delivery Companies Routes
 *
 * CRUD endpoints for third-party delivery company management.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import * as webhookHandlers from "./webhook-handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const deliveryCompaniesRouter = new Hono<AppContext>();

// GET /delivery-companies — list all companies
deliveryCompaniesRouter.get(
  "/",
  requireScope(SCOPES.DELIVERY_READ),
  handlers.listDeliveryCompanies
);

// GET /delivery-companies/:id — get single company
deliveryCompaniesRouter.get(
  "/:id",
  requireScope(SCOPES.DELIVERY_READ),
  handlers.getDeliveryCompany
);

// GET /delivery-companies/:id/stop-desks — read from company_stop_desks DB (no live API)
// Supports ?wilayaId= and ?activeOnly= filters
deliveryCompaniesRouter.get(
  "/:id/stop-desks",
  requireScope(SCOPES.DELIVERY_READ),
  handlers.fetchCompanyStopDesks
);

// POST /delivery-companies/:id/sync-stop-desks — fetch from carrier API and upsert into DB
deliveryCompaniesRouter.post(
  "/:id/sync-stop-desks",
  requireScope(SCOPES.DELIVERY_MANAGE),
  handlers.syncCompanyStopDesks
);

// PATCH /delivery-companies/:id/stop-desks/:code/toggle — toggle admin active flag
deliveryCompaniesRouter.patch(
  "/:id/stop-desks/:code/toggle",
  requireScope(SCOPES.DELIVERY_MANAGE),
  handlers.toggleCompanyStopDesk
);

// POST /delivery-companies — create company
deliveryCompaniesRouter.post(
  "/",
  requireScope(SCOPES.DELIVERY_MANAGE),
  handlers.createDeliveryCompany
);

// PATCH /delivery-companies/:id — update company
deliveryCompaniesRouter.patch(
  "/:id",
  requireScope(SCOPES.DELIVERY_MANAGE),
  handlers.updateDeliveryCompany
);

// DELETE /delivery-companies/:id — delete company
deliveryCompaniesRouter.delete(
  "/:id",
  requireScope(SCOPES.DELIVERY_MANAGE),
  handlers.deleteDeliveryCompany
);

// ── Webhook Management ────────────────────────────────────────────────────────

// POST /delivery-companies/:id/webhook/register — register ZR Express webhook endpoint
deliveryCompaniesRouter.post(
  "/:id/webhook/register",
  requireScope(SCOPES.DELIVERY_MANAGE),
  webhookHandlers.registerZrWebhook
);

// DELETE /delivery-companies/:id/webhook/register — unregister ZR Express webhook endpoint
deliveryCompaniesRouter.delete(
  "/:id/webhook/register",
  requireScope(SCOPES.DELIVERY_MANAGE),
  webhookHandlers.unregisterZrWebhook
);

// PATCH /delivery-companies/:id/webhook/secret — save Yalidine webhook secret
deliveryCompaniesRouter.patch(
  "/:id/webhook/secret",
  requireScope(SCOPES.DELIVERY_MANAGE),
  webhookHandlers.saveYalidineSecret
);

// PATCH /delivery-companies/:id/webhook/mapping — save ZR custom state name mapping
deliveryCompaniesRouter.patch(
  "/:id/webhook/mapping",
  requireScope(SCOPES.DELIVERY_MANAGE),
  webhookHandlers.saveZrStatusMapping
);

export default deliveryCompaniesRouter;
