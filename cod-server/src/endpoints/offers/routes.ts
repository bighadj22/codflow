/**
 * Offers Routes
 *
 * CRM endpoints for managing "Buy X Get Y" promotional offers. Offers are
 * auto-applied server-side when a store order meets the trigger conditions —
 * no coupon code input is required from the customer.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import { createOfferSchema, updateOfferSchema } from "./validation";
import {
  OfferSchema,
  ListResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const idParams = z.object({
  id: z.string().openapi({ description: "Offer UUID", example: "off_abc123" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listOffersRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.OFFERS_READ },
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
  },
  handler: h.listOffers,
});

const getOfferRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.OFFERS_READ },
  tags: ["Offers"],
  summary: "Get offer",
  description:
    "Get a single offer by ID with fully resolved product and variant references.",
  operationId: "getOffer",
  params: idParams,
  responses: {
    200: {
      description: "Offer details",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
  },
  handler: h.getOffer,
});

const createOfferRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.OFFERS_MANAGE },
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
  body: createOfferSchema,
  responses: {
    201: {
      description: "Offer created",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
  },
  handler: h.createOffer,
});

const updateOfferRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.OFFERS_MANAGE },
  tags: ["Offers"],
  summary: "Update offer",
  description:
    "Partially update an offer. All fields are optional — send only the fields you want to change.",
  operationId: "updateOffer",
  params: idParams,
  body: updateOfferSchema,
  responses: {
    200: {
      description: "Updated offer",
      content: jsonContent(SuccessResponseSchema(OfferSchema)),
    },
  },
  handler: h.updateOffer,
});

const deleteOfferRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.OFFERS_MANAGE },
  tags: ["Offers"],
  summary: "Delete offer",
  description: "Permanently delete an offer. Already-placed orders are not affected.",
  operationId: "deleteOffer",
  params: idParams,
  responses: {
    200: {
      description: "Offer deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: h.deleteOffer,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listOffersRoute.route, listOffersRoute.handler);
router.openapi(getOfferRoute.route, getOfferRoute.handler);
router.openapi(createOfferRoute.route, createOfferRoute.handler);
router.openapi(updateOfferRoute.route, updateOfferRoute.handler);
router.openapi(deleteOfferRoute.route, deleteOfferRoute.handler);

export default router;
