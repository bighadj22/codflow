/**
 * Store (storefront) Queries
 *
 * Public storefront API — product listing, order creation, reviews.
 * No server-only error classes here; the handlers translate results to HTTP errors.
 */

import {
  eq,
  and,
  isNull,
  desc,
  sql,
  getTableColumns,
  lte,
  gte,
  or,
  asc,
  inArray,
} from "drizzle-orm";
import {
  products,
  productCategories,
  productVariants,
  productImages,
  stores,
  storePixelConfig,
  storeOtpConfig,
  customers,
  orders,
  orderProducts,
  orderStatusHistory,
  shippingProfiles,
  shippingRules,
  wilayas,
  communes,
  reviews,
  offers,
  stockMovements,
} from "../db/schema";
import type { AppDb } from "../db/client";

export interface StoreOrderData {
  customerName: string;
  phone: string;
  wilayaId: number;
  communeId: string;
  address?: string;
  deliveryType: "home" | "stop_desk";
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  pricePerUnit: number;
  notes?: string;
  offerId?: string;
  variantSelections?: Array<{ variantId: string; variantLabel?: string }>;
  fbc?: string;
  fbp?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function getStoreConfig(db: AppDb, storeId: string) {
  const store = await db.select().from(stores).where(eq(stores.id, storeId)).get();
  if (!store) return null;
  const [pixelRow, otpRow] = await Promise.all([
    db
      .select({ pixelId: storePixelConfig.pixelId, enabled: storePixelConfig.enabled })
      .from(storePixelConfig)
      .where(eq(storePixelConfig.storeId, storeId))
      .get(),
    db
      .select({ enabled: storeOtpConfig.enabled })
      .from(storeOtpConfig)
      .where(eq(storeOtpConfig.storeId, storeId))
      .get(),
  ]);
  return {
    ...store,
    pixelId: pixelRow?.enabled ? pixelRow.pixelId : null,
    otpEnabled: otpRow?.enabled === true,
  };
}

const MAX_IN_ARRAY_IDS = 90;

function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IN_ARRAY_IDS) {
    chunks.push(ids.slice(i, i + MAX_IN_ARRAY_IDS));
  }
  return chunks;
}

