import { Hono } from "hono";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import * as vh from "../variants/handlers";
import * as ih from "../images/handlers";

const router = new Hono<AppContext>();

// Products
router.get("/",       requireScope(SCOPES.PRODUCTS_READ),   h.listProducts);
router.post("/",      requireScope(SCOPES.PRODUCTS_MANAGE), h.createProduct);
router.get("/:id",    requireScope(SCOPES.PRODUCTS_READ),   h.getProduct);
router.patch("/:id",  requireScope(SCOPES.PRODUCTS_MANAGE), h.updateProduct);
router.patch("/:id/status", requireScope(SCOPES.PRODUCTS_MANAGE), h.updateProductStatus);
router.delete("/:id", requireScope(SCOPES.PRODUCTS_MANAGE), h.deleteProduct);

// Product images
router.get("/:id/images",               requireScope(SCOPES.PRODUCTS_READ),   ih.listProductImages);
router.post("/:id/images",              requireScope(SCOPES.PRODUCTS_MANAGE), ih.saveProductImage);
router.patch("/:id/images/reorder",     requireScope(SCOPES.PRODUCTS_MANAGE), ih.reorderProductImages);
router.delete("/:id/images/:imageId",   requireScope(SCOPES.PRODUCTS_MANAGE), ih.deleteProductImage);

// Variants (nested under product)
router.get("/:productId/variants",                requireScope(SCOPES.PRODUCTS_READ),   vh.listVariants);
router.post("/:productId/variants",               requireScope(SCOPES.PRODUCTS_MANAGE), vh.createVariant);
router.get("/:productId/variants/:variantId",     requireScope(SCOPES.PRODUCTS_READ),   vh.getVariant);
router.patch("/:productId/variants/:variantId",   requireScope(SCOPES.PRODUCTS_MANAGE), vh.updateVariant);
router.delete("/:productId/variants/:variantId",  requireScope(SCOPES.PRODUCTS_MANAGE), vh.deleteVariant);

export default router;
