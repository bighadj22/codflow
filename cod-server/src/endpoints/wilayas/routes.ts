/**
 * Wilayas Routes
 *
 * Read-only reference data endpoints — no write operations.
 * Accessible to all authenticated users (DELIVERY_READ not required).
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import {
  CommuneSchema,
  ErrorResponseSchema,
  ListResponseSchema,
  WilayaSchema,
} from "@/openapi/schemas";
import * as handlers from "./handlers";
import { wilayaFiltersSchema } from "./validation";

const jsonContent = (schema: z.ZodType) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

// Mirrors the handler's parseInt-based check exactly (including its
// tolerance of inputs like "16abc") so route-level validation never
// rejects an input the handler would have accepted.
const wilayaIdParam = z.preprocess(
  (v) =>
    typeof v === "string" && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : v,
  z.number().int().min(1).max(58)
);

const listWilayasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Wilayas"],
  summary: "List wilayas",
  description: "Get all Algerian wilayas (provinces)",
  operationId: "listWilayas",
  request: {
    query: wilayaFiltersSchema,
  },
  responses: {
    200: {
      description: "List of wilayas",
      content: jsonContent(ListResponseSchema(WilayaSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCommunesRoute = createRoute({
  method: "get",
  path: "/{id}/communes",
  tags: ["Wilayas"],
  summary: "List communes",
  description: "Get all communes for a specific wilaya",
  operationId: "listCommunes",
  request: {
    params: z.object({ id: wilayaIdParam }),
  },
  responses: {
    200: {
      description: "List of communes",
      content: jsonContent(ListResponseSchema(CommuneSchema)),
    },
    400: errorResponse("Invalid wilaya ID"),
    401: errorResponse("Missing or invalid API key"),
    404: errorResponse("Wilaya not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

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

const wilayasRouter = new OpenAPIHono<AppContext>();

wilayasRouter.openapi(listWilayasRoute, handlers.listWilayas);
wilayasRouter.openapi(listCommunesRoute, handlers.listCommunes, invalidWilayaIdHook);

export default wilayasRouter;
