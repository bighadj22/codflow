import { eq, and, like, or, count, sum, isNull, sql } from "drizzle-orm";
import { products, productCategories, productVariants, productImages, reviews } from "../db/schema";
import type { AppDb } from "../db/client";

export interface VariantOption {
  name: string;
  values: { value: string; hexColor?: string | null }[];
}

export interface ProductFilters {
  categoryId?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateProductData {
  name: string;
  description?: string | null;
  handle?: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  type: "PHYSICAL" | "DIGITAL";
  hasVariants: boolean;
  variantOptions?: VariantOption[] | null;
  sku?: string | null;
  inventory: number;
  lowStockThreshold?: number;
  trackInventory: boolean;
  categoryId?: string | null;
  tags?: string[];
  visibility: boolean;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  showInStore: boolean;
  storeFeatured: boolean;
  shippingProfileId?: string | null;
}

export interface UpdateProductData {
  name?: string;
  description?: string | null;
  handle?: string;
  price?: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  type?: "PHYSICAL" | "DIGITAL";
  hasVariants?: boolean;
  variantOptions?: VariantOption[] | null;
  sku?: string | null;
  inventory?: number;
  lowStockThreshold?: number;
  trackInventory?: boolean;
  categoryId?: string | null;
  tags?: string[];
  visibility?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  showInStore?: boolean;
  storeFeatured?: boolean;
  shippingProfileId?: string | null;
}

function toHandle(name: string, id: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-") + "-" + id.slice(0, 8);
}

async function buildProductDetail(db: AppDb, productId: string) {
  const product = await db.select().from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).get();
  if (!product) return null;

  const [category, variants, images, totalInventoryRow] = await Promise.all([
    product.categoryId
      ? db.select().from(productCategories).where(eq(productCategories.id, product.categoryId)).get()
      : Promise.resolve(null),
    db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(productVariants.position).all(),
    db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(productImages.position).all(),
    db.select({ total: sum(productVariants.inventory) }).from(productVariants).where(eq(productVariants.productId, productId)).get(),
  ]);

  const variantOptions = product.variantOptions ? JSON.parse(product.variantOptions) : null;
  const tags = product.tags ? JSON.parse(product.tags) : [];

  const parsedVariants = variants.map((v) => ({
    ...v,
    variations: JSON.parse(v.variations),
  }));

  const totalInventory = product.hasVariants
    ? Number(totalInventoryRow?.total ?? 0)
    : product.inventory;

  return {
    ...product,
    variantOptions,
    tags,
    category,
    variants: parsedVariants,
    images,
    variantsCount: parsedVariants.length,
    totalInventory,
  };
}

export async function getAllProducts(db: AppDb, filters?: ProductFilters) {
  const conditions: ReturnType<typeof eq>[] = [];
  conditions.push(isNull(products.deletedAt) as any);

  if (filters?.categoryId) conditions.push(eq(products.categoryId, filters.categoryId) as any);
  if (filters?.status) conditions.push(eq(products.status, filters.status) as any);
  if (filters?.visibility !== undefined) conditions.push(eq(products.visibility, filters.visibility) as any);
  if (filters?.search) {
    conditions.push(or(
      like(products.name, `%${filters.search}%`),
      like(products.handle, `%${filters.search}%`),
      like(products.description, `%${filters.search}%`),
    ) as any);
  }

  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(filters?.limit ?? 50)
    .offset(filters?.offset ?? 0)
    .all();

  return Promise.all(rows.map(async (p) => {
    const [variantsCountRow, totalInventoryRow, imagesRow, variantRows, reviewCountRow, avgRatingRow] = await Promise.all([
      db.select({ count: count() }).from(productVariants).where(eq(productVariants.productId, p.id)).get(),
      db.select({ total: sum(productVariants.inventory) }).from(productVariants).where(eq(productVariants.productId, p.id)).get(),
      db.select({ src: productImages.src }).from(productImages).where(eq(productImages.productId, p.id)).orderBy(productImages.position).limit(1).get(),
      db.select().from(productVariants).where(eq(productVariants.productId, p.id)).orderBy(productVariants.position).all(),
      db.select({ count: count() }).from(reviews).where(and(eq(reviews.productId, p.id), eq(reviews.status, "approved"))).get(),
      db.select({ avg: sql<number | null>`ROUND(AVG(${reviews.rating}), 1)` }).from(reviews).where(and(eq(reviews.productId, p.id), eq(reviews.status, "approved"))).get(),
    ]);
    return {
      ...p,
      variantOptions: p.variantOptions ? JSON.parse(p.variantOptions) : null,
      tags: p.tags ? JSON.parse(p.tags) : [],
      variantsCount: variantsCountRow?.count ?? 0,
      totalInventory: Number(totalInventoryRow?.total ?? p.inventory),
      primaryImageSrc: imagesRow?.src ?? null,
      variants: variantRows.map((v) => ({ ...v, variations: JSON.parse(v.variations) as Record<string, string> })),
      reviewCount: reviewCountRow?.count ?? 0,
      avgRating: avgRatingRow?.avg ?? null,
    };
  }));
}

