/**
 * Webhook Routes
 *
 * Public router — NO auth middleware anywhere in this file.
 * Authentication is handled internally by each handler via signature verification.
 *
 * Mount order in index.ts:
 *   app.route("/webhooks", webhooksRouter)  ← BEFORE app.use("/api/*", authMiddleware)
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import {
  handleYalidineChallenge,
  handleYalidineWebhook,
  handleZrWebhook,
} from "./handlers";

const webhooksRouter = new Hono<AppContext>();

// Yalidine CRC challenge (GET) + event delivery (POST) — same path
webhooksRouter.get("/yalidine", handleYalidineChallenge);
webhooksRouter.post("/yalidine", handleYalidineWebhook);

// ZR Express event delivery (POST)
webhooksRouter.post("/zr_express", handleZrWebhook);

export default webhooksRouter;
