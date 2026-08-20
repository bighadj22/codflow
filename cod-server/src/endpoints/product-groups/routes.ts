import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/",    requireScope(SCOPES.PRODUCT_GROUPS_READ),   h.listGroups);
router.get("/:id", requireScope(SCOPES.PRODUCT_GROUPS_READ),   h.getGroup);
router.post("/",   requireScope(SCOPES.PRODUCT_GROUPS_MANAGE), h.createGroup);
router.patch("/:id", requireScope(SCOPES.PRODUCT_GROUPS_MANAGE), h.updateGroup);
router.delete("/:id", requireScope(SCOPES.PRODUCT_GROUPS_MANAGE), h.deleteGroup);

export default router;
