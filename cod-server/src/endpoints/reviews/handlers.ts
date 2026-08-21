import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { z } from "zod";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError } from "@/lib/errors/classes";

const filtersSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  productId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const patchSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

export async function listReviews(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const query: any = (c.req as any).valid?.("query");
  const filters = query ?? filtersSchema.parse({
    status: c.req.query("status"),
    productId: c.req.query("productId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const { rows, total, pendingCount } = await queries.getAllReviews(db, filters);
  return c.json({ success: true, data: rows, count: rows.length, total, pendingCount }, 200);
}

export async function updateReview(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getReviewById(db, id);
  if (!existing) throw new NotFoundError("Review", id);

  const jsonBody: any = (c.req as any).valid?.("json");
  const data = jsonBody ?? patchSchema.parse(await c.req.json());

  const updated = await queries.updateReviewStatus(db, id, data.status);
  if (!updated) throw new NotFoundError("Review", id);

  const actor = c.get("user");
  const action = data.status === "approved" ? ACTIONS.REVIEW_APPROVED : ACTIONS.REVIEW_REJECTED;
  await logActivity(db, actor, action, {
    type: "review",
    id,
    label: existing.customerName,
  }, { rating: existing.rating, orderNumber: existing.orderNumber });

  return c.json({ success: true, data: updated }, 200);
}

export async function deleteReview(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getReviewById(db, id);
  if (!existing) throw new NotFoundError("Review", id);

  await queries.deleteReview(db, id);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.REVIEW_DELETED, {
    type: "review",
    id,
    label: existing.customerName,
  }, { rating: existing.rating, orderNumber: existing.orderNumber });

  return c.json({ success: true }, 200);
}
