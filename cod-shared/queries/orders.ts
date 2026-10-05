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
  companyApiLogs,
  webhookEvents,
} from "../db/schema";
import type { OrderStatus } from "../db/schema";
import {
  eq,
  ne,
  desc,
  and,
  like,
  or,
  sql,
  getTableColumns,
  aliasedTable,
} from "drizzle-orm";

const driversAlias = aliasedTable(drivers, "d");

import { safeLikeTerm } from "./search";
import { getCustomerByPhone, updateCustomer, type UpdateCustomerData } from "./customers";

export interface OrderFilters {
  status?: (typeof orders.$inferSelect)["status"] | "all";
  wilayaId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  /**
   * Opaque keyset cursor (encodeOrderCursor output): return rows strictly
   * before (createdAt, id). Takes precedence over offset when set.
   */
  cursor?: string;
}

export function encodeOrderCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function parseOrderCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const b64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64);
    const sep = decoded.lastIndexOf("|");
    if (sep <= 0) return null;
    const createdAt = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!id) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
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
    const term = `%${safeLikeTerm(filters.search)}%`;
    conditions.push(
      or(
        like(orders.orderNumber, term),
        like(orders.customerName, term),
        like(orders.phone, term),
      ),
    );
  }

  let offset = filters.offset ?? 0;
  if (filters.cursor) {
    const after = parseOrderCursor(filters.cursor);
    if (after) {
      conditions.push(
        sql`(orders.created_at, orders.id) < (${after.createdAt}, ${after.id})`,
      );
      offset = 0;
    }
  }

  return db
    .select({
      ...getTableColumns(orders),
      wilaya: wilayas.nameAr,
      commune: communes.nameAr,
      driverName: sql<
        string | null
      >`CASE WHEN ${driversAlias.firstName} IS NOT NULL THEN ${driversAlias.firstName} || ' ' || ${driversAlias.lastName} ELSE NULL END`,
      hasReview: sql<number>`EXISTS (SELECT 1 FROM reviews WHERE reviews.order_id = orders.id)`,
      lastUpdatedBy: sql<
        string | null
      >`(SELECT by FROM order_status_history WHERE order_id = orders.id ORDER BY timestamp DESC LIMIT 1)`,
    })
    .from(orders)
    .leftJoin(wilayas, eq(orders.wilayaId, wilayas.id))
    .leftJoin(communes, eq(orders.communeId, communes.id))
    .leftJoin(driversAlias, eq(orders.driverId, driversAlias.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(filters.limit ?? 50)
    .offset(offset)
    .all();
}

// ─── Customer delivery history (order detail badge) ──────────────────────────

/**
 * How this customer's OTHER orders ended. Customers are unique per phone
 * (idx_customers_phone_unique), so customer_id is the phone's identity and
 * the lookup rides idx_orders_customer.
 *
 * `total` counts every other order; the three outcome counts cover only
 * terminal orders, so `total - delivered - returned - cancelled` is the
 * number still in progress.
 */
export interface CustomerOrderHistory {
  total: number;
  delivered: number;
  returned: number;
  cancelled: number;
}

/** Per-status counts of the customer's orders, excluding `excludeOrderId`. */
export function customerOrderStatusCountsQuery(
  db: AppDb,
  customerId: string,
  excludeOrderId: string,
) {
  return db
    .select({
      status: orders.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), ne(orders.id, excludeOrderId)))
    .groupBy(orders.status);
}

/** Fold per-status count rows into the history summary. */
export function summarizeCustomerHistory(
  rows: Array<{ status: OrderStatus; count: number }>,
): CustomerOrderHistory {
  const history: CustomerOrderHistory = { total: 0, delivered: 0, returned: 0, cancelled: 0 };
  for (const row of rows) {
    const count = Number(row.count) || 0;
    history.total += count;
    if (row.status === "delivered") history.delivered += count;
    else if (row.status === "returned") history.returned += count;
    else if (row.status === "cancelled") history.cancelled += count;
  }
  return history;
}

