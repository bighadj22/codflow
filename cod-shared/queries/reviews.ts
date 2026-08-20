import { eq, and, desc, sql } from "drizzle-orm";
import { reviews, products } from "../db/schema";
import type { AppDb } from "../db/client";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ReviewFilters {
  status?: ReviewStatus;
  productId?: string;
  limit: number;
  offset: number;
}

export async function getAllReviews(db: AppDb, filters: ReviewFilters) {
  const conditions: any[] = [];

  if (filters.status) conditions.push(eq(reviews.status, filters.status));
  if (filters.productId) conditions.push(eq(reviews.productId, filters.productId));

  const rows = await db
    .select({
      id: reviews.id,
      storeId: reviews.storeId,
      productId: reviews.productId,
      orderId: reviews.orderId,
      orderNumber: reviews.orderNumber,
      customerName: reviews.customerName,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      helpfulCount: reviews.helpfulCount,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      productName: products.name,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reviews.createdAt))
    .limit(filters.limit)
    .offset(filters.offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviews)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  const pendingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviews)
    .where(eq(reviews.status, "pending"))
    .get();

  return {
    rows,
    total: totalResult?.count ?? 0,
    pendingCount: pendingResult?.count ?? 0,
  };
}

export async function getReviewById(db: AppDb, id: string) {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.id, id))
    .get();
}

export async function updateReviewStatus(
  db: AppDb,
  id: string,
  status: ReviewStatus,
) {
  const now = new Date().toISOString();
  await db
    .update(reviews)
    .set({ status, updatedAt: now })
    .where(eq(reviews.id, id));
  return db.select().from(reviews).where(eq(reviews.id, id)).get();
}

export async function deleteReview(db: AppDb, id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
}
