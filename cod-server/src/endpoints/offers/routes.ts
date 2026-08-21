/**
 * Offers Routes
 *
 * CRM endpoints for managing "Buy X Get Y" promotional offers. Offers are
 * auto-applied server-side when a store order meets the trigger conditions —
 * no coupon code input is required from the customer.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import { createOfferSchema, updateOfferSchema } from "./validation";
import {
  OfferSchema,
  ErrorResponseSchema,
  ListResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Offer UUID", example: "off_abc123" }),
});

const listOffersRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.OFFERS_READ)],
  tags: ["Offers"],
  summary: "List offers",
  description:
    "Get all Buy X Get Y promotional offers ordered by creation date (newest first).",
  operationId: "listOffers",
  responses: {
    200: {
      description: "List of offers",
      content: jsonContent(ListResponseSchema(OfferSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires offers:read"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getOfferRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.OFFERS_READ)],
  tags: ["Offers"],
  summary: "Get offer",
  description:
    "Get a single offer by ID with fully resolved product and variant references.",
  operationId: "getOffer",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Offer details",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires offers:read"),
    404: errorResponse("Offer not found (OFFER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createOfferRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.OFFERS_MANAGE)],
  tags: ["Offers"],
  summary: "Create offer",
  description: `Create a new Buy X Get Y promotional offer.

**Auto-application rules (applied at order time, not here):**
- When a store order is submitted via \`POST /store/orders\`, the server checks for any active offer
  where \`triggerProductId\` matches, the ordered quantity ≥ \`triggerQuantity\`, and — if \`triggerVariantId\`
  is set — the ordered variantId also matches.
- If the reward item is out of stock, the offer is silently skipped (order still succeeds).
- The reward is inserted as a \`$0\` order line item; the COD total only reflects paid products + delivery.`,
  operationId: "createOffer",
  request: {
    body: {
      required: true,
      content: jsonContent(createOfferSchema),
    },
  },
  responses: {
    201: {
      description: "Offer created",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
    400: errorResponse(
      "Validation error (e.g. rewardProductId missing for 'free' discount type)"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires offers:manage"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateOfferRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.OFFERS_MANAGE)],
  tags: ["Offers"],
  summary: "Update offer",
  description:
    "Partially update an offer. All fields are optional — send only the fields you want to change.",
  operationId: "updateOffer",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(updateOfferSchema),
    },
  },
  responses: {
    200: {
      description: "Updated offer",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires offers:manage"),
    404: errorResponse("Offer not found (OFFER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteOfferRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.OFFERS_MANAGE)],
  tags: ["Offers"],
  summary: "Delete offer",
  description: "Permanently delete an offer. Already-placed orders are not affected.",
  operationId: "deleteOffer",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Offer deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires offers:manage"),
    404: errorResponse("Offer not found (OFFER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listOffersRoute, h.listOffers);
router.openapi(getOfferRoute, h.getOffer);
router.openapi(createOfferRoute, h.createOffer);
router.openapi(updateOfferRoute, h.updateOffer);
router.openapi(deleteOfferRoute, h.deleteOffer);

export default router;
