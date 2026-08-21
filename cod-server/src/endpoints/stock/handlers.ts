import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as q from "./queries";
import * as v from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, BusinessLogicError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

function jsonBody(c: Context<AppContext>): any {
  return (c.req as any).valid?.("json");
}

// ─── Adjust Stock ─────────────────────────────────────────────────────────────

/** POST /api/products/{id}/stock/adjust — simple product */
export async function adjustProductStock(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const actor = c.get("user");
  const body = jsonBody(c) ?? v.adjustStockSchema.parse(await c.req.json());

  const result = await q.adjustStock(db, {
    productId,
    variantId: null,
    createdBy: actor.id,
    createdByName: actor.name ?? "Unknown",
    ...body,
  });

  const productRow = await db.select({ name: products.name }).from(products).where(eq(products.id, productId)).get();
  await logActivity(db, actor, ACTIONS.STOCK_ADJUSTED, {
    type: "stock",
    id: productId,
    label: productRow?.name ?? null,
  }, { stockType: body.type, delta: body.delta, reason: body.reason ?? null });

  return c.json({ success: true, data: result }, 200);
}

/** POST /api/products/{productId}/variants/{variantId}/stock/adjust — variant */
export async function adjustVariantStock(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  const variantId = c.req.param("variantId")!;
  const actor = c.get("user");
  const body = jsonBody(c) ?? v.adjustStockSchema.parse(await c.req.json());

  const result = await q.adjustStock(db, {
    productId,
    variantId,
    createdBy: actor.id,
    createdByName: actor.name ?? "Unknown",
    ...body,
  });

  const productRow = await db.select({ name: products.name }).from(products).where(eq(products.id, productId)).get();
  await logActivity(db, actor, ACTIONS.STOCK_ADJUSTED, {
    type: "stock",
    id: productId,
    label: productRow?.name ?? null,
  }, { variantId, stockType: body.type, delta: body.delta, reason: body.reason ?? null });

  return c.json({ success: true, data: result }, 200);
}

// ─── Stock History ────────────────────────────────────────────────────────────

/** GET /api/products/{id}/stock/history */
export async function getProductStockHistory(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const queryData: any = (c.req as any).valid?.("query");
  const filters = queryData ?? v.stockHistoryFiltersSchema.parse({
    variantId: c.req.query("variantId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const data = await q.getStockHistory(db, productId, filters);
  return c.json({ success: true, data }, 200);
}

// ─── Stock Overview ───────────────────────────────────────────────────────────

/** GET /api/stock/overview */
export async function getStockOverview(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await q.getStockOverview(db);
  return c.json({ success: true, data }, 200);
}

// ─── Stock Alerts ─────────────────────────────────────────────────────────────

/** GET /api/stock/alerts */
export async function getStockAlerts(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const queryData: any = (c.req as any).valid?.("query");
  const filters = queryData ?? v.stockAlertsFiltersSchema.parse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const data = await q.getStockAlerts(db, filters);
  return c.json({ success: true, data }, 200);
}

// ─── Update Threshold ─────────────────────────────────────────────────────────

/** PATCH /api/products/{id}/stock/threshold */
export async function updateProductThreshold(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const body = jsonBody(c) ?? v.updateThresholdSchema.parse(await c.req.json());
  const updated = await q.updateProductThreshold(db, productId, body);

  if (!updated) {
    throw new NotFoundError("Product", productId);
  }

  return c.json({ success: true }, 200);
}

/** PATCH /api/products/{productId}/variants/{variantId}/stock/threshold */
export async function updateVariantThreshold(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  const variantId = c.req.param("variantId")!;
  const body = jsonBody(c) ?? v.updateThresholdSchema.parse(await c.req.json());
  const updated = await q.updateVariantThreshold(db, variantId, productId, body);

  if (!updated) {
    throw new NotFoundError("Variant", variantId);
  }

  return c.json({ success: true }, 200);
}
