/**
 * Stock Queries
 *
 * adjustStock stays in cod-server because it raises NotFoundError / BusinessLogicError.
 */

import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { products, productVariants, stockMovements } from "../db/schema";
import type { AppDb } from "../db/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Movement types, single source of truth for API validation and row typing. */
export const STOCK_MOVEMENT_TYPES = [
  "PURCHASE",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "ORDER_DEDUCTED",
  "ORDER_CANCELLED",
  "ORDER_RETURNED",
  "OFFLINE_SALE",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovementRow {
  id: string;
  productId: string;
  variantId: string | null;
  type: StockMovementType;
  delta: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  reference: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface StockAlertItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  inventory: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
}

export interface StockOverview {
  totalSkus: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalInventoryValue: number;
  currency: string;
  outOfStockItems: StockAlertItem[];
  lowStockItems: StockAlertItem[];
  /** Every tracked SKU regardless of stock level — for the full inventory tab. */
  allItems: StockAlertItem[];
}

export interface StockHistoryFilters {
  variantId?: string;
  limit: number;
  offset: number;
}

export interface StockAlertsFilters {
  limit: number;
  offset: number;
}

export interface UpdateThresholdData {
  lowStockThreshold: number;
}

// ─── Stock History ────────────────────────────────────────────────────────────

export async function getStockHistory(
  db: AppDb,
  productId: string,
  filters: StockHistoryFilters,
): Promise<{ movements: StockMovementRow[]; total: number }> {
  const conditions = [eq(stockMovements.productId, productId)];
  if (filters.variantId) {
    conditions.push(eq(stockMovements.variantId, filters.variantId));
  }

  const whereClause = and(...conditions)!;

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(stockMovements)
      .where(whereClause)
      .orderBy(desc(stockMovements.createdAt))
      .limit(filters.limit)
      .offset(filters.offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(stockMovements)
      .where(whereClause)
      .get(),
  ]);

  return {
    movements: rows,
    total: countRow?.count ?? 0,
  };
}

// ─── Stock Overview ───────────────────────────────────────────────────────────

export async function getStockOverview(db: AppDb): Promise<StockOverview> {
  const simpleProducts = await db
    .select({
      productId: products.id,
      productName: products.name,
      inventory: products.inventory,
      lowStockThreshold: products.lowStockThreshold,
      price: products.price,
    })
    .from(products)
    .where(
      and(
        eq(products.hasVariants, false),
        eq(products.trackInventory, true),
        isNull(products.deletedAt),
      ),
    )
    .all();

  const variantRows = await db
    .select({
      productId: products.id,
      productName: products.name,
      variantId: productVariants.id,
      variations: productVariants.variations,
      inventory: productVariants.inventory,
      lowStockThreshold: productVariants.lowStockThreshold,
      price: productVariants.price,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.hasVariants, true),
        eq(products.trackInventory, true),
        isNull(products.deletedAt),
        eq(productVariants.active, true),
      ),
    )
    .all();

  const outOfStockItems: StockAlertItem[] = [];
  const lowStockItems: StockAlertItem[] = [];
  const allItems: StockAlertItem[] = [];
  let totalInventoryValue = 0;
  let totalSkus = 0;

  for (const p of simpleProducts) {
    totalSkus++;
    totalInventoryValue += p.inventory * p.price;

    const item: StockAlertItem = {
      productId: p.productId,
      variantId: null,
      productName: p.productName,
      variantLabel: null,
      inventory: p.inventory,
      lowStockThreshold: p.lowStockThreshold,
      isOutOfStock: p.inventory <= 0,
    };

    allItems.push(item);
    if (p.inventory <= 0) outOfStockItems.push(item);
    else if (p.inventory <= p.lowStockThreshold) lowStockItems.push(item);
  }

  for (const v of variantRows) {
    totalSkus++;
    totalInventoryValue += v.inventory * v.price;

    const variations = JSON.parse(v.variations) as Record<string, string>;
    const variantLabel = Object.values(variations).join(" / ");

    const item: StockAlertItem = {
      productId: v.productId,
      variantId: v.variantId,
      productName: v.productName,
      variantLabel,
      inventory: v.inventory,
      lowStockThreshold: v.lowStockThreshold,
      isOutOfStock: v.inventory <= 0,
    };

    allItems.push(item);
    if (v.inventory <= 0) outOfStockItems.push(item);
    else if (v.inventory <= v.lowStockThreshold) lowStockItems.push(item);
  }

  allItems.sort((a, b) => {
    if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
    return a.inventory - b.inventory;
  });

  return {
    totalSkus,
    outOfStockCount: outOfStockItems.length,
    lowStockCount: lowStockItems.length,
    totalInventoryValue,
    currency: "DZD",
    outOfStockItems,
    lowStockItems,
    allItems,
  };
}

// ─── Stock Alerts ─────────────────────────────────────────────────────────────

export async function getStockAlerts(
  db: AppDb,
  filters: StockAlertsFilters,
): Promise<{ items: StockAlertItem[]; total: number }> {
  const overview = await getStockOverview(db);
  const all = [...overview.outOfStockItems, ...overview.lowStockItems];
  all.sort((a, b) => {
    if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
    return a.inventory - b.inventory;
  });

  const total = all.length;
  const items = all.slice(filters.offset, filters.offset + filters.limit);
  return { items, total };
}

// ─── Update Threshold ─────────────────────────────────────────────────────────

export async function updateProductThreshold(
  db: AppDb,
  productId: string,
  data: UpdateThresholdData,
): Promise<boolean> {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .get();
  if (!existing) return false;

  await db
    .update(products)
    .set({ lowStockThreshold: data.lowStockThreshold, updatedAt: new Date().toISOString() })
    .where(eq(products.id, productId));
  return true;
}

export async function updateVariantThreshold(
  db: AppDb,
  variantId: string,
  productId: string,
  data: UpdateThresholdData,
): Promise<boolean> {
  const existing = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .get();
  if (!existing) return false;

  await db
    .update(productVariants)
    .set({ lowStockThreshold: data.lowStockThreshold, updatedAt: new Date().toISOString() })
    .where(eq(productVariants.id, variantId));
  return true;
}

// ─── Internal helper (exposed for server-side adjustStock) ───────────────────

export async function getProductInventory(
  db: AppDb,
  productId: string,
  variantId: string | null,
): Promise<{ inventory: number; exists: boolean }> {
  if (variantId) {
    const row = await db
      .select({ inventory: productVariants.inventory })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
        ),
      )
      .get();
    return row ? { inventory: row.inventory, exists: true } : { inventory: 0, exists: false };
  }

  const row = await db
    .select({ inventory: products.inventory })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .get();
  return row ? { inventory: row.inventory, exists: true } : { inventory: 0, exists: false };
}