export async function getProductById(db: AppDb, productId: string) {
  return buildProductDetail(db, productId);
}

export async function createProduct(db: AppDb, data: CreateProductData) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const handle = data.handle || toHandle(data.name, id);

  await db.insert(products).values({
    id,
    name: data.name,
    description: data.description ?? null,
    handle,
    currency: "DZD",
    price: data.price,
    compareAtPrice: data.compareAtPrice ?? null,
    costPrice: data.costPrice ?? null,
    type: data.type,
    hasVariants: data.hasVariants,
    variantOptions: data.variantOptions ? JSON.stringify(data.variantOptions) : null,
    sku: data.sku ?? null,
    inventory: data.inventory,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    trackInventory: data.trackInventory,
    categoryId: data.categoryId ?? null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    visibility: data.visibility,
    status: data.status,
    showInStore: data.showInStore,
    storeFeatured: data.storeFeatured,
    shippingProfileId: data.shippingProfileId ?? null,
    deletedAt: null,
    publishedAt: data.status === "ACTIVE" ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  return buildProductDetail(db, id);
}

export async function updateProduct(db: AppDb, productId: string, data: UpdateProductData) {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description ?? null;
  if (data.handle !== undefined) updates.handle = data.handle;
  if (data.price !== undefined) updates.price = data.price;
  if (data.compareAtPrice !== undefined) updates.compareAtPrice = data.compareAtPrice ?? null;
  if (data.costPrice !== undefined) updates.costPrice = data.costPrice ?? null;
  if (data.type !== undefined) updates.type = data.type;
  if (data.hasVariants !== undefined) updates.hasVariants = data.hasVariants;
  if (data.variantOptions !== undefined) updates.variantOptions = data.variantOptions ? JSON.stringify(data.variantOptions) : null;
  if (data.sku !== undefined) updates.sku = data.sku ?? null;
  if (data.inventory !== undefined) updates.inventory = data.inventory;
  if (data.lowStockThreshold !== undefined) updates.lowStockThreshold = data.lowStockThreshold;
  if (data.trackInventory !== undefined) updates.trackInventory = data.trackInventory;
  if (data.categoryId !== undefined) updates.categoryId = data.categoryId ?? null;
  if (data.tags !== undefined) updates.tags = data.tags ? JSON.stringify(data.tags) : null;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === "ACTIVE") updates.publishedAt = new Date().toISOString();
  }
  if (data.showInStore !== undefined) updates.showInStore = data.showInStore;
  if (data.storeFeatured !== undefined) updates.storeFeatured = data.storeFeatured;
  if (data.shippingProfileId !== undefined) updates.shippingProfileId = data.shippingProfileId ?? null;

  await db.update(products).set(updates).where(eq(products.id, productId));
  return buildProductDetail(db, productId);
}

export async function deleteProduct(db: AppDb, productId: string) {
  await db.update(products).set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(products.id, productId));
  return { success: true };
}

export async function getProductImages(db: AppDb, productId: string) {
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.position)
    .all();
}
