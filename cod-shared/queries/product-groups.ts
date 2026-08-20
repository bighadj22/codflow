import { eq, and, like, count, isNull } from "drizzle-orm";
import { productCategories, products } from "../db/schema";
import type { AppDb } from "../db/client";

export interface GroupFilters {
  search?: string;
  parentId?: string;
}

export interface CreateGroupData {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  position: number;
}

export interface UpdateGroupData {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  position?: number;
}

function toSlug(name: string, id: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-") + "-" + id.slice(0, 8);
}

export async function getAllGroups(db: AppDb, filters?: GroupFilters) {
  const conditions = [];
  if (filters?.search) conditions.push(like(productCategories.name, `%${filters.search}%`));
  if (filters?.parentId) conditions.push(eq(productCategories.parentId, filters.parentId));

  const rows = await db
    .select()
    .from(productCategories)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productCategories.position)
    .all();

  return Promise.all(rows.map(async (cat) => {
    const countRow = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.categoryId, cat.id),
        isNull(products.deletedAt)
      ))
      .get();
    return { ...cat, productsCount: countRow?.count ?? 0 };
  }));
}

export async function getGroupById(db: AppDb, id: string) {
  const cat = await db.select().from(productCategories).where(eq(productCategories.id, id)).get();
  if (!cat) return null;
  const [childrenRows, productsCountRow] = await Promise.all([
    db.select().from(productCategories).where(eq(productCategories.parentId, id)).all(),
    db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.categoryId, id),
        isNull(products.deletedAt)
      ))
      .get(),
  ]);
  return { ...cat, children: childrenRows, productsCount: productsCountRow?.count ?? 0 };
}

export async function createGroup(db: AppDb, data: CreateGroupData) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = data.slug || toSlug(data.name, id);

  await db.insert(productCategories).values({
    id,
    name: data.name,
    slug,
    description: data.description ?? null,
    parentId: data.parentId ?? null,
    imageUrl: data.imageUrl ?? null,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    metaKeywords: data.metaKeywords ?? null,
    position: data.position,
    createdAt: now,
    updatedAt: now,
  });

  return getGroupById(db, id);
}

export async function updateGroup(db: AppDb, id: string, data: UpdateGroupData) {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.description !== undefined) updates.description = data.description ?? null;
  if (data.parentId !== undefined) updates.parentId = data.parentId ?? null;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl ?? null;
  if (data.metaTitle !== undefined) updates.metaTitle = data.metaTitle ?? null;
  if (data.metaDescription !== undefined) updates.metaDescription = data.metaDescription ?? null;
  if (data.metaKeywords !== undefined) updates.metaKeywords = data.metaKeywords ?? null;
  if (data.position !== undefined) updates.position = data.position;

  await db.update(productCategories).set(updates).where(eq(productCategories.id, id));
  return getGroupById(db, id);
}

export async function deleteGroup(db: AppDb, id: string) {
  await db.delete(productCategories).where(eq(productCategories.id, id));
  return { success: true };
}
