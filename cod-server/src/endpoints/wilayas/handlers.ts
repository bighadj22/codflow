/**
 * Wilayas Route Handlers
 *
 * Read-only endpoints for Algeria reference data (wilayas and communes).
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import * as queries from "./queries";
import * as validation from "./validation";

/**
 * GET /wilayas
 * List all 58 Algerian wilayas with optional search.
 */
export async function listWilayas(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const filters = validation.wilayaFiltersSchema.parse({
    search: c.req.query("search"),
  });
  const data = await queries.getAllWilayas(db, filters);
  return c.json({ success: true, data, count: data.length }, 200);
}

/**
 * GET /wilayas/:id/communes
 * List all communes for a given wilaya.
 */
export async function listCommunes(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const wilayaId = parseInt(c.req.param("id")!, 10);

  if (isNaN(wilayaId) || wilayaId < 1 || wilayaId > 58) {
    throw new ValidationError(
      "Invalid wilaya ID — must be an integer between 1 and 58",
      ERROR_CODES.INVALID_FORMAT,
      { wilayaId: c.req.param("id") }
    );
  }

  const wilaya = await queries.getWilayaById(db, wilayaId);
  if (!wilaya) {
    throw new NotFoundError("Wilaya", wilayaId.toString());
  }

  const data = await queries.getCommunesByWilaya(db, wilayaId);
  return c.json({ success: true, data, count: data.length }, 200);
}