export async function getOrderById(db: AppDb, orderId: string) {
  const order = await db
    .select({
      ...getTableColumns(orders),
      wilaya: wilayas.nameAr,
      commune: communes.nameAr,
      driverName: sql<
        string | null
      >`CASE WHEN ${driversAlias.firstName} IS NOT NULL THEN ${driversAlias.firstName} || ' ' || ${driversAlias.lastName} ELSE NULL END`,
      labelUrl: companyShipments.labelUrl,
    })
    .from(orders)
    .leftJoin(wilayas, eq(orders.wilayaId, wilayas.id))
    .leftJoin(communes, eq(orders.communeId, communes.id))
    .leftJoin(driversAlias, eq(orders.driverId, driversAlias.id))
    .leftJoin(companyShipments, eq(companyShipments.orderId, orders.id))
    .where(eq(orders.id, orderId))
    .get();

  if (!order) return null;

  const [orderProductsList, historyRows, customerStatusRows] = await db.batch([
    db.select().from(orderProducts).where(eq(orderProducts.orderId, orderId)),
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
      .orderBy(desc(orderStatusHistory.timestamp)),
    customerOrderStatusCountsQuery(db, order.customerId, orderId),
  ]);

  return {
    ...order,
    customerHistory: summarizeCustomerHistory(customerStatusRows),
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
  const now = orderData.createdAt ?? new Date().toISOString();

  const statements: BatchStatement[] = [
    db.insert(orders).values(orderData),
  ];

  if (productsData.length > 0) {
    statements.push(db.insert(orderProducts).values(productsData));
  }

  statements.push(
    db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId: orderData.id!,
      status: orderData.status!,
      timestamp: orderData.createdAt!,
      by: null,
    }),
  );

  statements.push(
    db
      .update(customers)
      .set({
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${orderData.price ?? 0}`,
        lastOrderAt: orderData.createdAt,
      })
      .where(eq(customers.id, orderData.customerId)),
  );

  for (const item of productsData) {
    const qty = item.quantity as number;

    const productRow = await db
      .select({ trackInventory: products.trackInventory })
      .from(products)
      .where(eq(products.id, item.productId))
      .get();

    if (!productRow?.trackInventory) continue;

    // Guarded deduction, same pattern as the storefront path: the movement's
    // qtyBefore/qtyAfter are subselects guarded by inventory >= qty. When
    // stock is insufficient (or a concurrent writer already took it), the
    // subselects return NULL, the movement insert violates NOT NULL, and the
    // ENTIRE batch rolls back — no oversell floor, no lost-update race.
    if (item.variantId) {
      statements.push(
        db.insert(stockMovements).values({
          id: crypto.randomUUID(),
          productId: item.productId,
          variantId: item.variantId,
          type: "ORDER_DEDUCTED",
          delta: -qty,
          qtyBefore: sql`(SELECT inventory FROM product_variants WHERE id = ${item.variantId} AND inventory >= ${qty})`,
          qtyAfter: sql`(SELECT inventory - ${qty} FROM product_variants WHERE id = ${item.variantId} AND inventory >= ${qty})`,
          reason: null,
          reference: orderData.id ?? null,
          createdBy: actor?.id ?? "system",
          createdByName: actor?.name ?? "النظام",
          createdAt: now,
        }),
      );
      statements.push(
        db
          .update(productVariants)
          .set({
            inventory: sql`${productVariants.inventory} - ${qty}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              sql`${productVariants.inventory} >= ${qty}`,
            ),
          ),
      );
    } else {
      statements.push(
        db.insert(stockMovements).values({
          id: crypto.randomUUID(),
          productId: item.productId,
          variantId: null,
          type: "ORDER_DEDUCTED",
          delta: -qty,
          qtyBefore: sql`(SELECT inventory FROM products WHERE id = ${item.productId} AND inventory >= ${qty})`,
          qtyAfter: sql`(SELECT inventory - ${qty} FROM products WHERE id = ${item.productId} AND inventory >= ${qty})`,
          reason: null,
          reference: orderData.id ?? null,
          createdBy: actor?.id ?? "system",
          createdByName: actor?.name ?? "النظام",
          createdAt: now,
        }),
      );
      statements.push(
        db
          .update(products)
          .set({
            inventory: sql`${products.inventory} - ${qty}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(products.id, item.productId),
              sql`${products.inventory} >= ${qty}`,
            ),
          ),
      );
    }
  }

  // Atomic: order row, lines, history, customer stats, stock deduction, and
  // ledger commit together or not at all. Guarded deductions make the batch
  // fail (and roll back entirely) when stock is insufficient — no silent
  // floor-at-zero, no lost-update races.
  await db.batch(statements as [BatchStatement, ...BatchStatement[]]);

  return orderData.id;
}

export async function updateOrderStatus(
  db: AppDb,
  orderId: string,
  newStatus: OrderStatus,
  userId?: string,
  userName?: string,
) {
  const now = new Date().toISOString();

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();

  const statements: BatchStatement[] = [
    db
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: now,
        ...(newStatus === "delivered" ? { deliveryTime: now } : {}),
      })
      .where(eq(orders.id, orderId)),

    db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId,
      status: newStatus,
      timestamp: now,
      by: userId ?? null,
    }),
  ];

  if (newStatus === "delivered" && order?.driverId) {
    statements.push(
      db
        .update(drivers)
        .set({
          totalDelivered: sql`${drivers.totalDelivered} + 1`,
          totalEarnings: sql`${drivers.totalEarnings} + ${order.driverFee ?? 0}`,
          pendingCash: sql`${drivers.pendingCash} + ${order.codAmount ?? 0}`,
          updatedAt: now,
        })
        .where(eq(drivers.id, order.driverId)),
    );
  }

  const terminalStatuses = ["cancelled", "returned"];
  const wasAlreadyTerminal = order ? terminalStatuses.includes(order.status) : false;

  if (!wasAlreadyTerminal && (newStatus === "cancelled" || newStatus === "returned")) {
    // Update customer totalSpent when order is cancelled/returned
    statements.push(
      db
        .update(customers)
        .set({
          totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order?.price ?? 0})`,
        })
        .where(eq(customers.id, order?.customerId ?? "")),
    );

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

        statements.push(
          db
            .update(productVariants)
            .set({ inventory: qtyAfter, updatedAt: now })
            .where(eq(productVariants.id, op.variantId)),
        );

        statements.push(
          db.insert(stockMovements).values({
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
          }),
        );
      } else {
        const productInventoryRow = await db
          .select({ inventory: products.inventory })
          .from(products)
          .where(eq(products.id, op.productId))
          .get();

        const qtyBefore = productInventoryRow?.inventory ?? 0;
        const qtyAfter = qtyBefore + remaining;

        statements.push(
          db
            .update(products)
            .set({ inventory: qtyAfter, updatedAt: now })
            .where(eq(products.id, op.productId)),
        );

        statements.push(
          db.insert(stockMovements).values({
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
          }),
        );
      }

      statements.push(
        db
          .update(orderProducts)
          .set({ status: "returned", returnedQuantity: op.quantity })
          .where(eq(orderProducts.id, op.id)),
      );
    }
  }

  // Atomic: status, history, driver credit, customer stats, restock, and line
  // returns commit together or not at all. Without the batch, a mid-sequence
  // failure committed "cancelled" without the restock — and the
  // wasAlreadyTerminal guard then blocked every retry, permanently losing
  // the inventory.
  await db.batch(statements as [BatchStatement, ...BatchStatement[]]);

  return true;
}

