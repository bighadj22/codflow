import { eq, and, like, sql } from "drizzle-orm";
import { customerGroups, customerGroupMembers, customers } from "../db/schema";
import type { AppDb } from "../db/client";

export interface CustomerGroupFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCustomerGroupData {
  name: string;
  description?: string | null;
  color?: string;
}

export interface UpdateCustomerGroupData {
  name?: string;
  description?: string | null;
  color?: string;
}

export async function getAllGroups(db: AppDb, filters?: CustomerGroupFilters) {
  const conditions = [];
  if (filters?.search) {
    conditions.push(like(customerGroups.name, `%${filters.search}%`));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  if (conditions.length > 0) {
    return await db
      .select()
      .from(customerGroups)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .all();
  }
  return await db.select().from(customerGroups).limit(limit).offset(offset).all();
}

export async function getGroupById(db: AppDb, groupId: string) {
  return await db
    .select()
    .from(customerGroups)
    .where(eq(customerGroups.id, groupId))
    .get();
}

export async function getGroupWithMembers(db: AppDb, groupId: string) {
  const group = await getGroupById(db, groupId);
  if (!group) return null;

  const members = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      wilaya: customers.wilaya,
      totalOrders: customers.totalOrders,
      totalSpent: customers.totalSpent,
      assignedAt: customerGroupMembers.assignedAt,
    })
    .from(customerGroupMembers)
    .innerJoin(customers, eq(customerGroupMembers.customerId, customers.id))
    .where(eq(customerGroupMembers.groupId, groupId))
    .all();

  return { ...group, members };
}

export async function createGroup(db: AppDb, data: CreateCustomerGroupData) {
  const now = new Date().toISOString();
  const groupId = crypto.randomUUID();

  await db.insert(customerGroups).values({
    id: groupId,
    name: data.name,
    description: data.description ?? null,
    color: data.color ?? "#6366f1",
    memberCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return getGroupById(db, groupId);
}

export async function updateGroup(
  db: AppDb,
  groupId: string,
  data: UpdateCustomerGroupData,
) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.color !== undefined) updates.color = data.color;

  await db.update(customerGroups).set(updates).where(eq(customerGroups.id, groupId));
  return getGroupById(db, groupId);
}

export async function deleteGroup(db: AppDb, groupId: string) {
  await db.delete(customerGroups).where(eq(customerGroups.id, groupId));
}

export async function addMember(db: AppDb, groupId: string, customerId: string) {
  const now = new Date().toISOString();

  await db
    .insert(customerGroupMembers)
    .values({ id: crypto.randomUUID(), groupId, customerId, assignedAt: now })
    .onConflictDoNothing();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, groupId))
    .get();

  await db
    .update(customerGroups)
    .set({ memberCount: result?.count ?? 0, updatedAt: now })
    .where(eq(customerGroups.id, groupId));
}

export async function removeMember(db: AppDb, groupId: string, customerId: string) {
  await db
    .delete(customerGroupMembers)
    .where(
      and(
        eq(customerGroupMembers.groupId, groupId),
        eq(customerGroupMembers.customerId, customerId),
      ),
    );

  const now = new Date().toISOString();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, groupId))
    .get();

  await db
    .update(customerGroups)
    .set({ memberCount: result?.count ?? 0, updatedAt: now })
    .where(eq(customerGroups.id, groupId));
}
