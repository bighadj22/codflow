import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/",      requireScope(SCOPES.OFFERS_READ),   h.listOffers);
router.get("/:id",   requireScope(SCOPES.OFFERS_READ),   h.getOffer);
router.post("/",     requireScope(SCOPES.OFFERS_MANAGE), h.createOffer);
router.patch("/:id", requireScope(SCOPES.OFFERS_MANAGE), h.updateOffer);
router.delete("/:id",requireScope(SCOPES.OFFERS_MANAGE), h.deleteOffer);

export default router;
