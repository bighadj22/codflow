/**
 * The catalog rows a basket touches, loaded once.
 *
 * Checkout asks the same three questions of the same rows — does every line
 * have a SKU, is every line in stock, what does every line cost — and each
 * used to load its own copy. D1 bills by rows read and serialises on a single
 * thread, so that was paid for and waited on three times per order.
 *
 * Loading once and passing the result down turns those three questions into
 * pure functions over data: no database, no clock, no ordering constraints,
 * and exhaustively testable. The database work stays in one place, here.
 */

import { eq, and, or, inArray, isNull, lte, gte, desc } from "drizzle-orm";
import { products, productVariants, offers } from "../db/schema";
import type { AppDb } from "../db/client";
import { chunkIds } from "./d1-limits";
import { productIdsOf, variantIdsOf, type CartLine } from "./cart";

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  sku: string | null;
  trackInventory: boolean;
  inventory: number;
  deletedAt: string | null;
  status: string;
  visibility: boolean;
  showInStore: boolean;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  price: number;
  sku: string | null;
  inventory: number;
  variations: string;
  active: boolean;
}

export type CatalogOffer = typeof offers.$inferSelect;

export interface CatalogSnapshot {
  products: Map<string, CatalogProduct>;
  variants: Map<string, CatalogVariant>;
  /** Every scheduled, active offer triggered by something in the basket. */
  offers: CatalogOffer[];
}

const PRODUCT_COLUMNS = {
  id: products.id,
  name: products.name,
  price: products.price,
  sku: products.sku,
  trackInventory: products.trackInventory,
  inventory: products.inventory,
  deletedAt: products.deletedAt,
  status: products.status,
  visibility: products.visibility,
  showInStore: products.showInStore,
} as const;

const VARIANT_COLUMNS = {
  id: productVariants.id,
  productId: productVariants.productId,
  price: productVariants.price,
  sku: productVariants.sku,
  inventory: productVariants.inventory,
  variations: productVariants.variations,
  active: productVariants.active,
} as const;

type BatchStatement = Parameters<AppDb["batch"]>[0][number];

/**
 * One batched round trip, whatever the basket size.
 *
 * `now` is passed in rather than read here so offer scheduling is decided by
 * the caller's clock — the same instant the rest of the order is stamped with,
 * and a value a test can pin.
 */
export async function loadCatalogSnapshot(
  db: AppDb,
  lines: CartLine[],
  now: string,
): Promise<CatalogSnapshot> {
  const productIds = productIdsOf(lines);
  const variantIds = variantIdsOf(lines);

  const productStatements = chunkIds(productIds).map((chunk) =>
    db.select(PRODUCT_COLUMNS).from(products).where(inArray(products.id, chunk)),
  );

  const variantStatements = chunkIds(variantIds).map((chunk) =>
    db
      .select(VARIANT_COLUMNS)
      .from(productVariants)
      .where(inArray(productVariants.id, chunk)),
  );

  // Selection among these is decided in memory — see resolveCartOffers. The
  // database only narrows to what is active and in schedule right now.
  const offerStatements = chunkIds(productIds).map((chunk) =>
    db
      .select()
      .from(offers)
      .where(
        and(
          inArray(offers.triggerProductId, chunk),
          eq(offers.status, "active"),
          or(isNull(offers.startsAt), lte(offers.startsAt, now)),
          or(isNull(offers.endsAt), gte(offers.endsAt, now)),
        ),
      )
      .orderBy(desc(offers.triggerQuantity)),
  );

  const statements = [
    ...productStatements,
    ...variantStatements,
    ...offerStatements,
  ] as unknown as BatchStatement[];

  if (statements.length === 0) {
    return { products: new Map(), variants: new Map(), offers: [] };
  }

  const results = (await db.batch(
    statements as [BatchStatement, ...BatchStatement[]],
  )) as unknown as unknown[][];

  const productEnd = productStatements.length;
  const variantEnd = productEnd + variantStatements.length;

  return {
    products: new Map(
      (results.slice(0, productEnd).flat() as CatalogProduct[]).map((r) => [r.id, r]),
    ),
    variants: new Map(
      (results.slice(productEnd, variantEnd).flat() as CatalogVariant[]).map((r) => [
        r.id,
        r,
      ]),
    ),
    offers: results.slice(variantEnd).flat() as CatalogOffer[],
  };
}

