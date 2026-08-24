/**
 * Wilayas Routes
 *
 * Read-only reference data endpoints — no write operations.
 * Accessible to all authenticated users (no specific scope required).
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { defineRoute } from "@/lib/route-builder";
import * as handlers from "./handlers";
import { wilayaFiltersSchema } from "./validation";

// ─── Param schema ─────────────────────────────────────────────────────────────

// Mirrors the handler's parseInt-based check exactly (including its
// tolerance of inputs like "16abc") so route-level validation never
// rejects an input the handler would have accepted.
const wilayaIdParam = z.preprocess(
  (v) =>
    typeof v === "string" && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : v,
  z.number().int().min(1).max(58)
);

// Throws the same ValidationError the handler throws for bad IDs, so the
// response is produced by the global errorHandler with the exact contract
// (INVALID_FORMAT + raw wilayaId context) existing clients rely on.
function invalidWilayaIdHook(
  result: { success: boolean },
  c: Context<AppContext>
): undefined {
  if (result.success) return;
  throw new ValidationError(
    "Invalid wilaya ID — must be an integer between 1 and 58",
    ERROR_CODES.INVALID_FORMAT,
    { wilayaId: c.req.param("id") }
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const listWilayasRoute = defineRoute({
  method: "get",
  path: "/",
  auth: "api-key",
  tags: ["Wilayas"],
  summary: "List wilayas",
  description: "Get all Algerian wilayas (provinces)",
  operationId: "listWilayas",
  query: wilayaFiltersSchema,
  handler: handlers.listWilayas,
});

const listCommunesRoute = defineRoute({
  method: "get",
  path: "/{id}/communes",
  auth: "api-key",
  tags: ["Wilayas"],
  summary: "List communes",
  description: "Get all communes for a specific wilaya",
  operationId: "listCommunes",
  params: z.object({ id: wilayaIdParam }),
  validationHook: invalidWilayaIdHook,
  handler: handlers.listCommunes,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const wilayasRouter = new OpenAPIHono<AppContext>();

wilayasRouter.openapi(listWilayasRoute.route, listWilayasRoute.handler);
wilayasRouter.openapi(
  listCommunesRoute.route,
  listCommunesRoute.handler,
  listCommunesRoute.validationHook
);

export default wilayasRouter;
