/**
 * Wilayas Routes
 *
 * Read-only reference data endpoints — no write operations.
 * Accessible to all authenticated users (DELIVERY_READ not required).
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";

const wilayasRouter = new Hono<AppContext>();

// GET /wilayas — list all wilayas
wilayasRouter.get("/", handlers.listWilayas);

// GET /wilayas/:id/communes — list communes for a specific wilaya
wilayasRouter.get("/:id/communes", handlers.listCommunes);

export default wilayasRouter;