/**
 * Add rows a basket did not reference — a reward product from another part of
 * the catalog, or the default variant of one. Existing entries are never
 * overwritten, so what the basket loaded stays authoritative.
 */
export async function extendSnapshot(
  db: AppDb,
  snapshot: CatalogSnapshot,
  extra: { productIds?: string[]; variantIds?: string[]; variantsOfProducts?: string[] },
): Promise<void> {
  const missingProducts = (extra.productIds ?? []).filter(
    (id) => !snapshot.products.has(id),
  );
  const missingVariants = (extra.variantIds ?? []).filter(
    (id) => !snapshot.variants.has(id),
  );
  const variantsOf = extra.variantsOfProducts ?? [];

  const productStatements = chunkIds(missingProducts).map((chunk) =>
    db.select(PRODUCT_COLUMNS).from(products).where(inArray(products.id, chunk)),
  );
  const variantStatements = chunkIds(missingVariants).map((chunk) =>
    db
      .select(VARIANT_COLUMNS)
      .from(productVariants)
      .where(inArray(productVariants.id, chunk)),
  );
  const siblingStatements = chunkIds(variantsOf).map((chunk) =>
    db
      .select(VARIANT_COLUMNS)
      .from(productVariants)
      .where(
        and(
          inArray(productVariants.productId, chunk),
          eq(productVariants.active, true),
        ),
      ),
  );

  const statements = [
    ...productStatements,
    ...variantStatements,
    ...siblingStatements,
  ] as unknown as BatchStatement[];
  if (statements.length === 0) return;

  const results = (await db.batch(
    statements as [BatchStatement, ...BatchStatement[]],
  )) as unknown as unknown[][];

  const productEnd = productStatements.length;
  for (const row of results.slice(0, productEnd).flat() as CatalogProduct[]) {
    if (!snapshot.products.has(row.id)) snapshot.products.set(row.id, row);
  }
  for (const row of results.slice(productEnd).flat() as CatalogVariant[]) {
    if (!snapshot.variants.has(row.id)) snapshot.variants.set(row.id, row);
  }
}

// ─── Pure questions over the snapshot ────────────────────────────────────────

/**
 * The first line whose SKU is missing, in basket order.
 *
 * A missing SKU is a merchant configuration error, not a shopper error: the
 * order is refused because carriers and stock movements key off it.
 */
export function findMissingSku(
  snapshot: CatalogSnapshot,
  lines: CartLine[],
): { missing: "variant" | "product"; id: string } | null {
  for (const line of lines) {
    if (line.variantId) {
      if (!snapshot.variants.get(line.variantId)?.sku) {
        return { missing: "variant", id: line.variantId };
      }
    } else if (!snapshot.products.get(line.productId)?.sku) {
      return { missing: "product", id: line.productId };
    }
  }
  return null;
}

/**
 * A customer-facing Arabic message naming the first line that cannot be
 * satisfied, or null when the whole basket can.
 *
 * This is a *pre-flight* courtesy so the shopper gets a clear message instead
 * of a rollback. It is NOT the safety net: two shoppers can pass it at the
 * same instant for the last unit. The real guarantee is the guarded deduction
 * in the commit batch, which is race-free.
 *
 * A product the snapshot does not know is passed over rather than blocked —
 * the order engine refuses it for real, with a precise error code.
 */
export function findStockShortfall(
  snapshot: CatalogSnapshot,
  lines: CartLine[],
): string | null {
  const basket = lines.length > 1;

  for (const line of lines) {
    const product = snapshot.products.get(line.productId);
    // trackInventory is the parent's master switch: false exempts the product
    // AND every one of its variants.
    if (!product?.trackInventory) continue;

    if (line.variantId) {
      const available = snapshot.variants.get(line.variantId)?.inventory ?? 0;
      if (available < line.quantity) {
        return basket
          ? `"${product.name}" غير متوفر بالكمية المطلوبة بالخيار المحدد.`
          : "هذا المنتج غير متوفر بالخيار المطلوب. يرجى اختيار خياراً آخر.";
      }
    } else if (product.inventory < line.quantity) {
      return basket
        ? `"${product.name}" غير متوفر بالكمية المطلوبة.`
        : "هذا المنتج غير متوفر حالياً.";
    }
  }

  return null;
}

