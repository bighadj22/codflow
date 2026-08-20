/**
 * Orders Queries
 *
 * Centralized database operations for orders management.
 */

import type { AppDb } from "../db/client";
import {
  orders,
  orderProducts,
  orderStatusHistory,
  customers,
  productVariants,
  products,
  drivers,
  driverCompensations,
  users,
  wilayas,
  communes,
  stockMovements,
  companyShipments,
} from "../db/schema";
import {
  eq,
  desc,
  and,
  like,
  or,
  sql,
  getTableColumns,
  aliasedTable,
} from "drizzle-orm";

const driversAlias = aliasedTable(drivers, "d");

export interface OrderFilters {
  status?: string;
  wilayaId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all orders with optional filtering.
 * Joins wilayas + communes to return Arabic display names.
 */
export async function getAllOrders(db: AppDb, filters: OrderFilters = {}) {
  const conditions = [];

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(orders.status, filters.status));
  }

  if (filters.wilayaId) {
    conditions.push(eq(orders.wilayaId, filters.wilayaId));
  }

  if (filters.search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${filters.search}%`),
        like(orders.customerName, `%${filters.search}%`),
        like(orders.phone, `%${filters.search}%`),
      ),
    );
  }

  return db
    .select({
      ...getTableColumns(orders),
      wilaya: wilayas.nameAr,
      commune: communes.nameAr,
      driverName: sql<
        string | null
      >`CASE WHEN ${driversAlias.firstName} IS NOT NULL THEN ${driversAlias.firstName} || ' ' || ${driversAlias.lastName} ELSE NULL END`,
      hasReview: sql<number>`(SELECT count(*) FROM reviews WHERE reviews.order_id = orders.id)`,
      lastUpdatedBy: sql<
        string | null
      >`(SELECT by FROM order_status_history WHERE order_id = orders.id ORDER BY timestamp DESC LIMIT 1)`,
    })
    .from(orders)
    .leftJoin(wilayas, eq(orders.wilayaId, wilayas.id))
    .leftJoin(communes, eq(orders.communeId, communes.id))
    .leftJoin(driversAlias, eq(orders.driverId, driversAlias.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0)
    .all();
}

export async function getOrderById(db: AppDb, orderId: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();

  if (!order) return null;

  const [orderProductsList, historyRows, shipmentRow] = await Promise.all([
    db.select().from(orderProducts).where(eq(orderProducts.orderId, orderId)).all(),
    db
      .select({
        id: orderStatusHistory.id,
        orderId: orderStatusHistory.orderId,
        status: orderStatusHistory.status,
        timestamp: orderStatusHistory.timestamp,
        by: orderStatusHistory.by,
        byName: users.name,
      })
      .from(orderStatusHistory)
      .leftJoin(users, eq(orderStatusHistory.by, users.id))
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(desc(orderStatusHistory.timestamp))
      .all(),
    db
      .select({ labelUrl: companyShipments.labelUrl })
      .from(companyShipments)
      .where(eq(companyShipments.orderId, orderId))
      .get(),
  ]);

  let driverName: string | null = null;
  if (order.driverId) {
    const driver = await db
      .select({ firstName: drivers.firstName, lastName: drivers.lastName })
      .from(drivers)
      .where(eq(drivers.id, order.driverId))
      .get();
    if (driver) driverName = `${driver.firstName} ${driver.lastName}`.trim();
  }

  const [wilayaRow, communeRow] = await Promise.all([
    order.wilayaId
      ? db
          .select({ nameAr: wilayas.nameAr })
          .from(wilayas)
          .where(eq(wilayas.id, order.wilayaId))
          .get()
      : undefined,
    order.communeId
      ? db
          .select({ nameAr: communes.nameAr })
          .from(communes)
          .where(eq(communes.id, order.communeId))
          .get()
      : undefined,
  ]);

  return {
    ...order,
    wilaya: wilayaRow?.nameAr ?? null,
    commune: communeRow?.nameAr ?? null,
    driverName,
    labelUrl: shipmentRow?.labelUrl ?? null,
    products: orderProductsList,
    statusHistory: historyRows.map((h) => ({
      id: h.id,
      orderId: h.orderId,
      status: h.status,
      timestamp: h.timestamp,
      by: h.by,
      byName: h.byName ?? null,
    })),
  };
}

export async function createOrder(
  db: AppDb,
  orderData: typeof orders.$inferInsert,
  productsData: Array<typeof orderProducts.$inferInsert>,
  actor?: { id: string; name: string } | null,
) {
  await db.insert(orders).values(orderData);

  if (productsData.length > 0) {
    await db.insert(orderProducts).values(productsData);
  }

  await db.insert(orderStatusHistory).values({
    id: crypto.randomUUID(),
    orderId: orderData.id!,
    status: orderData.status!,
    timestamp: orderData.createdAt!,
    by: null,
  });

  await db
    .update(customers)
    .set({
      totalOrders: sql`${customers.totalOrders} + 1`,
      totalSpent: sql`${customers.totalSpent} + ${orderData.price ?? 0}`,
      lastOrderAt: orderData.createdAt,
    })
    .where(eq(customers.id, orderData.customerId));

  const now = orderData.createdAt ?? new Date().toISOString();
  for (const item of productsData) {
    const qty = item.quantity as number;

    const productRow = await db
      .select({ trackInventory: products.trackInventory })
      .from(products)
      .where(eq(products.id, item.productId))
      .get();

    if (!productRow?.trackInventory) continue;

    if (item.variantId) {
      const variantRow = await db
        .select({ inventory: productVariants.inventory })
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .get();

      const qtyBefore = variantRow?.inventory ?? 0;
      const qtyAfter = Math.max(0, qtyBefore - qty);

      await db
        .update(productVariants)
        .set({ inventory: qtyAfter, updatedAt: now })
        .where(eq(productVariants.id, item.variantId));

      await db
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          productId: item.productId,
          variantId: item.variantId,
          type: "ORDER_DEDUCTED",
          delta: -(qtyBefore - qtyAfter),
          qtyBefore,
          qtyAfter,
          reason: null,
          reference: orderData.id ?? null,
          createdBy: actor?.id ?? "system",
          createdByName: actor?.name ?? "النظام",
          createdAt: now,
        })
        .catch((err) =>
          console.error("[stock] Failed to log ORDER_DEDUCTED movement:", err),
        );
    } else {
      const productInventoryRow = await db
        .select({ inventory: products.inventory })
        .from(products)
        .where(eq(products.id, item.productId))
        .get();

      const qtyBefore = productInventoryRow?.inventory ?? 0;
      const qtyAfter = Math.max(0, qtyBefore - qty);

      await db
        .update(products)
        .set({ inventory: qtyAfter, updatedAt: now })
        .where(eq(products.id, item.productId));

      await db
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          productId: item.productId,
          variantId: null,
          type: "ORDER_DEDUCTED",
          delta: -(qtyBefore - qtyAfter),
          qtyBefore,
          qtyAfter,
          reason: null,
          reference: orderData.id ?? null,
          createdBy: actor?.id ?? "system",
          createdByName: actor?.name ?? "النظام",
          createdAt: now,
        })
        .catch((err) =>
          console.error("[stock] Failed to log ORDER_DEDUCTED movement:", err),
        );
    }
  }

  return orderData.id;
}

export async function updateOrderStatus(
  db: AppDb,
  orderId: string,
  newStatus: string,
  userId?: string,
  userName?: string,
) {
  const now = new Date().toISOString();

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();

  await db
    .update(orders)
    .set({
      status: newStatus,
      updatedAt: now,
      ...(newStatus === "delivered" ? { deliveryTime: now } : {}),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderStatusHistory).values({
    id: crypto.randomUUID(),
    orderId,
    status: newStatus,
    timestamp: now,
    by: userId ?? null,
  });

  if (newStatus === "delivered" && order?.driverId) {
    await db
      .update(drivers)
      .set({
        totalDelivered: sql`${drivers.totalDelivered} + 1`,
        totalEarnings: sql`${drivers.totalEarnings} + ${order.driverFee ?? 0}`,
        pendingCash: sql`${drivers.pendingCash} + ${order.codAmount ?? 0}`,
        updatedAt: now,
      })
      .where(eq(drivers.id, order.driverId));
  }

  const terminalStatuses = ["cancelled", "returned"];
  const wasAlreadyTerminal = order ? terminalStatuses.includes(order.status) : false;

  if (!wasAlreadyTerminal && (newStatus === "cancelled" || newStatus === "returned")) {
    // Update customer totalSpent when order is cancelled/returned
    await db
      .update(customers)
      .set({
        totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order?.price ?? 0})`,
      })
      .where(eq(customers.id, order?.customerId ?? ""));

    const movementType =
      newStatus === "cancelled" ? "ORDER_CANCELLED" : "ORDER_RETURNED";

    const ordProductRows = await db
      .select({
        id: orderProducts.id,
        productId: orderProducts.productId,
        variantId: orderProducts.variantId,
        quantity: orderProducts.quantity,
        returnedQuantity: orderProducts.returnedQuantity,
      })
      .from(orderProducts)
      .where(eq(orderProducts.orderId, orderId))
      .all();

    for (const op of ordProductRows) {
      const remaining = op.quantity - (op.returnedQuantity ?? 0);
      if (remaining <= 0) continue;

      const productRow = await db
        .select({ trackInventory: products.trackInventory })
        .from(products)
        .where(eq(products.id, op.productId))
        .get();

      if (!productRow?.trackInventory) continue;

      if (op.variantId) {
        const variantRow = await db
          .select({ inventory: productVariants.inventory })
          .from(productVariants)
          .where(eq(productVariants.id, op.variantId))
          .get();

        const qtyBefore = variantRow?.inventory ?? 0;
        const qtyAfter = qtyBefore + remaining;

        await db
          .update(productVariants)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(productVariants.id, op.variantId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: op.productId,
            variantId: op.variantId,
            type: movementType,
            delta: remaining,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: userId ?? "system",
            createdByName: userName ?? "النظام",
            createdAt: now,
          })
          .catch((err) =>
            console.error("[stock] Failed to log", movementType, "movement:", err),
          );
      } else {
        const productInventoryRow = await db
          .select({ inventory: products.inventory })
          .from(products)
          .where(eq(products.id, op.productId))
          .get();

        const qtyBefore = productInventoryRow?.inventory ?? 0;
        const qtyAfter = qtyBefore + remaining;

        await db
          .update(products)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(products.id, op.productId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: op.productId,
            variantId: null,
            type: movementType,
            delta: remaining,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: userId ?? "system",
            createdByName: userName ?? "النظام",
            createdAt: now,
          })
          .catch((err) =>
            console.error("[stock] Failed to log", movementType, "movement:", err),
          );
      }

      await db
        .update(orderProducts)
        .set({ status: "returned", returnedQuantity: op.quantity })
        .where(eq(orderProducts.id, op.id));
    }
  }

  return true;
}

