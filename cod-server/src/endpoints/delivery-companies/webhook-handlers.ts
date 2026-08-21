/**
 * Delivery Company Webhook Management Handlers
 *
 * Handles registration, unregistration, and configuration of webhooks
 * for ZR Express (programmatic) and Yalidine (manual setup).
 *
 * All handlers require delivery:manage scope (enforced in routes.ts).
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { deliveryCompanies } from "@/db/schema";
import { getDeliveryCompanyRaw } from "./queries";
import { NotFoundError, ValidationError, ExternalApiError } from "@/lib/errors/classes";

const ZR_BASE_URL = "https://api.zrexpress.app";

/** Our valid order status strings — used to validate custom mapping keys. */
const VALID_OUR_STATUSES = new Set([
  "new", "preparing", "assigned", "out_for_delivery",
  "delivered", "returned", "cancelled",
]);

// ─── ZR Express — Register ────────────────────────────────────────────────────

/**
 * POST /api/delivery-companies/:id/webhook/register
 *
 * Registers a webhook endpoint with ZR Express via their API.
 * Stores the endpointId and signing secret in the DB.
 *
 * Auth: X-Api-Key + X-Tenant (same credential as the ZR Express parcel API).
 * ZR docs show "Authorization: Bearer" in examples but the stored apiToken
 * is an API key used consistently as X-Api-Key across all ZR endpoints.
 */
export async function registerZrWebhook(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id } = (c.req as any).valid?.("param") ?? { id: c.req.param("id")! };

  const company = await getDeliveryCompanyRaw(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);
  if (company.code !== "zr_express") {
    throw new ValidationError("Webhook registration is only supported for ZR Express", "OPERATION_NOT_SUPPORTED", { companyId: id });
  }
  if (!company.apiToken) {
    throw new ValidationError("ZR Express API token not configured", "MISSING_API_CREDENTIALS", { companyId: id });
  }
  if (!company.apiUserGuid) {
    throw new ValidationError("ZR Express tenant ID (apiUserGuid) not configured", "MISSING_API_CREDENTIALS", { companyId: id });
  }

  // Build the webhook URL from the incoming request host
  const workerUrl =
    c.req.header("X-Worker-URL") ||
    `https://${c.req.header("host")}`;
  const webhookUrl = `${workerUrl}/webhooks/zr_express`;

  // Shared headers for all ZR webhook management API calls.
  // ZR Express uses X-Api-Key + X-Tenant for all API calls (same credential as parcel API).
  // The docs show "Authorization: Bearer" but the apiToken stored is an API key
  // used as X-Api-Key — consistent with the ZR Express parcel adapter.
  const zrHeaders = {
    "X-Api-Key": company.apiToken,
    "X-Tenant": company.apiUserGuid,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // If an existing endpoint is registered, delete it first (clean re-registration)
  if (company.webhookEndpointId) {
    try {
      await fetch(`${ZR_BASE_URL}/api/v1/webhooks/endpoints/${company.webhookEndpointId}`, {
        method: "DELETE",
        headers: zrHeaders,
      });
    } catch (err) {
      console.warn("[webhook][zr] Failed to delete existing endpoint:", err);
      // Continue — the old endpoint may already be gone
    }
  }

  // Register new endpoint with ZR.
  // Only "parcel.state.updated" is a documented valid eventType filter.
  // parcel.state.situation.created and parcel.isReturn.updated are received
  // automatically (all-events default) — do NOT include them in eventTypes.
  const registerRes = await fetch(`${ZR_BASE_URL}/api/v1/webhooks/endpoints`, {
    method: "POST",
    headers: zrHeaders,
    body: JSON.stringify({
      url: webhookUrl,
      description: "CodFlow — parcel status updates",
      eventTypes: ["parcel.state.updated"],
    }),
  });

  if (!registerRes.ok) {
    const errorBody = await registerRes.text().catch(() => "");
    console.error("[webhook][zr] Endpoint registration failed:", registerRes.status, errorBody);
    throw new ExternalApiError("ZR Express", `Webhook registration failed: ${errorBody}`, { companyId: id, hint: "Ensure your ZR API token has supplier admin permissions" });
  }

  const registerData = (await registerRes.json()) as { id?: string };
  const endpointId = registerData.id;
  if (!endpointId) {
    throw new ExternalApiError("ZR Express", "Did not return an endpoint ID", { companyId: id });
  }

  // Fetch the signing secret for this endpoint
  const secretRes = await fetch(
    `${ZR_BASE_URL}/api/v1/webhooks/endpoints/${endpointId}/secret`,
    { headers: zrHeaders }
  );

  if (!secretRes.ok) {
    const errorBody = await secretRes.text().catch(() => "");
    console.error("[webhook][zr] Failed to fetch endpoint secret:", secretRes.status, errorBody);
    // Store the endpointId anyway — secret can be fetched later
    await db
      .update(deliveryCompanies)
      .set({ webhookEndpointId: endpointId, updatedAt: new Date().toISOString() })
      .where(eq(deliveryCompanies.id, id));

    return c.json({
      success: true,
      webhookUrl,
      endpointId,
      warning: "Endpoint registered but secret could not be fetched — signature verification will be skipped",
    }, 200);
  }

  const secretData = (await secretRes.json()) as { secret?: string };
  const secret = secretData.secret ?? null;

  await db
    .update(deliveryCompanies)
    .set({
      webhookEndpointId: endpointId,
      webhookSecret: secret,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deliveryCompanies.id, id));

  return c.json({ success: true, webhookUrl, endpointId }, 200);
}

