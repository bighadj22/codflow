/**
 * Stock Database Queries
 *
 * Pure reads + threshold updates live in cod-shared.
 * adjustStock stays here because it raises NotFoundError / BusinessLogicError.
 */

import { eq } from "drizzle-orm";
import { products, productVariants, stockMovements } from "@/db/schema";
import type { AppDb } from "@/db";
import type { AdjustStockInput } from "./validation";
import { NotFoundError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { getProductInventory } from "../../../../cod-shared/queries/stock";

export {
  getStockHistory,
  getStockOverview,
  getStockAlerts,
  updateProductThreshold,
  updateVariantThreshold,
} from "../../../../cod-shared/queries/stock";

export type {
  StockMovementRow,
  StockAlertItem,
  StockOverview,
} from "../../../../cod-shared/queries/stock";

// ─── Adjust Stock ─────────────────────────────────────────────────────────────

import type { StockMovementRow } from "../../../../cod-shared/queries/stock";

export async function adjustStock(
  db: AppDb,
  params: {
    productId: string;
    variantId: string | null;
    createdBy: string;
    createdByName: string;
    reference?: string | null;
  } & AdjustStockInput,
): Promise<{ movement: StockMovementRow; currentInventory: number }> {
  const { productId, variantId, type, delta, reason, createdBy, createdByName, reference } = params;

  const { inventory: qtyBefore, exists } = await getProductInventory(db, productId, variantId ?? null);

  if (!exists) {
    if (variantId) {
      throw new NotFoundError("Variant", variantId);
    } else {
      throw new NotFoundError("Product", productId);
    }
  }

  const qtyAfter = qtyBefore + delta;
  if (qtyAfter < 0) {
    const productRow = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .get();

    throw new BusinessLogicError(
      `Insufficient stock for ${productRow?.name ?? "product"}. Available: ${qtyBefore}, Required: ${Math.abs(delta)}`,
      ERROR_CODES.INSUFFICIENT_STOCK,
      {
        stockId: variantId ?? productId,
        productName: productRow?.name ?? null,
        available: qtyBefore,
        required: Math.abs(delta),
      },
    );
  }

  const now = new Date().toISOString();

  if (variantId) {
    await db
      .update(productVariants)
      .set({ inventory: qtyAfter, updatedAt: now })
      .where(eq(productVariants.id, variantId));
  } else {
    await db
      .update(products)
      .set({ inventory: qtyAfter, updatedAt: now })
      .where(eq(products.id, productId));
  }

  const movementId = crypto.randomUUID();
  await db.insert(stockMovements).values({
    id: movementId,
    productId,
    variantId: variantId ?? null,
    type,
    delta,
    qtyBefore,
    qtyAfter,
    reason: reason ?? null,
    reference: reference ?? null,
    createdBy,
    createdByName,
    createdAt: now,
  });

  const movement: StockMovementRow = {
    id: movementId,
    productId,
    variantId: variantId ?? null,
    type,
    delta,
    qtyBefore,
    qtyAfter,
    reason: reason ?? null,
    reference: reference ?? null,
    createdBy,
    createdByName,
    createdAt: now,
  };

  return { movement, currentInventory: qtyAfter };
}