export async function setOrderProductReturn(
  db: AppDb,
  orderId: string,
  productLineId: string,
  newReturnedQty: number,
  userId?: string,
  userName?: string,
): Promise<{
  id: string;
  status: "fulfilled" | "partially_returned" | "returned";
  returnedQuantity: number;
  quantity: number;
}> {
  const now = new Date().toISOString();

  const line = await db
    .select()
    .from(orderProducts)
    .where(and(eq(orderProducts.id, productLineId), eq(orderProducts.orderId, orderId)))
    .get();

  if (!line) {
    throw new Error(`Order line ${productLineId} not found on order ${orderId}`);
  }

  if (newReturnedQty < 0 || newReturnedQty > line.quantity) {
    throw new Error(
      `returnedQuantity must be between 0 and ${line.quantity} (got ${newReturnedQty})`,
    );
  }

  const currentReturned = line.returnedQuantity ?? 0;
  const delta = newReturnedQty - currentReturned;

  if (delta !== 0) {
    const productRow = await db
      .select({ trackInventory: products.trackInventory })
      .from(products)
      .where(eq(products.id, line.productId))
      .get();

    if (productRow?.trackInventory) {
      if (line.variantId) {
        const variantRow = await db
          .select({ inventory: productVariants.inventory })
          .from(productVariants)
          .where(eq(productVariants.id, line.variantId))
          .get();

        const qtyBefore = variantRow?.inventory ?? 0;
        const qtyAfter = Math.max(0, qtyBefore + delta);

        await db
          .update(productVariants)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(productVariants.id, line.variantId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: line.productId,
            variantId: line.variantId,
            type: "ORDER_RETURNED",
            delta,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: userId ?? "system",
            createdByName: userName ?? "النظام",
            createdAt: now,
          })
          .catch((err) =>
            console.error("[stock] Failed to log ORDER_RETURNED movement:", err),
          );
      } else {
        const productInventoryRow = await db
          .select({ inventory: products.inventory })
          .from(products)
          .where(eq(products.id, line.productId))
          .get();

        const qtyBefore = productInventoryRow?.inventory ?? 0;
        const qtyAfter = Math.max(0, qtyBefore + delta);

        await db
          .update(products)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(products.id, line.productId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: line.productId,
            variantId: null,
            type: "ORDER_RETURNED",
            delta,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: userId ?? "system",
            createdByName: userName ?? "النظام",
            createdAt: now,
          })
          .catch((err) =>
            console.error("[stock] Failed to log ORDER_RETURNED movement:", err),
          );
      }
    }
  }

  const newStatus: "fulfilled" | "partially_returned" | "returned" =
    newReturnedQty === 0
      ? "fulfilled"
      : newReturnedQty === line.quantity
        ? "returned"
        : "partially_returned";

  await db
    .update(orderProducts)
    .set({ status: newStatus, returnedQuantity: newReturnedQty })
    .where(eq(orderProducts.id, productLineId));

  return {
    id: line.id,
    status: newStatus,
    returnedQuantity: newReturnedQty,
    quantity: line.quantity,
  };
}

