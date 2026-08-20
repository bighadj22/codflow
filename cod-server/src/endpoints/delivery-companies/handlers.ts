/**
 * Delivery Companies Route Handlers
 *
 * HTTP handlers for delivery company CRUD operations.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { companyStopDesks, wilayas } from "@/db/schema";
import * as queries from "./queries";
import * as validation from "./validation";
import { getProvider, isEcotrackCompany } from "./providers/registry";
import { NotFoundError, ValidationError, BusinessLogicError, ConflictError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/**
 * GET /delivery-companies
 * List all delivery companies with optional filters.
 */
export async function listDeliveryCompanies(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const filters = validation.deliveryCompanyFiltersSchema.parse({
    active: c.req.query("active"),
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const data = await queries.getAllDeliveryCompanies(db, filters);
  return c.json({ success: true, data, count: data.length });
}

/**
 * GET /delivery-companies/:id
 * Get a single delivery company by ID.
 */
export async function getDeliveryCompany(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const company = await queries.getDeliveryCompanyById(db, id);
  
  if (!company) {
    throw new NotFoundError("Delivery company", id);
  }
  
  return c.json({ success: true, data: company });
}

/**
 * POST /delivery-companies
 * Create a new delivery company.
 */
export async function createDeliveryCompany(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body = validation.createDeliveryCompanySchema.parse(await c.req.json());

  // Ensure code is unique
  const existing = await queries.getDeliveryCompanyByCode(db, body.code);
  if (existing) {
    throw new ConflictError(
      `A delivery company with code "${body.code}" already exists`,
      ERROR_CODES.DUPLICATE_ENTITY,
      { code: body.code, existingCompanyId: existing.id }
    );
  }

  // Derive a safe auto-validate default when the caller didn't specify one.
  // EcoTrack-family carriers (Packers, etc.) lock orders at the carrier the moment
  // validate/order is called — the team would lose the ability to edit or delete
  // post-dispatch. Default to false there and true everywhere else.
  const autoValidate = body.autoValidate ?? !isEcotrackCompany(body.code);

  const company = await queries.createDeliveryCompany(db, { ...body, autoValidate });
  console.info(`[delivery-companies] created company=${company?.id} code=${body.code} autoValidate=${autoValidate}`);
  return c.json({ success: true, data: company }, 201);
}

/**
 * PATCH /delivery-companies/:id
 * Update a delivery company.
 */
export async function updateDeliveryCompany(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const body = validation.updateDeliveryCompanySchema.parse(await c.req.json());

  // If code is being changed, verify it's not taken by another company
  if (body.code) {
    const existing = await queries.getDeliveryCompanyByCode(db, body.code);
    if (existing && existing.id !== id) {
      throw new ConflictError(
        `A delivery company with code "${body.code}" already exists`,
        ERROR_CODES.DUPLICATE_ENTITY,
        { code: body.code, existingCompanyId: existing.id }
      );
    }
  }

  const company = await queries.updateDeliveryCompany(db, id, body);
  
  if (!company) {
    throw new NotFoundError("Delivery company", id);
  }

  console.info(`[delivery-companies] updated company=${id}`);
  return c.json({ success: true, data: company });
}

/**
 * POST /delivery-companies/:id/sync-stop-desks
 * Fetch stop desks from the carrier API and upsert into company_stop_desks.
 * The `active` flag is NEVER overwritten — preserves admin's manual deactivations.
 */
export async function syncCompanyStopDesks(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const company = await queries.getDeliveryCompanyRaw(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);

  if (!company.apiToken) {
    throw new ValidationError(
      `${company.name} is not connected — add API credentials first`,
      ERROR_CODES.MISSING_API_CREDENTIALS,
      { companyId: id }
    );
  }

  let provider;
  try {
    provider = getProvider(company);
  } catch (err) {
    throw new BusinessLogicError(
      err instanceof Error ? err.message : "Provider not available",
      ERROR_CODES.PROVIDER_NOT_SUPPORTED,
      { companyId: id, code: company.code }
    );
  }

  if (typeof provider.getStopDesks !== "function") {
    throw new BusinessLogicError(
      `The ${company.code} provider does not support stop desks`,
      ERROR_CODES.OPERATION_NOT_SUPPORTED,
      { provider: company.code }
    );
  }

  try {
    const desks = await provider.getStopDesks();
    const now = new Date().toISOString();

    // ── wilayaId safety net ──────────────────────────────────────────────────
    // The companyStopDesks.wilayaId FK points at wilayas.id. Carrier APIs
    // sometimes hand back wilaya numbers we don't have (e.g. ZR pickup-point
    // territories whose `code` isn't a 1–58 wilaya, or NOEST stop-desk codes
    // that don't begin with a parseable wilaya prefix). Provider adapters now
    // return null in those cases, but defend at the boundary too — one bad
    // row would otherwise abort the whole batch with FK constraint failed.
    const validWilayaRows = await db.select({ id: wilayas.id }).from(wilayas).all();
    const validWilayas = new Set(validWilayaRows.map((r) => r.id));
    const safeWilayaId = (wid: number | null | undefined) =>
      wid != null && validWilayas.has(wid) ? wid : null;

    // ── Upsert via D1 batch ──────────────────────────────────────────────────
    // Every desk becomes one `INSERT ... ON CONFLICT DO UPDATE` statement.
    // D1's native batch() groups them into a single round-trip per chunk,
    // so a 1,359-desk Packers sync goes from ~10s → ~1s.
    //
    // Why not db.transaction()? D1 does not support Drizzle's transaction API
    // (see feedback_d1_no_transactions memory). batch() is the D1-native
    // atomic alternative and is fully supported.
    //
    // `active` is intentionally NOT in the `set` clause so admin toggles
    // survive re-syncs. On a brand-new row we default active=true; on an
    // existing row we leave the admin-chosen value alone.
    const upsertStatements = desks.map((desk) =>
      db
        .insert(companyStopDesks)
        .values({
          id: crypto.randomUUID(),
          companyId: id,
          code: desk.code,
          name: desk.name,
          commune: desk.commune ?? null,
          wilayaId: safeWilayaId(desk.wilayaId),
          address: desk.address ?? null,
          phones: desk.phones ? JSON.stringify(desk.phones) : null,
          active: true,
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: [companyStopDesks.companyId, companyStopDesks.code],
          set: {
            name: sql`excluded.name`,
            commune: sql`excluded.commune`,
            wilayaId: sql`excluded.wilaya_id`,
            address: sql`excluded.address`,
            phones: sql`excluded.phones`,
            syncedAt: sql`excluded.synced_at`,
          },
        })
    );

    const BATCH_SIZE = 50;
    for (let i = 0; i < upsertStatements.length; i += BATCH_SIZE) {
      const chunk = upsertStatements.slice(i, i + BATCH_SIZE);
      // Drizzle's batch() requires a non-empty tuple; skip the call if empty
      // (unreachable given the outer guard, but keeps TS happy).
      if (chunk.length > 0) {
        await db.batch(chunk as [typeof chunk[0], ...typeof chunk]);
      }
    }

    // ── Stale-desk cleanup ──────────────────────────────────────────────────
    // Rows whose syncedAt is older than this run's `now` correspond to desks
    // the carrier no longer lists (either the desk was removed or its
    // `has_stop_desk` flag flipped to 0). Hard-delete them: the admin's
    // `active` toggle was for a row that no longer represents a real desk.
    //
    // Edge case accepted: a transient API hiccup that omits a desk would
    // cause one false removal, re-appearing on the next sync with active=true
    // (admin toggle lost for that desk). Simpler than a soft-flag column
    // and matches the mental model "the sync list IS the source of truth".
    const removedResult = await db
      .delete(companyStopDesks)
      .where(
        and(
          eq(companyStopDesks.companyId, id),
          lt(companyStopDesks.syncedAt, now),
        ),
      )
      .returning({ code: companyStopDesks.code });

    const removedCount = removedResult.length;

    console.info(
      `[sync-stop-desks] company=${id} code=${company.code} total=${desks.length} removed=${removedCount}`,
    );
    return c.json({
      success: true,
      data: { total: desks.length, removed: removedCount, syncedAt: now },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch stop desks from provider API";
    console.error(`[sync-stop-desks] failed company=${id}:`, msg);
    throw new ExternalApiError(company.name, msg, { companyId: id, code: company.code });
  }
}

/**
 * GET /delivery-companies/:id/stop-desks
 * Read stop desks from company_stop_desks DB table.
 * Supports ?wilayaId= and ?activeOnly=true filters.
 * No live API call — admin must sync first via POST .../sync-stop-desks.
 */
export async function fetchCompanyStopDesks(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const company = await queries.getDeliveryCompanyById(db, id);
  if (!company) throw new NotFoundError("Delivery company", id);

  const wilayaIdParam = c.req.query("wilayaId");
  const activeOnly = c.req.query("activeOnly") !== "false"; // default true

  const conditions = [eq(companyStopDesks.companyId, id)];

  if (wilayaIdParam) {
    conditions.push(eq(companyStopDesks.wilayaId, parseInt(wilayaIdParam, 10)));
  }

  if (activeOnly) {
    conditions.push(eq(companyStopDesks.active, true));
  }

  const rows = await db
    .select()
    .from(companyStopDesks)
    .where(and(...conditions))
    .orderBy(companyStopDesks.name)
    .all();

  const desks = rows.map((r) => ({
    ...r,
    phones: r.phones ? JSON.parse(r.phones) as string[] : [],
  }));

  return c.json({
    success: true,
    data: {
      stopDesks: desks,
      total: desks.length,
      company: { id: company.id, name: company.name, code: company.code },
    },
  });
}

/**
 * PATCH /delivery-companies/:id/stop-desks/:code/toggle
 * Toggle the `active` flag on a single stop desk.
 * Admin can deactivate stop desks that their account can't service.
 * This toggle survives re-syncs.
 */
export async function toggleCompanyStopDesk(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const companyId = c.req.param("id")!;
  const code = c.req.param("code")!;

  const existing = await db
    .select({ id: companyStopDesks.id, active: companyStopDesks.active })
    .from(companyStopDesks)
    .where(
      and(
        eq(companyStopDesks.companyId, companyId),
        eq(companyStopDesks.code, code),
      )
    )
    .get();

  if (!existing) {
    throw new NotFoundError("Stop desk", `${companyId}/${code}`);
  }

  const newActive = !existing.active;
  await db
    .update(companyStopDesks)
    .set({ active: newActive })
    .where(eq(companyStopDesks.id, existing.id));

  return c.json({ success: true, data: { code, active: newActive } });
}

/**
 * DELETE /delivery-companies/:id
 * Delete a delivery company.
 */
export async function deleteDeliveryCompany(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getDeliveryCompanyById(db, id);
  
  if (!existing) {
    throw new NotFoundError("Delivery company", id);
  }

  try {
    await queries.deleteDeliveryCompany(db, id);
  } catch (err) {
    throw new BusinessLogicError(
      err instanceof Error ? err.message : "Cannot delete company",
      ERROR_CODES.COMPANY_INACTIVE,
      { companyId: id }
    );
  }

  console.info(`[delivery-companies] deleted company=${id}`);
  return c.json({ success: true });
}