/** A cart line priced from the catalog, ready to become an order line. */
export interface PricedLine {
  line: CartLine;
  /** Catalog unit price in DZD. Never the client's claim. */
  unitPrice: number;
  lineTotal: number;
  sku: string | null;
}

/**
 * Price every line from the catalog snapshot.
 *
 * Server-authoritative pricing lives here and nowhere else: the client's
 * `pricePerUnit` is display-only and is never consulted. Both the storefront
 * handler (which needs the subtotal to test the free-delivery threshold) and
 * the order engine (which writes the lines) call this, so the number the
 * threshold is judged against and the number the customer is charged cannot
 * drift apart.
 *
 * A soft-deleted product prices at 0 rather than throwing — the order engine
 * refuses it separately, and pricing is not the place to decide sellability.
 */
export function priceCartLines(
  snapshot: CatalogSnapshot,
  lines: CartLine[],
): { priced: PricedLine[]; subtotal: number } {
  const priced: PricedLine[] = [];
  let subtotal = 0;

  for (const line of lines) {
    const product = snapshot.products.get(line.productId);
    const variant = line.variantId ? snapshot.variants.get(line.variantId) : undefined;

    const sellable = product && product.deletedAt === null ? product : undefined;
    const unitPrice = variant ? variant.price : (sellable?.price ?? 0);
    const lineTotal = unitPrice * line.quantity;

    subtotal += lineTotal;
    priced.push({
      line,
      unitPrice,
      lineTotal,
      sku: variant ? variant.sku : (product?.sku ?? null),
    });
  }

  return { priced, subtotal };
}

/** Why a line cannot be ordered, or null when it can. */
export type LineBlocker = "missing" | "unlisted" | "out_of_stock";

/** A cart line as the storefront should display it right now. */
export interface ResolvedLine extends PricedLine {
  productName: string;
  /** Units the shopper may order. null when the product is not stock-tracked. */
  maxQuantity: number | null;
  /** null when the line is orderable as requested. */
  blocker: LineBlocker | null;
}

/**
 * The catalog's current answer for every line in a basket: real price, real
 * availability, and whether it can still be ordered at all.
 *
 * This is what lets the cart drawer tell the truth before the shopper commits.
 * It is the same data the order engine will use, derived from the same
 * snapshot, so the drawer cannot promise something checkout then refuses.
 *
 * `unlisted` covers every catalog gate at once (draft, hidden, invisible,
 * soft-deleted) on purpose: a shopper does not need to know which one, and
 * distinguishing them would leak the merchant's catalog state.
 */
export function resolveCartLines(
  snapshot: CatalogSnapshot,
  lines: CartLine[],
): ResolvedLine[] {
  const { priced } = priceCartLines(snapshot, lines);

  return priced.map((entry) => {
    const { line } = entry;
    const product = snapshot.products.get(line.productId);
    const variant = line.variantId ? snapshot.variants.get(line.variantId) : undefined;

    const sellable =
      product != null &&
      product.deletedAt === null &&
      product.status === "ACTIVE" &&
      product.visibility &&
      product.showInStore &&
      (line.variantId == null || (variant != null && variant.active));

    const maxQuantity = !product?.trackInventory
      ? null
      : line.variantId
        ? (variant?.inventory ?? 0)
        : product.inventory;

    const blocker: LineBlocker | null =
      product == null
        ? "missing"
        : !sellable
          ? "unlisted"
          : maxQuantity != null && maxQuantity < line.quantity
            ? "out_of_stock"
            : null;

    return {
      ...entry,
      productName: product?.name ?? line.productName,
      maxQuantity,
      blocker,
    };
  });
}
