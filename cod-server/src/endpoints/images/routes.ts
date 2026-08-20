import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import { presignUpload } from "./presign";

// Upload route — requires auth (goes through /api/* middleware)
const uploadRouter = new Hono<AppContext>();
uploadRouter.post("/upload", requireScope(SCOPES.PRODUCTS_MANAGE), h.uploadImage);
uploadRouter.post("/presign", requireScope(SCOPES.PRODUCTS_MANAGE), presignUpload);

// Serve route — no auth, mounted outside /api/*
const serveRouter = new Hono<AppContext>();
serveRouter.get("/:key{.+}", h.serveImage);

export { uploadRouter, serveRouter };
