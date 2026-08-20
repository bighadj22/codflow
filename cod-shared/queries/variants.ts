import { eq } from "drizzle-orm";
import { productVariants, orderProducts } from "../db/schema";
import type { AppDb } from "../db/client";

export interface CreateVariantData {
  variations: Record<string, string>;
  price: number;
  compareAtPrice?: number | null;
  sku: string;
  barcode?: string | null;
  inventory: number;
  lowStockThreshold?: number;
  weightKg?: number | null;
  imageId?: string | null;
  isDefault: boolean;
  active: boolean;
  position: number;
}

export interface UpdateVariantData {
  variations?: Record<string, string>;
  price?: number;
  compareAtPrice?: number | null;
  sku?: string;
  barcode?: string | null;
  inventory?: number;
  lowStockThreshold?: number;
  weightKg?: number | null;
  imageId?: string | null;
  isDefault?: boolean;
  active?: boolean;
  position?: number;
}

function parseVariant(v: typeof productVariants.$inferSelect) {
  return { ...v, variations: JSON.parse(v.variations) as Record<string, string> };
}

export async function getVariantsByProduct(db: AppDb, productId: string) {
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.position)
    .all();
  return variants.map(parseVariant);
}

export async function getVariantById(db: AppDb, variantId: string) {
  const v = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).get();
  return v ? parseVariant(v) : null;
}

export async function createVariant(db: AppDb, productId: string, data: CreateVariantData) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(productVariants).values({
    id,
    productId,
    variations: JSON.stringify(data.variations),
    currency: "DZD",
    price: data.price,
    compareAtPrice: data.compareAtPrice ?? null,
    sku: data.sku ?? null,
    barcode: data.barcode ?? null,
    inventory: data.inventory,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    weightKg: data.weightKg ?? null,
    imageId: data.imageId ?? null,
    isDefault: data.isDefault,
    active: data.active,
    position: data.position,
    createdAt: now,
    updatedAt: now,
  });

  return getVariantById(db, id);
}

export async function updateVariant(db: AppDb, variantId: string, data: UpdateVariantData) {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.variations !== undefined) updates.variations = JSON.stringify(data.variations);
  if (data.price !== undefined) updates.price = data.price;
  if (data.compareAtPrice !== undefined) updates.compareAtPrice = data.compareAtPrice ?? null;
  if (data.sku !== undefined) updates.sku = data.sku ?? null;
  if (data.barcode !== undefined) updates.barcode = data.barcode ?? null;
  if (data.inventory !== undefined) updates.inventory = data.inventory;
  if (data.lowStockThreshold !== undefined) updates.lowStockThreshold = data.lowStockThreshold;
  if (data.weightKg !== undefined) updates.weightKg = data.weightKg ?? null;
  if (data.imageId !== undefined) updates.imageId = data.imageId ?? null;
  if (data.isDefault !== undefined) updates.isDefault = data.isDefault;
  if (data.active !== undefined) updates.active = data.active;
  if (data.position !== undefined) updates.position = data.position;

  await db.update(productVariants).set(updates).where(eq(productVariants.id, variantId));
  return getVariantById(db, variantId);
}

export async function deleteVariant(db: AppDb, variantId: string) {
  // Preserve order history — null out the reference rather than blocking deletion.
  await db.update(orderProducts).set({ variantId: null }).where(eq(orderProducts.variantId, variantId));
  await db.delete(productVariants).where(eq(productVariants.id, variantId));
  return { success: true };
}
