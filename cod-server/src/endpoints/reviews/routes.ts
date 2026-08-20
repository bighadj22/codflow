import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/",     requireScope(SCOPES.REVIEWS_READ),   h.listReviews);
router.patch("/:id", requireScope(SCOPES.REVIEWS_MANAGE), h.updateReview);
router.delete("/:id", requireScope(SCOPES.REVIEWS_MANAGE), h.deleteReview);

export default router;