export async function assignDriver(db: AppDb, orderId: string, driverId: string) {
  const now = new Date().toISOString();

  const order = await db
    .select({ wilayaId: orders.wilayaId, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();

  let driverFee = 0;
  if (order?.wilayaId) {
    const comp = await db
      .select({ feePerDelivery: driverCompensations.feePerDelivery })
      .from(driverCompensations)
      .where(
        and(
          eq(driverCompensations.driverId, driverId),
          eq(driverCompensations.wilayaId, order.wilayaId),
        ),
      )
      .get();

    if (comp) {
      driverFee = comp.feePerDelivery;
    }
  }

  const preAssignmentStatuses = ["new", "preparing", "ready"];
  const shouldSetAssigned = preAssignmentStatuses.includes(order?.status ?? "");

  await db
    .update(orders)
    .set({
      driverId,
      driverFee,
      deliveryMethod: "driver",
      ...(shouldSetAssigned ? { status: "assigned" } : {}),
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  return true;
}

export async function unassignDriver(db: AppDb, orderId: string) {
  const now = new Date().toISOString();

  const order = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();

  const shouldRollbackStatus = order?.status === "assigned";

  await db
    .update(orders)
    .set({
      driverId: null,
      driverFee: 0,
      deliveryMethod: "unassigned",
      ...(shouldRollbackStatus ? { status: "ready" } : {}),
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  return true;
}

export async function assignCompany(db: AppDb, orderId: string, companyId: string) {
  await db
    .update(orders)
    .set({
      companyId,
      deliveryMethod: "company",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
}

export async function syncOrderAfterCarrierUpdate(
  db: AppDb,
  orderId: string,
  fields: { customerName?: string; phone?: string; price?: number },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (fields.customerName !== undefined) patch.customerName = fields.customerName;
  if (fields.phone !== undefined) patch.phone = fields.phone;
  if (fields.price !== undefined) patch.price = fields.price;

  await db.update(orders).set(patch).where(eq(orders.id, orderId));
}

export async function updateOrderTracking(
  db: AppDb,
  orderId: string,
  trackingNumber: string,
  trackingUrl?: string,
) {
  await db
    .update(orders)
    .set({
      trackingNumber,
      trackingUrl: trackingUrl ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
}

export async function clearOrderTracking(db: AppDb, orderId: string) {
  await db
    .update(orders)
    .set({
      trackingNumber: null,
      trackingUrl: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
}

export async function deleteOrder(db: AppDb, orderId: string) {
  const now = new Date().toISOString();
  
  // Get order details first to update customer stats
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();

  // Get order products to restore inventory
  const orderProductsList = await db
    .select()
    .from(orderProducts)
    .where(eq(orderProducts.orderId, orderId))
    .all();

  // Update customer stats BEFORE deleting the order
  if (order) {
    await db
      .update(customers)
      .set({
        totalOrders: sql`MAX(0, ${customers.totalOrders} - 1)`,
        totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order.price ?? 0})`,
      })
      .where(eq(customers.id, order.customerId));
  }

  // Restore inventory for products that track inventory
  for (const op of orderProductsList) {
    const remaining = op.quantity - (op.returnedQuantity ?? 0);
    if (remaining <= 0) continue; // Already returned, no stock to restore

    const productRow = await db
      .select({ trackInventory: products.trackInventory })
      .from(products)
      .where(eq(products.id, op.productId))
      .get();

    if (!productRow?.trackInventory) continue; // Product doesn't track inventory

    if (op.variantId) {
      // Restore variant inventory
      const variantRow = await db
        .select({ inventory: productVariants.inventory })
        .from(productVariants)
        .where(eq(productVariants.id, op.variantId))
        .get();

      const qtyBefore = variantRow?.inventory ?? 0;
      const qtyAfter = qtyBefore + remaining;

      await db
        .update(productVariants)
        .set({ inventory: qtyAfter, updatedAt: now })
        .where(eq(productVariants.id, op.variantId));

      await db
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          productId: op.productId,
          variantId: op.variantId,
          type: "ORDER_CANCELLED",
          delta: remaining,
          qtyBefore,
          qtyAfter,
          reason: "Order deleted - inventory restored",
          reference: orderId,
          createdBy: "system",
          createdByName: "النظام",
          createdAt: now,
        })
        .catch((err) =>
          console.error("[stock] Failed to log ORDER_CANCELLED movement:", err),
        );
    } else {
      // Restore product inventory
      const productInventoryRow = await db
        .select({ inventory: products.inventory })
        .from(products)
        .where(eq(products.id, op.productId))
        .get();

      const qtyBefore = productInventoryRow?.inventory ?? 0;
      const qtyAfter = qtyBefore + remaining;

      await db
        .update(products)
        .set({ inventory: qtyAfter, updatedAt: now })
        .where(eq(products.id, op.productId));

      await db
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          productId: op.productId,
          variantId: null,
          type: "ORDER_CANCELLED",
          delta: remaining,
          qtyBefore,
          qtyAfter,
          reason: "Order deleted - inventory restored",
          reference: orderId,
          createdBy: "system",
          createdByName: "النظام",
          createdAt: now,
        })
        .catch((err) =>
          console.error("[stock] Failed to log ORDER_CANCELLED movement:", err),
        );
    }
  }

  // Delete related records (cascade will handle orderStatusHistory and reviews)
  await db.delete(companyShipments).where(eq(companyShipments.orderId, orderId));
  await db.delete(orderProducts).where(eq(orderProducts.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
}

// ─── Webhook Status Update ────────────────────────────────────────────────────

/**
 * Rank used to guard against webhook-driven status regressions.
 * A webhook event can only advance the order to a higher-ranked status.
 * Delivered, returned, and cancelled are all terminal (rank 6) — no further changes.
 */
const STATUS_RANK: Record<string, number> = {
  new: 0,
  confirmed: 1,
  unreachable: 1,
  preparing: 2,
  ready: 3,
  assigned: 4,
  out_for_delivery: 5,
  delivered: 6,
  returned: 6,
  cancelled: 6,
};

export async function updateOrderStatusWebhook(
  db: AppDb,
  orderId: string,
  newStatus: string,
  source: string,
): Promise<{ updated: boolean }> {
  const now = new Date().toISOString();

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();

  if (!order) return { updated: false };

  const currentRank = STATUS_RANK[order.status] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;

  if (newRank <= currentRank) {
    return { updated: false };
  }

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  };
  if (newStatus === "delivered") {
    updateFields.deliveryTime = now;
  }

  await db.update(orders).set(updateFields).where(eq(orders.id, orderId));

  await db.insert(orderStatusHistory).values({
    id: crypto.randomUUID(),
    orderId,
    status: newStatus,
    timestamp: now,
    by: source,
  });

  if (newStatus === "delivered" && order.driverId) {
    await db
      .update(drivers)
      .set({
        totalDelivered: sql`${drivers.totalDelivered} + 1`,
        totalEarnings: sql`${drivers.totalEarnings} + ${order.driverFee ?? 0}`,
        pendingCash: sql`${drivers.pendingCash} + ${order.codAmount ?? 0}`,
        updatedAt: now,
      })
      .where(eq(drivers.id, order.driverId));
  }

  if (newStatus === "cancelled" || newStatus === "returned") {
    // Update customer totalSpent when order is cancelled/returned via webhook
    await db
      .update(customers)
      .set({
        totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order.price ?? 0})`,
      })
      .where(eq(customers.id, order.customerId));

    const movementType =
      newStatus === "cancelled" ? "ORDER_CANCELLED" : "ORDER_RETURNED";

    const ordProductRows = await db
      .select({
        id: orderProducts.id,
        productId: orderProducts.productId,
        variantId: orderProducts.variantId,
        quantity: orderProducts.quantity,
        returnedQuantity: orderProducts.returnedQuantity,
      })
      .from(orderProducts)
      .where(eq(orderProducts.orderId, orderId))
      .all();

    for (const op of ordProductRows) {
      const remaining = op.quantity - (op.returnedQuantity ?? 0);
      if (remaining <= 0) continue;

      const productRow = await db
        .select({ trackInventory: products.trackInventory })
        .from(products)
        .where(eq(products.id, op.productId))
        .get();

      if (!productRow?.trackInventory) continue;

      if (op.variantId) {
        const variantRow = await db
          .select({ inventory: productVariants.inventory })
          .from(productVariants)
          .where(eq(productVariants.id, op.variantId))
          .get();

        const qtyBefore = variantRow?.inventory ?? 0;
        const qtyAfter = qtyBefore + remaining;

        await db
          .update(productVariants)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(productVariants.id, op.variantId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: op.productId,
            variantId: op.variantId,
            type: movementType,
            delta: remaining,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: source,
            createdByName: source,
            createdAt: now,
          })
          .catch((err) =>
            console.error(
              "[webhook][stock] Failed to log",
              movementType,
              "movement:",
              err,
            ),
          );
      } else {
        const productInventoryRow = await db
          .select({ inventory: products.inventory })
          .from(products)
          .where(eq(products.id, op.productId))
          .get();

        const qtyBefore = productInventoryRow?.inventory ?? 0;
        const qtyAfter = qtyBefore + remaining;

        await db
          .update(products)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(products.id, op.productId));

        await db
          .insert(stockMovements)
          .values({
            id: crypto.randomUUID(),
            productId: op.productId,
            variantId: null,
            type: movementType,
            delta: remaining,
            qtyBefore,
            qtyAfter,
            reason: null,
            reference: orderId,
            createdBy: source,
            createdByName: source,
            createdAt: now,
          })
          .catch((err) =>
            console.error(
              "[webhook][stock] Failed to log",
              movementType,
              "movement:",
              err,
            ),
          );
      }

      await db
        .update(orderProducts)
        .set({ status: "returned", returnedQuantity: op.quantity })
        .where(eq(orderProducts.id, op.id));
    }
  }

  return { updated: true };
}

export async function incrementDeliveryAttempts(
  db: AppDb,
  orderId: string,
): Promise<void> {
  await db
    .update(orders)
    .set({
      deliveryAttempts: sql`${orders.deliveryAttempts} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
}
