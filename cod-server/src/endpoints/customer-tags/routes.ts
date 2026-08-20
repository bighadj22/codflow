import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/",                          requireScope(SCOPES.CUSTOMER_TAGS_READ),   h.listTags);
router.get("/:id",                       requireScope(SCOPES.CUSTOMER_TAGS_READ),   h.getTag);
router.post("/",                         requireScope(SCOPES.CUSTOMER_TAGS_MANAGE), h.createTag);
router.patch("/:id",                     requireScope(SCOPES.CUSTOMER_TAGS_MANAGE), h.updateTag);
router.delete("/:id",                    requireScope(SCOPES.CUSTOMER_TAGS_MANAGE), h.deleteTag);
router.post("/:id/assignments",          requireScope(SCOPES.CUSTOMER_TAGS_MANAGE), h.assignTag);
router.delete("/:id/assignments/:customerId", requireScope(SCOPES.CUSTOMER_TAGS_MANAGE), h.unassignTag);

export default router;
