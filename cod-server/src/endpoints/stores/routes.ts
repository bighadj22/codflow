import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as h from "./handlers";
import { requireScope, requireAdmin } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const router = new Hono<AppContext>();

router.get("/me",              requireAdmin(), h.getMyStore);
router.patch("/me",            requireAdmin(), h.updateMyStore);
router.get("/pixel-config",    requireAdmin(), h.getPixelConfig);
router.post("/pixel-config",   requireAdmin(), h.savePixelConfig);

export default router;
