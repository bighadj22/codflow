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

  const [rows, countRows] = await db.batch([
    db
      .select()
      .from(stockMovements)
      .where(whereClause)
      .orderBy(desc(stockMovements.createdAt))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(stockMovements)
      .where(whereClause),
  ]);

  return {
    movements: rows,
    total: countRows[0]?.count ?? 0,
  };
}

// ─── Stock Overview ───────────────────────────────────────────────────────────

interface TrackedSkuRow {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variations: string | null;
  inventory: number;
  low_stock_threshold: number;
  inventory_value: number;
  is_out_of_stock: number;
}

/**
 * One UNION ALL over tracked simple products and tracked active variants.
 * Mirrors the pre-Slice-6 semantics exactly: no status/visibility filter
 * (untracked, soft-deleted, inactive variants, and variants of
 * non-variant products are excluded).
 */
function trackedSkuSql(alertsOnly: boolean) {
  const simpleAlertFilter = alertsOnly
    ? sql` AND (products.inventory <= 0 OR (products.inventory > 0 AND products.inventory <= products.low_stock_threshold))`
    : sql``;
  const variantAlertFilter = alertsOnly
    ? sql` AND (product_variants.inventory <= 0 OR (product_variants.inventory > 0 AND product_variants.inventory <= product_variants.low_stock_threshold))`
    : sql``;

  return sql`
    SELECT products.id AS product_id, NULL AS variant_id, products.name AS product_name,
           NULL AS variations, products.inventory AS inventory,
           products.low_stock_threshold AS low_stock_threshold,
           products.inventory * products.price AS inventory_value,
           products.inventory <= 0 AS is_out_of_stock
    FROM products
    WHERE products.has_variants = 0 AND products.track_inventory = 1 AND products.deleted_at IS NULL${simpleAlertFilter}
    UNION ALL
    SELECT product_variants.product_id, product_variants.id, products.name,
           product_variants.variations, product_variants.inventory,
           product_variants.low_stock_threshold,
           product_variants.inventory * product_variants.price,
           product_variants.inventory <= 0
    FROM product_variants
    INNER JOIN products ON products.id = product_variants.product_id
    WHERE products.has_variants = 1 AND products.track_inventory = 1 AND products.deleted_at IS NULL
      AND product_variants.active = 1${variantAlertFilter}
  `;
}

function toAlertItem(row: TrackedSkuRow): StockAlertItem {
  return {
    productId: row.product_id,
    variantId: row.variant_id,
    productName: row.product_name,
    variantLabel: row.variations
      ? Object.values(JSON.parse(row.variations) as Record<string, string>).join(" / ")
      : null,
    inventory: row.inventory,
    lowStockThreshold: row.low_stock_threshold,
    isOutOfStock: Boolean(row.is_out_of_stock),
  };
}

const SKU_ORDER = sql` ORDER BY is_out_of_stock DESC, inventory ASC, product_id ASC, variant_id ASC`;

export async function getStockOverview(db: AppDb): Promise<StockOverview> {
  const rows = await db.all<TrackedSkuRow>(
    sql`${trackedSkuSql(false)}${SKU_ORDER}`,
  );

  const outOfStockItems: StockAlertItem[] = [];
  const lowStockItems: StockAlertItem[] = [];
  const allItems: StockAlertItem[] = [];
  let totalInventoryValue = 0;

  for (const row of rows) {
    const item = toAlertItem(row);
    totalInventoryValue += row.inventory_value;
    allItems.push(item);
    if (item.isOutOfStock) outOfStockItems.push(item);
    else if (item.inventory <= item.lowStockThreshold) lowStockItems.push(item);
  }

  return {
    totalSkus: allItems.length,
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
  const rows = await db.all<TrackedSkuRow>(
    sql`${trackedSkuSql(true)}${SKU_ORDER} LIMIT ${filters.limit} OFFSET ${filters.offset}`,
  );
  const totalRow = await db.get<{ total: number }>(
    sql`SELECT COUNT(*) AS total FROM (${trackedSkuSql(true)})`,
  );

  return {
    items: rows.map(toAlertItem),
    total: Number(totalRow?.total ?? 0),
  };
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