export async function getStoreProducts(
  db: AppDb,
  params: { featured?: boolean; categoryId?: string; limit?: number },
) {
  const conditions: any[] = [
    eq(products.showInStore, true),
    eq(products.status, "ACTIVE"),
    eq(products.visibility, true),
    isNull(products.deletedAt),
  ];

  if (params.featured) conditions.push(eq(products.storeFeatured, true));
  if (params.categoryId) conditions.push(eq(products.categoryId, params.categoryId));

  const rows = await db
    .select({
      ...getTableColumns(products),
      avgRating: sql<number | null>`(SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = products.id AND r.status = 'approved')`,
      reviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id AND r.status = 'approved'), 0)`,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.storeFeatured), desc(products.createdAt))
    .limit(params.limit ?? 24)
    .all();

  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);

  const imageStatements = chunkIds(ids).map((chunk) =>
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, chunk))
      .orderBy(productImages.productId, productImages.position),
  );
  const inventoryStatements = chunkIds(ids).map((chunk) =>
    db
      .select({
        productId: productVariants.productId,
        total: sql<number>`COALESCE(SUM(${productVariants.inventory}), 0)`,
      })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, chunk), eq(productVariants.active, true)))
      .groupBy(productVariants.productId),
  );

  type ImageRow = typeof productImages.$inferSelect;
  type InventoryRow = { productId: string; total: number };
  type BatchStatement = Parameters<AppDb["batch"]>[0][number];

  const statements: BatchStatement[] = [...imageStatements, ...inventoryStatements];
  const batchResults = (await db.batch(
    statements as [BatchStatement, ...BatchStatement[]],
  )) as unknown as Array<Array<ImageRow | InventoryRow>>;

  const imageRows = batchResults.slice(0, imageStatements.length).flat() as ImageRow[];
  const inventoryRows = batchResults.slice(imageStatements.length).flat() as InventoryRow[];

  const coverImageByProduct = new Map<string, typeof productImages.$inferSelect>();
  for (const image of imageRows) {
    if (!coverImageByProduct.has(image.productId)) {
      coverImageByProduct.set(image.productId, image);
    }
  }
  const variantInventoryByProduct = new Map<string, number>();
  for (const row of inventoryRows) {
    variantInventoryByProduct.set(row.productId, Number(row.total));
  }

  return rows.map((p) => {
    const { avgRating, reviewCount, ...productData } = p;
    const inventory = productData.hasVariants
      ? variantInventoryByProduct.get(p.id) ?? 0
      : productData.inventory;
    return {
      ...productData,
      inventory,
      coverImage: coverImageByProduct.get(p.id) ?? null,
      reviewStats:
        reviewCount > 0 ? { avgRating: avgRating ?? 0, reviewCount } : null,
    };
  });
}

export async function getStoreProductByHandle(db: AppDb, handle: string) {
  const product = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.handle, handle),
        eq(products.showInStore, true),
        eq(products.status, "ACTIVE"),
        eq(products.visibility, true),
        isNull(products.deletedAt),
      ),
    )
    .get();

  if (!product) return null;

  const [category, variants, images, reviewStatsRow] = await Promise.all([
    product.categoryId
      ? db
          .select()
          .from(productCategories)
          .where(eq(productCategories.id, product.categoryId))
          .get()
      : null,
    db
      .select()
      .from(productVariants)
      .where(
        and(eq(productVariants.productId, product.id), eq(productVariants.active, true)),
      )
      .orderBy(productVariants.position)
      .all(),
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(productImages.position)
      .all(),
    db
      .select({
        avgRating: sql<number | null>`ROUND(AVG(${reviews.rating}), 1)`,
        reviewCount: sql<number>`COUNT(*)`,
      })
      .from(reviews)
      .where(and(eq(reviews.productId, product.id), eq(reviews.status, "approved")))
      .get(),
  ]);

  const now = new Date().toISOString();
  const offerRows = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.triggerProductId, product.id),
        eq(offers.status, "active"),
        or(isNull(offers.startsAt), lte(offers.startsAt, now)),
        or(isNull(offers.endsAt), gte(offers.endsAt, now)),
      ),
    )
    .orderBy(offers.createdAt)
    .all();

  const resolvedOffers = await Promise.all(
    offerRows.map(async (offer) => {
      const rewardProduct = offer.rewardProductId
        ? await db
            .select({ id: products.id, name: products.name })
            .from(products)
            .where(eq(products.id, offer.rewardProductId))
            .get()
        : null;

      const rewardVariant = offer.rewardVariantId
        ? await db
            .select({ id: productVariants.id, variations: productVariants.variations })
            .from(productVariants)
            .where(eq(productVariants.id, offer.rewardVariantId))
            .get()
        : null;

      return {
        id: offer.id,
        name: offer.name,
        discountType: offer.discountType as "free" | "free_shipping",
        triggerQuantity: offer.triggerQuantity,
        triggerVariantId: offer.triggerVariantId ?? null,
        rewardQuantity: offer.rewardQuantity,
        rewardProductId: offer.rewardProductId ?? null,
        rewardProductName: rewardProduct?.name ?? "",
        rewardVariantId: offer.rewardVariantId ?? null,
        rewardVariantLabel: rewardVariant
          ? Object.values(
              JSON.parse(rewardVariant.variations) as Record<string, string>,
            ).join(" / ")
          : null,
      };
    }),
  );

  const totalInventory = product.hasVariants
    ? variants.reduce((sum, v) => sum + v.inventory, 0)
    : product.inventory;

  return {
    ...product,
    inventory: totalInventory,
    variantOptions: product.variantOptions ? JSON.parse(product.variantOptions) : null,
    tags: product.tags ? JSON.parse(product.tags) : [],
    category: category ?? null,
    variants: variants.map((v) => ({
      ...v,
      variations: JSON.parse(v.variations),
    })),
    images,
    offers: resolvedOffers,
    reviewStats:
      (reviewStatsRow?.reviewCount ?? 0) > 0
        ? {
            avgRating: reviewStatsRow!.avgRating ?? 0,
            reviewCount: reviewStatsRow!.reviewCount,
          }
        : null,
  };
}

export async function getStoreCategories(db: AppDb) {
  return db.select().from(productCategories).orderBy(productCategories.position).all();
}

export async function getStoreCommunes(db: AppDb, wilayaId: number) {
  return db
    .select({ id: communes.id, name: communes.name, nameAr: communes.nameAr })
    .from(communes)
    .where(eq(communes.wilayaId, wilayaId))
    .all();
}

export async function findOrCreateCustomer(
  db: AppDb,
  data: { phone: string; name: string; wilayaId: number; communeId?: string },
) {
  const [wilayaRecord, communeRecord] = await Promise.all([
    db
      .select({ nameAr: wilayas.nameAr })
      .from(wilayas)
      .where(eq(wilayas.id, data.wilayaId))
      .get(),
    data.communeId
      ? db
          .select({ nameAr: communes.nameAr })
          .from(communes)
          .where(eq(communes.id, data.communeId))
          .get()
      : Promise.resolve(null),
  ]);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const wilayaName = wilayaRecord?.nameAr ?? `ولاية ${data.wilayaId}`;
  const communeName = communeRecord?.nameAr ?? null;

  const [row] = await db
    .insert(customers)
    .values({
      id,
      name: data.name,
      phone: data.phone,
      wilayaId: data.wilayaId,
      communeId: data.communeId ?? null,
      wilaya: wilayaName,
      commune: communeName,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        name: data.name,
        wilayaId: data.wilayaId,
        communeId: data.communeId ?? null,
        wilaya: wilayaName,
        commune: communeName,
      },
    })
    .returning();

  return row;
}

export async function getDeliveryFee(
  db: AppDb,
  wilayaId: number,
  deliveryType: "home" | "stop_desk",
): Promise<number> {
  const profile = await db
    .select()
    .from(shippingProfiles)
    .where(eq(shippingProfiles.isDefault, true))
    .get();

  if (!profile) return 0;

  const rule = await db
    .select()
    .from(shippingRules)
    .where(
      and(
        eq(shippingRules.profileId, profile.id),
        eq(shippingRules.wilayaId, wilayaId),
      ),
    )
    .get();

  if (!rule) return 0;
  return deliveryType === "stop_desk" ? rule.stopDeskPrice : rule.homePrice;
}

export async function getShippingRates(db: AppDb) {
  const profile = await db
    .select()
    .from(shippingProfiles)
    .where(eq(shippingProfiles.isDefault, true))
    .get();
  if (!profile) return {};

  const rules = await db
    .select()
    .from(shippingRules)
    .where(eq(shippingRules.profileId, profile.id))
    .all();

  return Object.fromEntries(
    rules.map((r) => [r.wilayaId, { home: r.homePrice, stopDesk: r.stopDeskPrice }]),
  );
}

// ─── Offer selection helper ───────────────────────────────────────────────────

export async function selectApplicableOffer(
  db: AppDb,
  productId: string,
  quantity: number,
  variantId: string | null | undefined,
  offerId: string | undefined,
): Promise<typeof offers.$inferSelect | null> {
  const now = new Date().toISOString();

  const baseConditions = and(
    eq(offers.triggerProductId, productId),
    eq(offers.status, "active"),
    lte(offers.triggerQuantity, quantity),
    or(isNull(offers.startsAt), lte(offers.startsAt, now)),
    or(isNull(offers.endsAt), gte(offers.endsAt, now)),
  );

  let candidates: (typeof offers.$inferSelect)[];

  if (offerId) {
    const explicit = await db
      .select()
      .from(offers)
      .where(and(eq(offers.id, offerId), baseConditions))
      .get();
    if (explicit) candidates = [explicit];
    else {
      candidates = await db
        .select()
        .from(offers)
        .where(baseConditions)
        .orderBy(desc(offers.triggerQuantity))
        .all();
    }
  } else {
    candidates = await db
      .select()
      .from(offers)
      .where(baseConditions)
      .orderBy(desc(offers.triggerQuantity))
      .all();
  }

  for (const offer of candidates) {
    const variantMatches =
      !offer.triggerVariantId || offer.triggerVariantId === (variantId ?? null);
    if (variantMatches) return offer;
  }

  return null;
}

// ─── Variant grouping helper ──────────────────────────────────────────────────

function groupVariantSelections(
  selections: Array<{ variantId: string; variantLabel?: string }>,
): Array<{ variantId: string; variantLabel: string | null; count: number }> {
  const map = new Map<string, { variantLabel: string | null; count: number }>();
  for (const sel of selections) {
    const existing = map.get(sel.variantId);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(sel.variantId, {
        variantLabel: sel.variantLabel ?? null,
        count: 1,
      });
    }
  }
  return Array.from(map.entries()).map(([variantId, val]) => ({
    variantId,
    variantLabel: val.variantLabel,
    count: val.count,
  }));
}

// ─── Stock pre-check (before order creation) ─────────────────────────────────

export async function checkStoreOrderStock(
  db: AppDb,
  params: {
    productId: string;
    variantId: string | null;
    variantSelections: Array<{ variantId: string }>;
    quantity: number;
  },
): Promise<string | null> {
  const productRow = await db
    .select({ trackInventory: products.trackInventory, inventory: products.inventory })
    .from(products)
    .where(eq(products.id, params.productId))
    .get();

  if (!productRow?.trackInventory) return null;

  if (params.variantSelections.length > 0) {
    const groups = groupVariantSelections(params.variantSelections);
    for (const group of groups) {
      const row = await db
        .select({ inventory: productVariants.inventory })
        .from(productVariants)
        .where(eq(productVariants.id, group.variantId))
        .get();
      if ((row?.inventory ?? 0) < group.count) {
        return "بعض الخيارات المطلوبة غير متوفرة حالياً. يرجى اختيار خياراً آخر.";
      }
    }
  } else if (params.variantId) {
    const row = await db
      .select({ inventory: productVariants.inventory })
      .from(productVariants)
      .where(eq(productVariants.id, params.variantId))
      .get();
    if ((row?.inventory ?? 0) < params.quantity) {
      return "هذا المنتج غير متوفر بالخيار المطلوب. يرجى اختيار خياراً آخر.";
    }
  } else {
    if (productRow.inventory < params.quantity) {
      return "هذا المنتج غير متوفر حالياً.";
    }
  }

  return null;
}

// ─── Stock deduction + movement log ──────────────────────────────────────────

interface DeductStockInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  orderId: string;
  customerId: string;
  customerName: string;
  now: string;
}

type BatchStatement = Parameters<AppDb["batch"]>[0][number];

/**
 * Build the write pair (movement log + atomic deduction) for a batch.
 *
 * The guard lives in the movement INSERT, not just the UPDATE: qtyBefore and
 * qtyAfter are subselects with the availability predicate
 * `inventory >= quantity` baked in. When stock cannot cover the deduction,
 * the subselects return NULL, the NOT NULL constraint on stock_movements
 * fails, and D1 rolls back the ENTIRE batch — order, lines, stats, and all.
 * One round trip, race-free, and the movement log values come from the
 * database itself rather than a racy pre-read.
 */
function buildDeductStatements(
  db: AppDb,
  input: DeductStockInput,
): BatchStatement[] {
  const { productId, variantId, quantity, orderId, customerId, customerName, now } = input;

  const guard =
    variantId !== null
      ? sql`FROM ${productVariants} WHERE ${productVariants.id} = ${variantId} AND ${productVariants.inventory} >= ${quantity}`
      : sql`FROM ${products} WHERE ${products.id} = ${productId} AND ${products.inventory} >= ${quantity}`;
  const inventoryColumn =
    variantId !== null ? productVariants.inventory : products.inventory;

  const guardedUpdate =
    variantId !== null
      ? db
          .update(productVariants)
          .set({ inventory: sql`${productVariants.inventory} - ${quantity}`, updatedAt: now })
          .where(
            and(
              eq(productVariants.id, variantId),
              sql`${productVariants.inventory} >= ${quantity}`,
            ),
          )
      : db
          .update(products)
          .set({ inventory: sql`${products.inventory} - ${quantity}`, updatedAt: now })
          .where(
            and(
              eq(products.id, productId),
              sql`${products.inventory} >= ${quantity}`,
            ),
          );

  return [
    db.insert(stockMovements).values({
      id: crypto.randomUUID(),
      productId,
      variantId,
      type: "ORDER_DEDUCTED",
      delta: -quantity,
      qtyBefore: sql`(SELECT ${inventoryColumn} ${guard})`,
      qtyAfter: sql`(SELECT ${inventoryColumn} - ${quantity} ${guard})`,
      reason: null,
      reference: orderId,
      createdBy: customerId,
      createdByName: customerName,
      createdAt: now,
    }),
    guardedUpdate,
  ];
}

export async function createStoreOrder(
  db: AppDb,
  data: StoreOrderData & {
    customerId: string;
    customerName: string;
    deliveryFee: number;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dateStr = now.split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  const orderNumber = `ORD-${dateStr}-${random}`;

  const primaryVariantId =
    data.variantSelections && data.variantSelections.length > 0
      ? data.variantSelections[0].variantId
      : data.variantId ?? null;
  const primaryVariantLabel =
    data.variantSelections && data.variantSelections.length > 0
      ? data.variantSelections[0].variantLabel ?? null
      : data.variantLabel ?? null;

  // ── Resolve phase (reads — no writes yet) ────────────────────────────────

  const activeOffer = await selectApplicableOffer(
    db,
    data.productId,
    data.quantity,
    primaryVariantId,
    data.offerId,
  );

  const finalDeliveryFee =
    activeOffer?.discountType === "free_shipping" ? 0 : data.deliveryFee;

  const price = data.quantity * data.pricePerUnit;

  const lineRows: Array<typeof orderProducts.$inferInsert> = [];

  if (data.variantSelections && data.variantSelections.length > 0) {
    for (const group of groupVariantSelections(data.variantSelections)) {
      const varSkuRow = await db
        .select({ sku: productVariants.sku })
        .from(productVariants)
        .where(eq(productVariants.id, group.variantId))
        .get();
      lineRows.push({
        id: crypto.randomUUID(),
        orderId: id,
        productId: data.productId,
        productName: data.productName,
        variantId: group.variantId,
        variantLabel: group.variantLabel,
        sku: varSkuRow?.sku ?? null,
        quantity: group.count,
        pricePerUnit: data.pricePerUnit,
        lineTotal: group.count * data.pricePerUnit,
        createdAt: now,
      });
    }
  } else {
    let itemSku: string | null = null;
    if (data.variantId) {
      const varSkuRow = await db
        .select({ sku: productVariants.sku })
        .from(productVariants)
        .where(eq(productVariants.id, data.variantId))
        .get();
      itemSku = varSkuRow?.sku ?? null;
    } else {
      const prodSkuRow = await db
        .select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, data.productId))
        .get();
      itemSku = prodSkuRow?.sku ?? null;
    }
    lineRows.push({
      id: crypto.randomUUID(),
      orderId: id,
      productId: data.productId,
      productName: data.productName,
      variantId: data.variantId ?? null,
      variantLabel: data.variantLabel ?? null,
      sku: itemSku,
      quantity: data.quantity,
      pricePerUnit: data.pricePerUnit,
      lineTotal: price,
      createdAt: now,
    });
  }

  let rewardLine: typeof orderProducts.$inferInsert | null = null;
  let rewardDeduct: DeductStockInput | null = null;

  if (activeOffer && activeOffer.discountType !== "free_shipping") {
    let resolvedRewardVariantId: string | null = activeOffer.rewardVariantId ?? null;
    let resolvedRewardVariantLabel: string | null = null;

    if (!resolvedRewardVariantId && activeOffer.rewardProductId === data.productId) {
      resolvedRewardVariantId = primaryVariantId;
      resolvedRewardVariantLabel = primaryVariantLabel;
    } else if (
      !resolvedRewardVariantId &&
      activeOffer.rewardProductId &&
      activeOffer.rewardProductId !== data.productId
    ) {
      const defaultVariant = await db
        .select({ id: productVariants.id, variations: productVariants.variations })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, activeOffer.rewardProductId),
            eq(productVariants.active, true),
          ),
        )
        .orderBy(asc(productVariants.position))
        .get();
      if (defaultVariant) {
        resolvedRewardVariantId = defaultVariant.id;
        resolvedRewardVariantLabel = Object.values(
          JSON.parse(defaultVariant.variations) as Record<string, string>,
        ).join(" / ");
      }
    } else if (resolvedRewardVariantId) {
      const rewardVariantRow = await db
        .select({ variations: productVariants.variations })
        .from(productVariants)
        .where(eq(productVariants.id, resolvedRewardVariantId))
        .get();
      if (rewardVariantRow) {
        resolvedRewardVariantLabel = Object.values(
          JSON.parse(rewardVariantRow.variations) as Record<string, string>,
        ).join(" / ");
      }
    }

    if (activeOffer.rewardProductId) {
      const rewardProductRow = await db
        .select({ name: products.name, trackInventory: products.trackInventory })
        .from(products)
        .where(eq(products.id, activeOffer.rewardProductId))
        .get();

      let rewardInStock = true;
      if (rewardProductRow?.trackInventory) {
        if (resolvedRewardVariantId) {
          const rv = await db
            .select({ inventory: productVariants.inventory })
            .from(productVariants)
            .where(eq(productVariants.id, resolvedRewardVariantId))
            .get();
          rewardInStock = (rv?.inventory ?? 0) >= activeOffer.rewardQuantity;
        } else {
          const rp = await db
            .select({ inventory: products.inventory })
            .from(products)
            .where(eq(products.id, activeOffer.rewardProductId))
            .get();
          rewardInStock = (rp?.inventory ?? 0) >= activeOffer.rewardQuantity;
        }
      }

      if (rewardInStock && rewardProductRow) {
        let rewardSku: string | null = null;
        if (resolvedRewardVariantId) {
          const rv = await db
            .select({ sku: productVariants.sku })
            .from(productVariants)
            .where(eq(productVariants.id, resolvedRewardVariantId))
            .get();
          rewardSku = rv?.sku ?? null;
        } else if (activeOffer.rewardProductId) {
          const rp = await db
            .select({ sku: products.sku })
            .from(products)
            .where(eq(products.id, activeOffer.rewardProductId))
            .get();
          rewardSku = rp?.sku ?? null;
        }
        rewardLine = {
          id: crypto.randomUUID(),
          orderId: id,
          productId: activeOffer.rewardProductId,
          productName: rewardProductRow.name,
          variantId: resolvedRewardVariantId,
          variantLabel: resolvedRewardVariantLabel
            ? `${resolvedRewardVariantLabel} — 🎁 مجاني`
            : "🎁 مجاني",
          sku: rewardSku,
          quantity: activeOffer.rewardQuantity,
          pricePerUnit: 0,
          lineTotal: 0,
          createdAt: now,
        };

        if (rewardProductRow.trackInventory) {
          rewardDeduct = {
            productId: activeOffer.rewardProductId,
            variantId: resolvedRewardVariantId,
            quantity: activeOffer.rewardQuantity,
            orderId: id,
            customerId: data.customerId,
            customerName: data.customerName,
            now,
          };
        }
      }
    }
  }

  const productRow = await db
    .select({ trackInventory: products.trackInventory })
    .from(products)
    .where(eq(products.id, data.productId))
    .get();

  const deductions: DeductStockInput[] = [];
  if (productRow?.trackInventory) {
    if (data.variantSelections && data.variantSelections.length > 0) {
      for (const group of groupVariantSelections(data.variantSelections)) {
        deductions.push({
          productId: data.productId,
          variantId: group.variantId,
          quantity: group.count,
          orderId: id,
          customerId: data.customerId,
          customerName: data.customerName,
          now,
        });
      }
    } else {
      deductions.push({
        productId: data.productId,
        variantId: data.variantId ?? null,
        quantity: data.quantity,
        orderId: id,
        customerId: data.customerId,
        customerName: data.customerName,
        now,
      });
    }
  }
  if (rewardDeduct) deductions.push(rewardDeduct);

  // ── Commit phase (one atomic batch) ──────────────────────────────────────

  const statements: BatchStatement[] = [
    db.insert(orders).values({
      id,
      orderNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      phone: data.phone,
      wilayaId: data.wilayaId,
      communeId: data.communeId,
      address: data.address ?? null,
      price,
      notes: data.notes ?? null,
      status: "new",
      orderType: "online",
      deliveryMethod: "driver",
      deliveryType: data.deliveryType,
      deliveryFee: finalDeliveryFee,
      driverFee: 0,
      codAmount: price + finalDeliveryFee,
      fbc: data.fbc ?? null,
      fbp: data.fbp ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  ];

  for (const line of lineRows) {
    statements.push(db.insert(orderProducts).values(line));
  }
  if (rewardLine) {
    statements.push(db.insert(orderProducts).values(rewardLine));
  }

  statements.push(
    db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId: id,
      status: "new",
      timestamp: now,
      by: null,
    }),
    db
      .update(customers)
      .set({
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${price}`,
        lastOrderAt: now,
      })
      .where(eq(customers.id, data.customerId)),
  );

  for (const input of deductions) {
    statements.push(...buildDeductStatements(db, input));
  }

  await db.batch(statements as [BatchStatement, ...BatchStatement[]]);

  return {
    id,
    orderNumber,
    customerId: data.customerId,
    customerName: data.customerName,
    price,
    deliveryFee: finalDeliveryFee,
  };
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function getApprovedProductReviews(
  db: AppDb,
  storeId: string,
  productId: string,
  limit = 20,
  offset = 0,
) {
  const approvedWhere = and(
    eq(reviews.storeId, storeId),
    eq(reviews.productId, productId),
    eq(reviews.status, "approved"),
  );

  const [rows, countRows] = await db.batch([
    db
      .select()
      .from(reviews)
      .where(approvedWhere)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(reviews).where(approvedWhere),
  ]);

  return { rows, total: countRows[0]?.count ?? 0 };
}

