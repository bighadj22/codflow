import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";

// ─── /api/stock/* ─────────────────────────────────────────────────────────────
export const stockRouter = new Hono<AppContext>();

stockRouter.get("/overview", requireScope(SCOPES.PRODUCTS_READ),   h.getStockOverview);
stockRouter.get("/alerts",   requireScope(SCOPES.PRODUCTS_READ),   h.getStockAlerts);

// ─── /api/products/* (stock sub-routes, merged into products router) ──────────
export const productStockRouter = new Hono<AppContext>();

// Simple product stock
productStockRouter.post("/:id/stock/adjust",     requireScope(SCOPES.PRODUCTS_MANAGE), h.adjustProductStock);
productStockRouter.get("/:id/stock/history",     requireScope(SCOPES.PRODUCTS_READ),   h.getProductStockHistory);
productStockRouter.patch("/:id/stock/threshold", requireScope(SCOPES.PRODUCTS_MANAGE), h.updateProductThreshold);

// Variant stock
productStockRouter.post("/:productId/variants/:variantId/stock/adjust",
  requireScope(SCOPES.PRODUCTS_MANAGE), h.adjustVariantStock);
productStockRouter.patch("/:productId/variants/:variantId/stock/threshold",
  requireScope(SCOPES.PRODUCTS_MANAGE), h.updateVariantThreshold);
