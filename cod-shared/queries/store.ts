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
  storeOtpConfig,
  storeTurnstileConfig,
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
import { deriveDescriptionPlain } from "./products";
import { resolveDeliveryFee } from "./shipping-resolution";
import { normalizeOrderLines } from "./cart";
import { resolvePublicTracking } from "./tracking-config";
import { chunkIds } from "./d1-limits";
import { getFooterPages, getPublicLegalContact } from "./store-pages";
import type { PageLocale } from "../legal/kinds";
import {
  loadCatalogSnapshot,
  extendSnapshot,
  priceCartLines,
  type CatalogSnapshot,
} from "./catalog-snapshot";
import { resolveCartOffers } from "./offers-cart";

export interface StoreOrderData {
  customerName: string;
  phone: string;
  wilayaId: number;
  communeId: string;
  address?: string;
  deliveryType: "home" | "stop_desk";
  /**
   * The one product a direct order form was rendered for. Absent on a basket
   * order, which has no single representative product — `items[]` carries the
   * truth then, and normalizeOrderLines ignores these outright.
   */
  productId?: string;
  productName?: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  /** Display-only, and absent on a basket order. Pricing comes from the catalog. */
  pricePerUnit?: number;
  notes?: string;
  offerId?: string;
  variantSelections?: Array<{ variantId: string; variantLabel?: string }>;
  /**
   * Cart request shape. When present it supersedes the flat product fields —
   * see normalizeOrderLines, which is the only place the three shapes meet.
   */
  items?: Array<{
    productId: string;
    productName: string;
    variantId?: string | null;
    variantLabel?: string | null;
    quantity: number;
    offerId?: string;
  }>;
  /** Resolved landing page id — set by the caller from landingPageSlug (best-effort). */
  landingPageId?: string | null;
  fbc?: string;
  fbp?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function getStoreConfig(db: AppDb, storeId: string) {
  const store = await db.select().from(stores).where(eq(stores.id, storeId)).get();
  if (!store) return null;
  const [tracking, otpRow, turnstileRow, pages, legalContact] = await Promise.all([
    // Which pixel this storefront loads is resolved in one place for every
    // sender — see queries/tracking-config.ts. The public accessor cannot
    // return the Conversions API token, which is what keeps it out of the
    // storefront payload structurally rather than by care.
    resolvePublicTracking(db, { storeId }),
    db
      .select({ enabled: storeOtpConfig.enabled })
      .from(storeOtpConfig)
      .where(eq(storeOtpConfig.storeId, storeId))
      .get(),
    // Safe projection only — the site key is public by design; the siteverify
    // secret must never reach the storefront payload.
    db
      .select({ enabled: storeTurnstileConfig.enabled, siteKey: storeTurnstileConfig.siteKey })
      .from(storeTurnstileConfig)
      .where(eq(storeTurnstileConfig.storeId, storeId))
      .get(),
    // The footer renders on every page, so its link list rides along here
    // rather than costing a second round trip per page view (plan D6/R7).
    getFooterPages(db, storeId, store.lang as PageLocale),
    getPublicLegalContact(db, storeId),
  ]);
  return {
    ...store,
    pixelId: tracking.pixelId,
    conversionEvent: tracking.conversionEvent,
    pages,
    legalContact,
    otpEnabled: otpRow?.enabled === true,
    turnstileEnabled: turnstileRow?.enabled === true,
    turnstileSiteKey: turnstileRow?.enabled === true ? turnstileRow.siteKey : null,
  };
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

  return Promise.all(rows.map(async (p) => {
    const { avgRating, reviewCount, ...productData } = p;
    const inventory = productData.hasVariants
      ? variantInventoryByProduct.get(p.id) ?? 0
      : productData.inventory;
    return {
      ...productData,
      inventory,
      descriptionPlain: await deriveDescriptionPlain(p.description, p.descriptionFormat),
      coverImage: coverImageByProduct.get(p.id) ?? null,
      reviewStats:
        reviewCount > 0 ? { avgRating: avgRating ?? 0, reviewCount } : null,
    };
  }));
}

/**
 * Resolve a product by handle in its full store-product shape.
 *
 * The four catalog green lights apply by default (status=ACTIVE, visibility,
 * showInStore, not soft-deleted). `allowUnlisted` drops ONLY the showInStore
 * gate — landing pages link their product deliberately, so a store-hidden
 * (unlisted) product still renders there; the other gates still apply.
 */
export async function getStoreProductByHandle(
  db: AppDb,
  handle: string,
  opts?: { allowUnlisted?: boolean },
) {
  const conditions = [
    eq(products.handle, handle),
    eq(products.status, "ACTIVE"),
    eq(products.visibility, true),
    isNull(products.deletedAt),
  ];
  if (!opts?.allowUnlisted) conditions.push(eq(products.showInStore, true));

  const product = await db
    .select()
    .from(products)
    .where(and(...conditions))
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
    descriptionPlain: await deriveDescriptionPlain(product.description, product.descriptionFormat),
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

/**
 * Wilaya-only delivery fee against the store's DEFAULT profile.
 *
 * Narrow adapter over resolveDeliveryFee for callers with no product or
 * commune context. Order placement must NOT use this: it cannot see a
 * product's own shipping profile or a commune-level override, both of which
 * change what the customer is charged. Use resolveDeliveryFee there.
 *
 * Returns:
 *  - the fee (DZD, may be 0 for a legitimately-free price) when available
 *  - null when delivery is NOT available: a default profile exists but the
 *    wilaya has no rule, or the rule disables the requested delivery type.
 *    Callers must refuse the order — charging 0 silently would ship for free.
 *  - 0 when NO shipping profile exists at all (fresh store, no config) —
 *    mirrors the dashboard resolve-fee semantics (step 3: no profile, no
 *    restriction).
 */
export async function getDeliveryFee(
  db: AppDb,
  wilayaId: number,
  deliveryType: "home" | "stop_desk",
): Promise<number | null> {
  return resolveDeliveryFee(db, {
    productIds: [],
    wilayaId,
    communeId: null,
    deliveryType,
  });
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
  /**
   * Catalog rows already loaded by the caller. The storefront handler loads
   * them once for the SKU and stock checks and passes the same snapshot here,
   * so a checkout reads each product row once rather than once per question.
   * Omitted (tests, other callers) the engine loads its own.
   */
  preloaded?: CatalogSnapshot,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dateStr = now.split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  const orderNumber = `ORD-${dateStr}-${random}`;

  // Every accepted request shape becomes one list here. The engine below knows
  // nothing about legacy fields, variantSelections, or carts.
  const lines = normalizeOrderLines(data);

  // ── Resolve phase (reads — one batched round trip, or none when shared) ───
  const snapshot = preloaded ?? (await loadCatalogSnapshot(db, lines, now));

  // Server-authoritative pricing: the catalog row is the ONLY source of a unit
  // price. The client's pricePerUnit is display-only and NEVER trusted — it
  // arrives over plain HTTP and is trivially editable.
  const { priced, subtotal: price } = priceCartLines(snapshot, lines);
  const lineRows: Array<typeof orderProducts.$inferInsert> = priced.map((p) => ({
    id: crypto.randomUUID(),
    orderId: id,
    productId: p.line.productId,
    productName: p.line.productName,
    variantId: p.line.variantId,
    variantLabel: p.line.variantLabel,
    sku: p.sku,
    quantity: p.line.quantity,
    pricePerUnit: p.unitPrice,
    lineTotal: p.lineTotal,
    createdAt: now,
  }));

  const { earned, freeShipping } = resolveCartOffers(lines, snapshot.offers);
  const finalDeliveryFee = freeShipping ? 0 : data.deliveryFee;

  // ── Reward lines ─────────────────────────────────────────────────────────
  //
  // A reward whose stock cannot cover it is skipped and the order still
  // succeeds: revenue first, promotion second. That is the existing contract.
  const rewardLines: Array<typeof orderProducts.$inferInsert> = [];
  const rewardDeducts: DeductStockInput[] = [];

  // Rewards can point outside the basket — another product, a specific variant,
  // or "the default variant of that product". One batched top-up covers all
  // three; a basket whose rewards are all in-basket adds no round trip at all.
  if (earned.length > 0) {
    await extendSnapshot(db, snapshot, {
      productIds: earned
        .map((e) => e.offer.rewardProductId)
        .filter((id): id is string => !!id),
      variantIds: earned
        .map((e) => e.offer.rewardVariantId)
        .filter((id): id is string => !!id),
      variantsOfProducts: earned
        .filter((e) => e.offer.rewardProductId && !e.offer.rewardVariantId)
        .map((e) => e.offer.rewardProductId!),
    });
  }

  const defaultVariantFor = (productId: string) =>
    [...snapshot.variants.values()]
      .filter((v) => v.productId === productId && v.active)
      .sort((a, b) => a.id.localeCompare(b.id))[0];

  const labelOf = (variations: string | undefined) => {
    if (!variations) return null;
    try {
      return Object.values(JSON.parse(variations) as Record<string, string>).join(" / ");
    } catch {
      return null;
    }
  };

  for (const { offer, line } of earned) {
    if (!offer.rewardProductId) continue;
    const rewardProduct = snapshot.products.get(offer.rewardProductId);
    if (!rewardProduct) continue;

    let rewardVariantId: string | null = offer.rewardVariantId ?? null;
    let rewardVariantLabel: string | null = null;

    if (!rewardVariantId && offer.rewardProductId === line.productId) {
      // Reward is the product ordered — mirror the variant the shopper chose.
      rewardVariantId = line.variantId;
      rewardVariantLabel = line.variantLabel;
    } else if (!rewardVariantId) {
      const fallback = defaultVariantFor(offer.rewardProductId);
      if (fallback) {
        rewardVariantId = fallback.id;
        rewardVariantLabel = labelOf(fallback.variations);
      }
    }

    const rewardVariant = rewardVariantId ? snapshot.variants.get(rewardVariantId) : undefined;
    if (rewardVariantId && !rewardVariantLabel) {
      rewardVariantLabel = labelOf(rewardVariant?.variations);
    }

    if (rewardProduct.trackInventory) {
      const available = rewardVariantId
        ? (rewardVariant?.inventory ?? 0)
        : rewardProduct.inventory;
      if (available < offer.rewardQuantity) continue; // silently skipped
    }

    rewardLines.push({
      id: crypto.randomUUID(),
      orderId: id,
      productId: offer.rewardProductId,
      productName: rewardProduct.name,
      variantId: rewardVariantId,
      variantLabel: rewardVariantLabel
        ? `${rewardVariantLabel} — 🎁 مجاني`
        : "🎁 مجاني",
      sku: rewardVariantId ? (rewardVariant?.sku ?? null) : rewardProduct.sku,
      quantity: offer.rewardQuantity,
      pricePerUnit: 0,
      lineTotal: 0,
      createdAt: now,
    });

    if (rewardProduct.trackInventory) {
      rewardDeducts.push({
        productId: offer.rewardProductId,
        variantId: rewardVariantId,
        quantity: offer.rewardQuantity,
        orderId: id,
        customerId: data.customerId,
        customerName: data.customerName,
        now,
      });
    }
  }

  // ── Stock deductions ─────────────────────────────────────────────────────
  //
  // trackInventory is the parent product's master switch: false excludes the
  // product AND all of its variants from stock entirely.
  const deductions: DeductStockInput[] = [];
  for (const line of lines) {
    const product = snapshot.products.get(line.productId);
    if (!product?.trackInventory) continue;
    deductions.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      orderId: id,
      customerId: data.customerId,
      customerName: data.customerName,
      now,
    });
  }
  deductions.push(...rewardDeducts);

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
      landingPageId: data.landingPageId ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  ];

  for (const line of [...lineRows, ...rewardLines]) {
    statements.push(db.insert(orderProducts).values(line));
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

