/**
 * Product upsell queries (product_upsells table).
 *
 * Effective pricing rule: the assignment `price` / `compareAtPrice` overrides
 * apply to SIMPLE upsell products (price ?? product.price). For upsell
 * products with variants the per-variant price is the only authoritative
 * source (overrides are ignored) and the offer resolves to the first active
 * variant, which also supplies the SKU/label.
 */

import { eq, and, isNull, inArray, getTableColumns, sql } from "drizzle-orm";
import { productUpsells, products, productVariants, productImages } from "../db/schema";
import type { AppDb } from "../db/client";

const MAX_IN_ARRAY_IDS = 90;

function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IN_ARRAY_IDS) {
    chunks.push(ids.slice(i, i + MAX_IN_ARRAY_IDS));
  }
  return chunks;
}

export interface ProductUpsellOffer {
  id: string;
  productId: string;
  upsellProductId: string;
  name: string;
  description: string | null;
  sku: string | null;
  hasVariants: boolean;
  /** Effective unit price: assignment override ?? product price (simple) or first active variant price (variant). */
  price: number;
  /** Raw assignment price override (null = inherit). Variant-product overrides are ignored. */
  overridePrice: number | null;
  compareAtPrice: number | null;
  variantId: string | null;
  variantLabel: string | null;
  primaryImageSrc: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface ListOptions {
  /** Storefront scope: only isActive assignments whose product is ACTIVE, visible, not deleted. */
  storefront?: boolean;
}

export async function listProductUpsells(
  db: AppDb,
  productId: string,
  opts: ListOptions = {},
): Promise<ProductUpsellOffer[]> {
  const conditions: ReturnType<typeof eq>[] = [eq(productUpsells.productId, productId)];
  if (opts.storefront) conditions.push(eq(productUpsells.isActive, true) as any);

  const rows = await db
    .select()
    .from(productUpsells)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productUpsells.position)
    .all();

  if (rows.length === 0) return [];

  const upsellIds = rows.map((r) => r.upsellProductId);
  const productCondition =
    opts.storefront
      ? and(
          isNull(products.deletedAt),
          eq(products.status, "ACTIVE"),
          eq(products.visibility, true),
        )
      : isNull(products.deletedAt);

  const upsellProductsList: Array<typeof products.$inferSelect> = [];
  for (const chunk of chunkIds(upsellIds)) {
    upsellProductsList.push(
      ...(await db
        .select({
          ...getTableColumns(products),
          primaryImageSrc: sql<string | null>`(SELECT src FROM product_images WHERE product_images.product_id = products.id ORDER BY product_images.position LIMIT 1)`,
        })
        .from(products)
        .where(and(inArray(products.id, chunk), productCondition))
        .all()),
    );
  }

  const productMap = new Map(
    upsellProductsList.map((p) => {
      const { primaryImageSrc } = p as typeof p & { primaryImageSrc: string | null };
      return [p.id, { product: p, primaryImageSrc }];
    }),
  );

