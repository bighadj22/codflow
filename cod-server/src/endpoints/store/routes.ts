import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as h from "./handlers";

const router = new Hono<AppContext>();

router.get("/config", h.getStoreConfig);
router.get("/products", h.listStoreProducts);
router.get("/products/:handle", h.getStoreProduct);
router.get("/categories", h.listStoreCategories);
router.get("/shipping-rates", h.getShippingRates);
router.get("/communes/:wilayaId", h.listStoreCommunes);
router.post("/orders", h.createStoreOrder);
router.get("/reviews", h.listProductReviews);
router.post("/reviews", h.submitReview);

export default router;