export interface UpdateOrderData {
  customerName?: string;
  phone?: string;
  /** null clears the email; undefined leaves it untouched. */
  customerEmail?: string | null;
  wilayaId?: number;
  communeId?: string;
  city?: string | null;
  /** null clears the address; undefined leaves it untouched. */
  address?: string | null;
  deliveryType?: "home" | "stop_desk";
  notes?: string | null;
}

/**
 * Partial edit of an order's customer/destination fields. Identity (id,
 * orderNumber), pricing, and dispatch state are deliberately not patchable —
 * pricing is fixed at creation and post-dispatch edits go through the
 * carrier-aware shipment-operations path.
 *
 * The linked customer record is kept in sync in the same operation: name,
 * phone, wilaya/commune, and address edits flow into `customers`, so an order
 * and its customer never disagree on who they belong to (phone is the
 * customer identity). Only fields this edit actually changes are written.
 * When the corrected phone already belongs to a different customer record,
 * the order is re-pointed to that record instead of hijacking its phone.
 * customerEmail is order-only — customers have no email column.
 */
export async function updateOrder(
  db: AppDb,
  orderId: string,
  updates: UpdateOrderData,
) {
  const current = await db
    .select({
      customerId: orders.customerId,
      customerName: orders.customerName,
      phone: orders.phone,
      wilayaId: orders.wilayaId,
      communeId: orders.communeId,
      address: orders.address,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (updates.customerName !== undefined) patch.customerName = updates.customerName;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.customerEmail !== undefined) patch.customerEmail = updates.customerEmail;
  if (updates.wilayaId !== undefined) patch.wilayaId = updates.wilayaId;
  if (updates.communeId !== undefined) patch.communeId = updates.communeId;
  if (updates.city !== undefined) patch.city = updates.city;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.deliveryType !== undefined) patch.deliveryType = updates.deliveryType;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  const customerUpdates: UpdateCustomerData = {};
  if (current) {
    if (updates.customerName !== undefined && updates.customerName !== current.customerName) {
      customerUpdates.name = updates.customerName;
    }
    if (updates.wilayaId !== undefined && updates.wilayaId !== current.wilayaId) {
      customerUpdates.wilayaId = updates.wilayaId;
    }
    if (updates.communeId !== undefined && updates.communeId !== current.communeId) {
      customerUpdates.communeId = updates.communeId;
    }
    if (updates.address !== undefined && (updates.address ?? null) !== (current.address ?? null)) {
      customerUpdates.address = updates.address ?? null;
    }

    if (updates.phone !== undefined && updates.phone !== current.phone) {
      const phoneOwner = await getCustomerByPhone(db, updates.phone);
      if (phoneOwner && phoneOwner.id !== current.customerId) {
        // The corrected number already identifies another customer record —
        // move the order to it. Only fields this edit changed flow onto it,
        // never the previous customer's identity.
        patch.customerId = phoneOwner.id;
      } else {
        customerUpdates.phone = updates.phone;
      }
    }
  }

  await db.update(orders).set(patch).where(eq(orders.id, orderId));

  const customerTarget = (patch.customerId as string | undefined) ?? current?.customerId;
  if (customerTarget && Object.keys(customerUpdates).length > 0) {
    await updateCustomer(db, customerTarget, customerUpdates);
  }
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
  if (fields.price !== undefined) {
    patch.price = fields.price;
    // The COD the driver is booked to collect must follow the carrier
    // amount — leaving codAmount stale made settlement and dashboards run
    // on the old number while the carrier collected the new one.
    patch.codAmount = sql`${fields.price} + ${orders.deliveryFee}`;
  }

  await db.update(orders).set(patch).where(eq(orders.id, orderId));
}

