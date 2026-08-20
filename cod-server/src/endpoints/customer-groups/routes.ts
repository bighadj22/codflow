import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/",                          requireScope(SCOPES.CUSTOMER_GROUPS_READ),   h.listGroups);
router.get("/:id",                       requireScope(SCOPES.CUSTOMER_GROUPS_READ),   h.getGroup);
router.post("/",                         requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE), h.createGroup);
router.patch("/:id",                     requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE), h.updateGroup);
router.delete("/:id",                    requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE), h.deleteGroup);
router.post("/:id/members",              requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE), h.addMember);
router.delete("/:id/members/:customerId", requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE), h.removeMember);

export default router;