// ─── ZR Express — Unregister ──────────────────────────────────────────────────

/**
 * DELETE /api/delivery-companies/:id/webhook/register
 *
 * Deletes the registered webhook endpoint from ZR Express
 * and clears the endpointId + secret from the DB.
 */
export async function unregisterZrWebhook(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id } = (c.req as any).valid?.("param") ?? { id: c.req.param("id")! };

  const company = await getDeliveryCompanyRaw(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);
  if (company.code !== "zr_express") {
    throw new ValidationError("Only supported for ZR Express", "OPERATION_NOT_SUPPORTED", { companyId: id });
  }
  if (!company.webhookEndpointId) {
    throw new ValidationError("No webhook endpoint is registered for this company", "OPERATION_NOT_SUPPORTED", { companyId: id });
  }
  if (!company.apiToken) {
    throw new ValidationError("ZR Express API token not configured", "MISSING_API_CREDENTIALS", { companyId: id });
  }
  if (!company.apiUserGuid) {
    throw new ValidationError("ZR Express tenant ID (apiUserGuid) not configured", "MISSING_API_CREDENTIALS", { companyId: id });
  }

  const deleteRes = await fetch(
    `${ZR_BASE_URL}/api/v1/webhooks/endpoints/${company.webhookEndpointId}`,
    {
      method: "DELETE",
      headers: {
        "X-Api-Key": company.apiToken,
        "X-Tenant": company.apiUserGuid,
      },
    }
  );

  if (!deleteRes.ok && deleteRes.status !== 404) {
    const errorBody = await deleteRes.text().catch(() => "");
    console.error("[webhook][zr] Endpoint deletion failed:", deleteRes.status, errorBody);
    throw new ExternalApiError("ZR Express", `Failed to delete webhook endpoint: ${errorBody}`, { companyId: id });
  }

  await db
    .update(deliveryCompanies)
    .set({
      webhookEndpointId: null,
      webhookSecret: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deliveryCompanies.id, id));

  return c.json({ success: true }, 200);
}

// ─── Yalidine — Save Secret ───────────────────────────────────────────────────

/**
 * PATCH /api/delivery-companies/:id/webhook/secret
 *
 * Stores the Yalidine webhook secret key (entered manually by the admin
 * after setting up the webhook in the Yalidine dashboard).
 */
export async function saveYalidineSecret(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id } = (c.req as any).valid?.("param") ?? { id: c.req.param("id")! };

  const company = await getDeliveryCompanyRaw(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);
  if (company.code !== "yalidine") {
    throw new ValidationError("This endpoint is only for Yalidine webhook secrets", "OPERATION_NOT_SUPPORTED", { companyId: id });
  }

  let body: { secret?: string };
  try {
    body = (c.req as any).valid?.("json") ?? await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body", "VALIDATION_FAILED");
  }

  if (typeof body.secret !== "string" || body.secret.trim().length === 0) {
    throw new ValidationError("secret must be a non-empty string", "VALIDATION_FAILED");
  }

  await db
    .update(deliveryCompanies)
    .set({ webhookSecret: body.secret.trim(), updatedAt: new Date().toISOString() })
    .where(eq(deliveryCompanies.id, id));

  return c.json({ success: true }, 200);
}

// ─── ZR Express — Save Custom Mapping ────────────────────────────────────────

/**
 * PATCH /api/delivery-companies/:id/webhook/mapping
 *
 * Saves the custom ZR state name → our status mapping for this company.
 * Body: { mapping: Record<string, string[]> }
 * Keys must be valid our-status strings. Values are arrays of ZR state names.
 */
export async function saveZrStatusMapping(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id } = (c.req as any).valid?.("param") ?? { id: c.req.param("id")! };

  const company = await getDeliveryCompanyRaw(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);
  if (company.code !== "zr_express") {
    throw new ValidationError("Status mapping is only supported for ZR Express", "OPERATION_NOT_SUPPORTED", { companyId: id });
  }

  let body: { mapping?: unknown };
  try {
    body = (c.req as any).valid?.("json") ?? await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body", "VALIDATION_FAILED");
  }

  const mapping = body.mapping;
  if (typeof mapping !== "object" || mapping === null || Array.isArray(mapping)) {
    throw new ValidationError("mapping must be a non-null object", "VALIDATION_FAILED");
  }

  // Validate keys are valid our-status strings and values are string arrays
  for (const [key, value] of Object.entries(mapping as Record<string, unknown>)) {
    if (!VALID_OUR_STATUSES.has(key)) {
      throw new ValidationError(
        `Invalid status key: "${key}". Valid keys: ${[...VALID_OUR_STATUSES].join(", ")}`,
        "VALIDATION_FAILED"
      );
    }
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      throw new ValidationError(`Value for key "${key}" must be an array of strings`, "VALIDATION_FAILED");
    }
  }

  await db
    .update(deliveryCompanies)
    .set({
      webhookStatusMapping: JSON.stringify(mapping),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deliveryCompanies.id, id));

  return c.json({ success: true }, 200);
}