/**
 * Look up an order for the storefront review flow.
 *
 * Matches by the customer-facing order number (not the internal UUID)
 * because the storefront only ever exposes the number to the buyer.
 *
 * Tenancy note: `storeId` is accepted but not applied in the WHERE —
 * orders are isolated by database (one D1 per merchant), so filtering
 * again would be a no-op. The param is kept in the signature so the
 * handler contract stays honest about what scope it expects, and so
 * future multi-store-per-DB work has a single place to wire it up.
 *
 * Returns the internal `id` along with the number so the caller can
 * store the UUID on the review row as the stable FK.
 */
export async function findOrderForReview(
  db: AppDb,
  _storeId: string,
  orderNumber: string,
) {
  const order = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerId: orders.customerId,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.orderNumber, orderNumber))
    .get();

  if (!order) return null;

  return order;
}

export async function getExistingReviewByOrder(db: AppDb, orderId: string) {
  return db.select().from(reviews).where(eq(reviews.orderId, orderId)).get();
}

export async function createReview(
  db: AppDb,
  data: {
    storeId: string;
    productId: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    rating: number;
    title?: string;
    body: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(reviews).values({
    id,
    storeId: data.storeId,
    productId: data.productId,
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    customerName: data.customerName,
    rating: data.rating,
    title: data.title ?? null,
    body: data.body,
    status: "pending",
    helpfulCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

export async function validateOrderSkus(
  db: AppDb,
  productId: string,
  variantId?: string,
  variantSelections?: { variantId: string }[],
): Promise<{ missing: "variant" | "product"; id: string } | null> {
  if (variantSelections && variantSelections.length > 0) {
    const uniqueVariantIds = [...new Set(variantSelections.map((v) => v.variantId))];
    for (const vid of uniqueVariantIds) {
      const row = await db
        .select({ sku: productVariants.sku })
        .from(productVariants)
        .where(eq(productVariants.id, vid))
        .get();
      if (!row?.sku) return { missing: "variant", id: vid };
    }
    return null;
  }

  if (variantId) {
    const row = await db
      .select({ sku: productVariants.sku })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .get();
    if (!row?.sku) return { missing: "variant", id: variantId };
    return null;
  }

  const row = await db
    .select({ sku: products.sku })
    .from(products)
    .where(eq(products.id, productId))
    .get();
  if (!row?.sku) return { missing: "product", id: productId };
  return null;
}
