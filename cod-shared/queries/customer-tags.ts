import { eq, and, like, sql } from "drizzle-orm";
import { customerTags, customerTagAssignments, customers } from "../db/schema";
import type { AppDb } from "../db/client";

export interface CustomerTagFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCustomerTagData {
  name: string;
  color?: string;
}

export interface UpdateCustomerTagData {
  name?: string;
  color?: string;
}

export async function getAllTags(db: AppDb, filters?: CustomerTagFilters) {
  const conditions = [];
  if (filters?.search) {
    conditions.push(like(customerTags.name, `%${filters.search}%`));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  if (conditions.length > 0) {
    return await db
      .select()
      .from(customerTags)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .all();
  }
  return await db.select().from(customerTags).limit(limit).offset(offset).all();
}

export async function getTagById(db: AppDb, tagId: string) {
  return await db
    .select()
    .from(customerTags)
    .where(eq(customerTags.id, tagId))
    .get();
}

export async function getTagWithCustomers(db: AppDb, tagId: string) {
  const tag = await getTagById(db, tagId);
  if (!tag) return null;

  const assigned = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      wilaya: customers.wilaya,
      totalOrders: customers.totalOrders,
      totalSpent: customers.totalSpent,
      assignedAt: customerTagAssignments.assignedAt,
    })
    .from(customerTagAssignments)
    .innerJoin(customers, eq(customerTagAssignments.customerId, customers.id))
    .where(eq(customerTagAssignments.tagId, tagId))
    .all();

  return { ...tag, customers: assigned };
}

export async function createTag(db: AppDb, data: CreateCustomerTagData) {
  const now = new Date().toISOString();
  const tagId = crypto.randomUUID();

  await db.insert(customerTags).values({
    id: tagId,
    name: data.name,
    color: data.color ?? "#64748b",
    assignmentCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return getTagById(db, tagId);
}

export async function updateTag(
  db: AppDb,
  tagId: string,
  data: UpdateCustomerTagData,
) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = data.color;

  await db.update(customerTags).set(updates).where(eq(customerTags.id, tagId));
  return getTagById(db, tagId);
}

export async function deleteTag(db: AppDb, tagId: string) {
  await db.delete(customerTags).where(eq(customerTags.id, tagId));
}

export async function assignTag(db: AppDb, tagId: string, customerId: string) {
  const now = new Date().toISOString();

  await db
    .insert(customerTagAssignments)
    .values({ id: crypto.randomUUID(), tagId, customerId, assignedAt: now })
    .onConflictDoNothing();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerTagAssignments)
    .where(eq(customerTagAssignments.tagId, tagId))
    .get();

  await db
    .update(customerTags)
    .set({ assignmentCount: result?.count ?? 0, updatedAt: now })
    .where(eq(customerTags.id, tagId));
}

export async function unassignTag(db: AppDb, tagId: string, customerId: string) {
  await db
    .delete(customerTagAssignments)
    .where(
      and(
        eq(customerTagAssignments.tagId, tagId),
        eq(customerTagAssignments.customerId, customerId),
      ),
    );

  const now = new Date().toISOString();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerTagAssignments)
    .where(eq(customerTagAssignments.tagId, tagId))
    .get();

  await db
    .update(customerTags)
    .set({ assignmentCount: result?.count ?? 0, updatedAt: now })
    .where(eq(customerTags.id, tagId));
}