export async function updateOrderTracking(
  db: AppDb,
  orderId: string,
  trackingNumber: string,
  trackingUrl?: string,
  deliveryType?: "home" | "stop_desk",
) {
  await db
    .update(orders)
    .set({
      trackingNumber,
      trackingUrl: trackingUrl ?? null,
      // Dispatch-time delivery-type override: persisted only on successful
      // dispatch so the order records what the carrier actually accepted.
      ...(deliveryType !== undefined ? { deliveryType } : {}),
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

  const statements: BatchStatement[] = [];

  // Update customer stats BEFORE deleting the order.
  // totalOrders always drops (the order no longer exists). totalSpent is only
  // subtracted when the order was still counting as spend: cancelled/returned
  // orders already rolled their spend back at status-change time —
  // subtracting again would double-decrement (e.g. cancel + delete).
  if (order) {
    const spendAlreadyRolledBack =
      order.status === "cancelled" || order.status === "returned";

    statements.push(
      db
        .update(customers)
        .set({
          totalOrders: sql`MAX(0, ${customers.totalOrders} - 1)`,
          ...(spendAlreadyRolledBack
            ? {}
            : {
                totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order.price ?? 0})`,
              }),
        })
        .where(eq(customers.id, order.customerId)),
    );
  }

  // Reverse driver credit for delivered orders whose money has NOT been
  // settled. Before this, deleting a delivered order left totalDelivered,
  // totalEarnings and pendingCash permanently inflated — and unsettleable
  // phantom cash (the order no longer appears in the pending list).
  // Orders already linked to a payment keep the driver counters alone:
  // the payment row is append-only history and must stay reconciled.
  if (order && order.driverId && order.status === "delivered" && order.codPaymentId === null) {
    statements.push(
      db
        .update(drivers)
        .set({
          totalDelivered: sql`MAX(0, ${drivers.totalDelivered} - 1)`,
          totalEarnings: sql`MAX(0, ${drivers.totalEarnings} - ${order.driverFee ?? 0})`,
          pendingCash: sql`MAX(0, ${drivers.pendingCash} - ${order.codAmount ?? 0})`,
          updatedAt: now,
        })
        .where(eq(drivers.id, order.driverId)),
    );
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

      statements.push(
        db
          .update(productVariants)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(productVariants.id, op.variantId)),
      );

      statements.push(
        db.insert(stockMovements).values({
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
        }),
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

      statements.push(
        db
          .update(products)
          .set({ inventory: qtyAfter, updatedAt: now })
          .where(eq(products.id, op.productId)),
      );

      statements.push(
        db.insert(stockMovements).values({
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
        }),
      );
    }
  }

  // Delete related records. company_api_logs and webhook_events reference
  // orders(id) with ON DELETE no action — they must be removed explicitly or
  // the final orders delete fails the FOREIGN KEY constraint. Reviews and
  // order_status_history cascade at the database level.
  statements.push(
    db.delete(companyApiLogs).where(eq(companyApiLogs.orderId, orderId)),
    db.delete(webhookEvents).where(eq(webhookEvents.orderId, orderId)),
    db.delete(companyShipments).where(eq(companyShipments.orderId, orderId)),
    db.delete(orderProducts).where(eq(orderProducts.orderId, orderId)),
    db.delete(orders).where(eq(orders.id, orderId)),
  );

  // Atomic: stats, restock, and deletes commit together or not at all.
  // Without the batch, a mid-sequence failure left a gutted order behind
  // (lines deleted, stats decremented, inventory restocked) while the
  // order row itself survived.
  await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
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

interface RestockLine {
  lineId: string;
  productId: string;
  variantId: string | null;
  remaining: number;
}

interface RestockResolved extends RestockLine {
  qtyBefore: number;
}

async function resolveRestockLines(
  db: AppDb,
  orderId: string,
): Promise<RestockLine[]> {
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

  const lines: RestockLine[] = [];
  for (const op of ordProductRows) {
    const remaining = op.quantity - (op.returnedQuantity ?? 0);
    if (remaining <= 0) continue;

    const productRow = await db
      .select({ trackInventory: products.trackInventory })
      .from(products)
      .where(eq(products.id, op.productId))
      .get();

    if (!productRow?.trackInventory) continue;

    lines.push({
      lineId: op.id,
      productId: op.productId,
      variantId: op.variantId,
      remaining,
    });
  }
  return lines;
}

async function readCurrentInventories(
  db: AppDb,
  lines: RestockLine[],
): Promise<RestockResolved[]> {
  const resolved: RestockResolved[] = [];
  for (const line of lines) {
    const row = await db
      .select({ inventory: line.variantId ? productVariants.inventory : products.inventory })
      .from(line.variantId ? productVariants : products)
      .where(eq(line.variantId ? productVariants.id : products.id, line.variantId ?? line.productId))
      .get();
    resolved.push({ ...line, qtyBefore: row?.inventory ?? 0 });
  }
  return resolved;
}

type BatchStatement = Parameters<AppDb["batch"]>[0][number];

function buildRestockStatements(
  db: AppDb,
  resolved: RestockResolved[],
  movementType: "ORDER_CANCELLED" | "ORDER_RETURNED",
  orderId: string,
  source: string,
  now: string,
): BatchStatement[] {
  const built: BatchStatement[] = [];

  for (const line of resolved) {
    const qtyAfter = line.qtyBefore + line.remaining;

    if (line.variantId) {
      built.push(
        db
          .update(productVariants)
          .set({ inventory: sql`${productVariants.inventory} + ${line.remaining}`, updatedAt: now })
          .where(eq(productVariants.id, line.variantId)),
      );
    } else {
      built.push(
        db
          .update(products)
          .set({ inventory: sql`${products.inventory} + ${line.remaining}`, updatedAt: now })
          .where(eq(products.id, line.productId)),
      );
    }

    built.push(
      db.insert(stockMovements).values({
        id: crypto.randomUUID(),
        productId: line.productId,
        variantId: line.variantId,
        type: movementType,
        delta: line.remaining,
        qtyBefore: line.qtyBefore,
        qtyAfter,
        reason: null,
        reference: orderId,
        createdBy: source,
        createdByName: source,
        createdAt: now,
      }),
    );

    built.push(
      db
        .update(orderProducts)
        .set({ status: "returned", returnedQuantity: sql`${orderProducts.quantity}` })
        .where(eq(orderProducts.id, line.lineId)),
    );
  }

  return built;
}

export async function updateOrderStatusWebhook(
  db: AppDb,
  orderId: string,
  newStatus: OrderStatus,
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

  const statements: BatchStatement[] = [
    db.update(orders).set(updateFields).where(eq(orders.id, orderId)),
    db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId,
      status: newStatus,
      timestamp: now,
      by: source,
    }),
  ];

  if (newStatus === "delivered" && order.driverId) {
    statements.push(
      db
        .update(drivers)
        .set({
          totalDelivered: sql`${drivers.totalDelivered} + 1`,
          totalEarnings: sql`${drivers.totalEarnings} + ${order.driverFee ?? 0}`,
          pendingCash: sql`${drivers.pendingCash} + ${order.codAmount ?? 0}`,
          updatedAt: now,
        })
        .where(eq(drivers.id, order.driverId)),
    );
  }

  if (newStatus === "cancelled" || newStatus === "returned") {
    statements.push(
      db
        .update(customers)
        .set({
          totalSpent: sql`MAX(0, ${customers.totalSpent} - ${order.price ?? 0})`,
        })
        .where(eq(customers.id, order.customerId)),
    );

    const movementType =
      newStatus === "cancelled" ? "ORDER_CANCELLED" : "ORDER_RETURNED";

    const lines = await resolveRestockLines(db, orderId);
    const resolved = await readCurrentInventories(db, lines);
    statements.push(...buildRestockStatements(db, resolved, movementType, orderId, source, now));
  }

  await db.batch(statements as [BatchStatement, ...BatchStatement[]]);

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