  const variantProductIds = upsellProductsList.filter((p) => p.hasVariants).map((p) => p.id);
  const variantsByProduct = new Map<string, Array<typeof productVariants.$inferSelect>>();
  for (const chunk of chunkIds(variantProductIds)) {
    const rowsChunk = await db
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, chunk), eq(productVariants.active, true)))
      .orderBy(productVariants.position)
      .all();
    for (const v of rowsChunk) {
      const list = variantsByProduct.get(v.productId);
      if (list) list.push(v);
      else variantsByProduct.set(v.productId, [v]);
    }
  }

  const offers: ProductUpsellOffer[] = [];
  for (const row of rows) {
    const entry = productMap.get(row.upsellProductId);
    if (!entry) continue;
    const { product, primaryImageSrc } = entry;
    const defaultVariant = variantsByProduct.get(product.id)?.[0] ?? null;

    if (product.hasVariants && !defaultVariant) {
      // No sellable variant — skip in storefront, keep in admin view.
      if (opts.storefront) continue;
    }

    const effectivePrice = product.hasVariants
      ? defaultVariant?.price ?? 0
      : row.price ?? product.price;
    const compareAtPrice = product.hasVariants
      ? defaultVariant?.compareAtPrice ?? null
      : row.compareAtPrice ?? product.compareAtPrice;

    offers.push({
      id: row.id,
      productId: row.productId,
      upsellProductId: row.upsellProductId,
      name: product.name,
      description: product.description,
      sku: product.hasVariants ? defaultVariant?.sku ?? null : product.sku,
      hasVariants: product.hasVariants,
      price: effectivePrice,
      overridePrice: row.price,
      compareAtPrice,
      variantId: product.hasVariants ? defaultVariant?.id ?? null : null,
      variantLabel: product.hasVariants
        ? defaultVariant
          ? Object.values(JSON.parse(defaultVariant.variations) as Record<string, string>).join(" / ")
          : null
        : null,
      primaryImageSrc,
      isActive: row.isActive,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return offers;
}

/**
 * Resolve one active upsell offer for order creation (server-authoritative).
 * Returns null when the assignment is missing/inactive or the upsell product
 * has no sellable variant. Used by the storefront order gate + order build.
 */
export async function getActiveProductUpsell(
  db: AppDb,
  productId: string,
  upsellProductId: string,
) {
  const row = await db
    .select()
    .from(productUpsells)
    .where(
      and(
        eq(productUpsells.productId, productId),
        eq(productUpsells.upsellProductId, upsellProductId),
        eq(productUpsells.isActive, true),
      ),
    )
    .get();
  if (!row) return null;

  const product = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, upsellProductId),
        eq(products.status, "ACTIVE"),
        eq(products.visibility, true),
        isNull(products.deletedAt),
      ),
    )
    .get();
  if (!product) return null;

  let variant:
    | { id: string; label: string; sku: string | null; price: number }
    | null = null;
  if (product.hasVariants) {
    const defaultVariant = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, upsellProductId),
          eq(productVariants.active, true),
        ),
      )
      .orderBy(productVariants.position)
      .get();
    if (!defaultVariant) return null;
    variant = {
      id: defaultVariant.id,
      label: Object.values(JSON.parse(defaultVariant.variations) as Record<string, string>).join(" / "),
      sku: defaultVariant.sku,
      price: defaultVariant.price,
    };
  }

  const simplePrice = row.price ?? product.price;

  return {
    assignmentId: row.id,
    productId,
    upsellProductId,
    name: product.name,
    sku: variant?.sku ?? product.sku,
    hasVariants: product.hasVariants,
    trackInventory: product.trackInventory,
    variantId: variant?.id ?? null,
    variantLabel: variant?.label ?? null,
    price: variant ? variant.price : simplePrice,
    compareAtPrice: variant ? product.compareAtPrice : row.compareAtPrice ?? product.compareAtPrice,
  };
}

export interface CreateProductUpsellData {
  productId: string;
  upsellProductId: string;
  price?: number | null;
  compareAtPrice?: number | null;
  isActive?: boolean;
  position?: number;
}

export async function createProductUpsell(db: AppDb, data: CreateProductUpsellData) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const exists = await db
    .select({ id: productUpsells.id })
    .from(productUpsells)
    .where(
      and(
        eq(productUpsells.productId, data.productId),
        eq(productUpsells.upsellProductId, data.upsellProductId),
      ),
    )
    .get();
  if (exists) return { duplicated: true as const };

  await db.insert(productUpsells).values({
    id,
    productId: data.productId,
    upsellProductId: data.upsellProductId,
    price: data.price ?? null,
    compareAtPrice: data.compareAtPrice ?? null,
    isActive: data.isActive ?? true,
    position: data.position ?? 1,
    createdAt: now,
    updatedAt: now,
  });
  return {
    duplicated: false as const,
    offers: await listProductUpsells(db, data.productId),
  };
}

export interface UpdateProductUpsellData {
  price?: number | null;
  compareAtPrice?: number | null;
  isActive?: boolean;
  position?: number;
}

export async function updateProductUpsell(
  db: AppDb,
  assignmentId: string,
  data: UpdateProductUpsellData,
) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.price !== undefined) updates.price = data.price ?? null;
  if (data.compareAtPrice !== undefined) updates.compareAtPrice = data.compareAtPrice ?? null;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.position !== undefined) updates.position = data.position;

  const row = await db
    .update(productUpsells)
    .set(updates)
    .where(eq(productUpsells.id, assignmentId))
    .returning({ productId: productUpsells.productId, id: productUpsells.id })
    .get();
  if (!row) return null;
  return { productId: row.productId, offers: await listProductUpsells(db, row.productId) };
}

export async function deleteProductUpsell(db: AppDb, assignmentId: string) {
  const row = await db
    .delete(productUpsells)
    .where(eq(productUpsells.id, assignmentId))
    .returning({ productId: productUpsells.productId, id: productUpsells.id })
    .get();
  if (!row) return null;
  return { productId: row.productId, offers: await listProductUpsells(db, row.productId) };
}