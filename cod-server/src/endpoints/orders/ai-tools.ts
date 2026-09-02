import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  assignDriverSchema,
  returnOrderProductSchema,
  orderFiltersSchema,
  ORDER_STATUSES,
} from "./validation";
import { getDb } from "@/db";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 */
export const listOrdersSchema = orderFiltersSchema;
export const getOrderDetailsSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order"),
});
export const createOrderToolSchema = createOrderSchema;
export const updateOrderStatusToolSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order"),
  status: updateOrderStatusSchema.shape.status,
});
export const assignDriverToOrderToolSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order"),
  driverId: assignDriverSchema.shape.driverId,
});
export const unassignDriverFromOrderToolSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order"),
});
export const recordOrderProductReturnToolSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order"),
  productLineId: z.string().uuid().describe("UUID of the order product line (the id field in order.products array)"),
  returnedQuantity: returnOrderProductSchema.shape.returnedQuantity,
});
export const deleteOrderSchema = z.object({
  orderId: z.string().uuid().describe("UUID of the order to delete"),
});

export const ORDER_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listOrders: listOrdersSchema.shape,
  getOrderDetails: getOrderDetailsSchema.shape,
  createOrder: createOrderToolSchema.shape,
  updateOrderStatus: updateOrderStatusToolSchema.shape,
  assignDriverToOrder: assignDriverToOrderToolSchema.shape,
  unassignDriverFromOrder: unassignDriverFromOrderToolSchema.shape,
  recordOrderProductReturn: recordOrderProductReturnToolSchema.shape,
  deleteOrder: deleteOrderSchema.shape,
};

/**
 * AI Tools for Order Management
 *
 * Orders are the core entity of the CRM. Each order tracks a COD (cash-on-delivery)
 * sale from creation through delivery or return.
 *
 * ─── Status lifecycle ────────────────────────────────────────────────────────
 * new → confirmed → preparing → ready → [assigned|dispatched] → out_for_delivery
 *                                                                      ↓
 *                                                            delivered | returned
 * Any status → cancelled (except delivered/returned/cancelled)
 * unreachable ↔ confirmed (customer unreachable, retry later)
 *
 * ALLOWED_TRANSITIONS (enforced by updateOrderStatus):
 *   new:              confirmed, unreachable, cancelled
 *   confirmed:        preparing, unreachable, cancelled
 *   unreachable:      confirmed, cancelled
 *   preparing:        ready, cancelled
 *   ready:            out_for_delivery, dispatched, cancelled
 *   assigned:         out_for_delivery, dispatched, cancelled
 *   dispatched:       out_for_delivery, cancelled
 *   out_for_delivery: delivered, returned
 *   delivered:        [] (terminal)
 *   returned:         [] (terminal)
 *   cancelled:        [] (terminal)
 *
 * ─── Delivery methods (mutually exclusive) ───────────────────────────────────
 *   driver  → assign a driver via assignDriverToOrder
 *   company → dispatch to a carrier API via the REST endpoint (not an AI tool —
 *             requires external API calls and provider-specific logic)
 *
 * ─── Stock impact ────────────────────────────────────────────────────────────
 *   createOrder       → deducts inventory (ORDER_DEDUCTED)
 *   updateOrderStatus → restores inventory on cancelled/returned (ORDER_CANCELLED/ORDER_RETURNED)
 *   recordProductReturn → restores per-line returned units (ORDER_RETURNED)
 *   deleteOrder       → restores all remaining inventory (ORDER_CANCELLED)
 *
 * ─── COD amount ──────────────────────────────────────────────────────────────
 *   codAmount = price + deliveryFee  (what the driver collects at the door)
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */
export const getOrderTools = (db: ReturnType<typeof getDb>) => ({

  listOrders: tool({
    description:
      "Search and filter orders. Returns orders ordered newest-first. " +
      "Each order includes status, customerName, phone, wilaya, price, deliveryFee, codAmount, " +
      "driverName, trackingNumber, orderNumber, and hasReview flag. " +
      "Optional filters: status (new|confirmed|unreachable|preparing|ready|assigned|dispatched|out_for_delivery|delivered|returned|cancelled), " +
      "wilayaId (integer 1-58), search (matches orderNumber, customerName, or phone), " +
      "limit (1-100, default 50), offset (default 0).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = listOrdersSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: status (${ORDER_STATUSES.join("|")}, optional), wilayaId (int 1-58, optional), search (string, optional), limit (1-100, default 50), offset (int >= 0, default 0)`,
        };
      }
      try {
        const orders = await queries.getAllOrders(db, parsed.data);
        return {
          success: true,
          count: orders.length,
          orders: orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            customerName: o.customerName,
            phone: o.phone,
            wilaya: o.wilaya,
            commune: o.commune,
            price: o.price,
            deliveryFee: o.deliveryFee,
            codAmount: o.codAmount,
            deliveryType: o.deliveryType,
            orderType: o.orderType,
            driverName: o.driverName,
            trackingNumber: o.trackingNumber,
            companyId: o.companyId,
            hasReview: o.hasReview,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          })),
        };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  getOrderDetails: tool({
    description:
      "Fetch full details for a specific order by UUID. " +
      "Returns the complete order including products array (with quantities, prices, returnedQuantity, status), " +
      "statusHistory (chronological list of status changes with timestamps and actor names), " +
      "driverName, wilaya/commune Arabic names, and labelUrl if a shipment label exists. " +
      "Use this before updating status, assigning a driver, or recording a return.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = getOrderDetailsSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID string)`,
        };
      }
      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }
        return { success: true, order };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  createOrder: tool({
    description:
      "Creates a new COD order. " +
      "Required: customerId (UUID), customerName (string), phone (Algerian 0[5-7]XXXXXXXX), " +
      "wilayaId (int 1-58), price (positive number, product total in DZD), " +
      "products (array, min 1 item — each needs productId, productName, quantity, pricePerUnit, lineTotal). " +
      "Optional: communeId (UUID), city, address, notes, " +
      "orderType ('online'|'offline', default 'online'), " +
      "deliveryType ('home'|'stop_desk', default 'home'), " +
      "deliveryFee (number >= 0 — for offline orders only; online orders auto-resolve from shipping profile), " +
      "companyId (UUID of delivery company to pre-assign). " +
      "variantId and variantLabel are optional per product line. " +
      "codAmount = price + deliveryFee (auto-computed). " +
      "Stock is deducted automatically on creation for tracked products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const parsed = createOrderSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error:
            `Invalid order data: ${errorDetails}. ` +
            `Required: customerId (UUID), customerName (string), phone (0[5-7]XXXXXXXX), ` +
            `wilayaId (int 1-58), price (positive number DZD), ` +
            `products (array min 1: [{productId, productName, quantity (int > 0), pricePerUnit (positive), lineTotal (positive), variantId?, variantLabel?}]). ` +
            `Optional: communeId (UUID), city, address, notes, ` +
            `orderType (online|offline, default online), deliveryType (home|stop_desk, default home), ` +
            `deliveryFee (number >= 0, offline only), companyId (UUID).`,
        };
      }

      try {
        // Generate order number
        const date = new Date();
        const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        const orderNumber = `ORD-${dateStr}-${random}`;
        const now = date.toISOString();
        const orderId = crypto.randomUUID();

        // Validate companyId if provided
        if (parsed.data.companyId) {
          const { getDeliveryCompanyById } = await import("@/endpoints/delivery-companies/queries");
          const company = await getDeliveryCompanyById(db, parsed.data.companyId);
          if (!company) {
            return { success: false, error: `Delivery company not found with ID: ${parsed.data.companyId}` };
          }
        }

        // Resolve delivery fee from shipping profile
        const { resolveDeliveryFee, applyFreeShippingOffer } = await import("./resolve-fee");
        let deliveryFee = parsed.data.deliveryFee ?? 0;
        if (parsed.data.wilayaId) {
          try {
            const productIds = parsed.data.products.map((p) => p.productId);
            const resolved = await resolveDeliveryFee(db, {
              wilayaId: parsed.data.wilayaId,
              communeId: parsed.data.communeId ?? null,
              deliveryType: parsed.data.deliveryType,
              productIds,
            });
            if (parsed.data.orderType === "online" || parsed.data.deliveryFee == null) {
              deliveryFee = resolved.deliveryFee;
            }
            const productQuantities = new Map(parsed.data.products.map((p) => [p.productId, p.quantity]));
            deliveryFee = await applyFreeShippingOffer(db, deliveryFee, productIds, productQuantities);
          } catch (err) {
            if (parsed.data.orderType === "online") throw err;
            deliveryFee = parsed.data.deliveryFee ?? 0;
          }
        }

        // Auto-create customer if not in DB
        const { wilayas, communes, customers } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const existingCustomer = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, parsed.data.customerId))
          .get();

        if (!existingCustomer) {
          const [wilayaRow, communeRow] = await Promise.all([
            db.select({ nameAr: wilayas.nameAr }).from(wilayas).where(eq(wilayas.id, parsed.data.wilayaId)).get(),
            parsed.data.communeId
              ? db.select({ nameAr: communes.nameAr }).from(communes).where(eq(communes.id, parsed.data.communeId)).get()
              : Promise.resolve(null),
          ]);
          await db.insert(customers).values({
            id: parsed.data.customerId,
            name: parsed.data.customerName,
            phone: parsed.data.phone,
            phone2: null,
            wilayaId: parsed.data.wilayaId,
            communeId: parsed.data.communeId ?? null,
            wilaya: wilayaRow?.nameAr ?? String(parsed.data.wilayaId),
            commune: communeRow?.nameAr ?? null,
            address: parsed.data.address ?? null,
            totalOrders: 0,
            totalSpent: 0,
            createdAt: now,
            lastOrderAt: null,
          });
        }

        const orderData = {
          id: orderId,
          orderNumber,
          customerId: parsed.data.customerId,
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          wilayaId: parsed.data.wilayaId,
          communeId: parsed.data.communeId ?? null,
          city: parsed.data.city || null,
          address: parsed.data.address || null,
          price: parsed.data.price,
          notes: parsed.data.notes || null,
          status: "new" as const,
          orderType: parsed.data.orderType,
          driverId: null,
          companyId: parsed.data.companyId || null,
          deliveryType: parsed.data.deliveryType,
          deliveryFee,
          codAmount: parsed.data.price + deliveryFee,
          photos: null,
          createdAt: now,
          updatedAt: now,
        };

        const productsData = parsed.data.products.map((p) => ({
          id: crypto.randomUUID(),
          orderId,
          productId: p.productId,
          productName: p.productName,
          variantId: p.variantId || null,
          variantLabel: p.variantLabel || null,
          quantity: p.quantity,
          pricePerUnit: p.pricePerUnit,
          lineTotal: p.lineTotal,
          createdAt: now,
        }));

        await queries.createOrder(db, orderData, productsData, null);

        return {
          success: true,
          order: {
            id: orderId,
            orderNumber,
            status: "new",
            deliveryFee,
            price: parsed.data.price,
            codAmount: parsed.data.price + deliveryFee,
            customerId: parsed.data.customerId,
            customerName: parsed.data.customerName,
            phone: parsed.data.phone,
            wilayaId: parsed.data.wilayaId,
            communeId: parsed.data.communeId ?? null,
            deliveryType: parsed.data.deliveryType,
            orderType: parsed.data.orderType,
          },
          message: `Order ${orderNumber} created successfully`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to create order: ${error.message}` };
      }
    },
  }),

  updateOrderStatus: tool({
    description:
      "Updates an order's status. Enforces valid transitions — invalid moves are rejected with the allowed next statuses. " +
      "Required: orderId (UUID), status (target status). " +
      "Valid statuses: new, confirmed, unreachable, preparing, ready, assigned, dispatched, out_for_delivery, delivered, returned, cancelled. " +
      "Transition rules: " +
      "new → confirmed|unreachable|cancelled. " +
      "confirmed → preparing|unreachable|cancelled. " +
      "unreachable → confirmed|cancelled. " +
      "preparing → ready|cancelled. " +
      "ready → out_for_delivery|dispatched|cancelled. " +
      "assigned → out_for_delivery|dispatched|cancelled. " +
      "dispatched → out_for_delivery|cancelled. " +
      "out_for_delivery → delivered|returned. " +
      "delivered/returned/cancelled → terminal (no further transitions). " +
      "Setting cancelled or returned automatically restores inventory for tracked products.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = updateOrderStatusToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID), status (${ORDER_STATUSES.join("|")})`,
        };
      }

      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }

        // Enforce transition table — same logic as the REST handler
        const ALLOWED_TRANSITIONS: Record<string, string[]> = {
          new:              ["confirmed", "unreachable", "cancelled"],
          confirmed:        ["preparing", "unreachable", "cancelled"],
          unreachable:      ["confirmed", "cancelled"],
          preparing:        ["ready", "cancelled"],
          ready:            ["out_for_delivery", "dispatched", "cancelled"],
          assigned:         ["out_for_delivery", "dispatched", "cancelled"],
          dispatched:       ["out_for_delivery", "cancelled"],
          out_for_delivery: ["delivered", "returned"],
          delivered:        [],
          returned:         [],
          cancelled:        [],
        };

        const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(parsed.data.status)) {
          return {
            success: false,
            error: `Cannot transition order "${order.orderNumber}" from "${order.status}" to "${parsed.data.status}". Allowed next statuses: [${allowed.join(", ") || "none — terminal status"}]`,
          };
        }

        await queries.updateOrderStatus(db, parsed.data.orderId, parsed.data.status, "ai-agent", "AI Agent");

        return {
          success: true,
          message: `Order "${order.orderNumber}" status updated from "${order.status}" to "${parsed.data.status}"`,
          previousStatus: order.status,
          newStatus: parsed.data.status,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to update order status: ${error.message}` };
      }
    },
  }),

  assignDriverToOrder: tool({
    description:
      "Assigns a driver to an order for manual delivery. " +
      "Required: orderId (UUID), driverId (UUID). " +
      "Blocked if: order already has a tracking number (dispatched to a carrier), " +
      "order deliveryMethod is 'company', or order is in a locked status (out_for_delivery, delivered, returned, cancelled). " +
      "Automatically sets status to 'assigned' if order was in new/preparing/ready. " +
      "Driver fee is auto-resolved from the driver's compensation table for the order's wilaya.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = assignDriverToOrderToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID), driverId (UUID)`,
        };
      }

      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }

        if (order.trackingNumber) {
          return {
            success: false,
            error: `Order "${order.orderNumber}" is already dispatched to a carrier (tracking: ${order.trackingNumber}). Driver assignment is not allowed.`,
          };
        }
        if (order.deliveryMethod === "company") {
          return {
            success: false,
            error: `Order "${order.orderNumber}" is assigned to a delivery company. Remove the company assignment first.`,
          };
        }
        const lockedStatuses = ["out_for_delivery", "delivered", "returned", "cancelled"];
        if (lockedStatuses.includes(order.status)) {
          return {
            success: false,
            error: `Cannot assign a driver — order "${order.orderNumber}" is already "${order.status}".`,
          };
        }

        // Verify driver exists
        const { drivers } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const driver = await db.select({ id: drivers.id, firstName: drivers.firstName, lastName: drivers.lastName })
          .from(drivers).where(eq(drivers.id, parsed.data.driverId)).get();
        if (!driver) {
          return { success: false, error: `Driver not found with ID: ${parsed.data.driverId}` };
        }

        await queries.assignDriver(db, parsed.data.orderId, parsed.data.driverId);

        return {
          success: true,
          message: `Driver ${driver.firstName} ${driver.lastName} assigned to order "${order.orderNumber}"`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to assign driver: ${error.message}` };
      }
    },
  }),

  unassignDriverFromOrder: tool({
    description:
      "Removes the currently assigned driver from an order. " +
      "Required: orderId (UUID). " +
      "Blocked if: order has no driver, or order is in a locked status (out_for_delivery, delivered, returned, cancelled). " +
      "If order was 'assigned', status rolls back to 'ready' automatically.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = unassignDriverFromOrderToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID string)`,
        };
      }

      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }
        if (!order.driverId) {
          return { success: false, error: `Order "${order.orderNumber}" has no driver assigned.` };
        }
        const lockedStatuses = ["out_for_delivery", "delivered", "returned", "cancelled"];
        if (lockedStatuses.includes(order.status)) {
          return {
            success: false,
            error: `Cannot unassign driver — order "${order.orderNumber}" is already "${order.status}".`,
          };
        }

        await queries.unassignDriver(db, parsed.data.orderId);

        return {
          success: true,
          message: `Driver unassigned from order "${order.orderNumber}"${order.status === "assigned" ? " — status rolled back to 'ready'" : ""}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to unassign driver: ${error.message}` };
      }
    },
  }),

  recordOrderProductReturn: tool({
    description:
      "Records how many units on a single order line the customer refused at the door. " +
      "Used for the Algerian 'open the box at delivery' workflow. " +
      "Required: orderId (UUID), productLineId (UUID of the order product line), returnedQuantity (int 0 to line.quantity). " +
      "returnedQuantity=0 → line status 'fulfilled'. " +
      "returnedQuantity=line.quantity → line status 'returned'. " +
      "0 < returnedQuantity < line.quantity → line status 'partially_returned'. " +
      "Returned units are automatically restocked. Calls are idempotent — correcting a previous return adjusts the delta. " +
      "Blocked on orders already in 'returned' or 'cancelled' status. " +
      "Use getOrderDetails first to find the productLineId (it's the id field in the products array).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = recordOrderProductReturnToolSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID), productLineId (UUID), returnedQuantity (int >= 0, max = line quantity)`,
        };
      }

      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }

        const terminalStatuses = ["returned", "cancelled"];
        if (terminalStatuses.includes(order.status)) {
          return {
            success: false,
            error: `Cannot edit returns on order "${order.orderNumber}" — it is already "${order.status}" and stock was already reconciled.`,
          };
        }

        const result = await queries.setOrderProductReturn(
          db,
          parsed.data.orderId,
          parsed.data.productLineId,
          parsed.data.returnedQuantity,
          "ai-agent",
          "AI Agent",
        );

        return {
          success: true,
          result,
          message: `Return recorded: ${parsed.data.returnedQuantity} unit(s) returned on line ${parsed.data.productLineId}. Line status: ${result.status}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to record return: ${error.message}` };
      }
    },
  }),

  deleteOrder: tool({
    description:
      "Permanently deletes an order and all its related records (products, status history, shipment records). " +
      "Automatically restores inventory for all non-returned product lines and updates customer stats. " +
      "WARNING: This is a hard delete — there is no soft-delete or recovery. " +
      "Consider updating status to 'cancelled' instead if you want to keep the order for audit purposes.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      const validationSchema = deleteOrderSchema;
      const parsed = validationSchema.safeParse(args);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: orderId (UUID string)`,
        };
      }

      try {
        const order = await queries.getOrderById(db, parsed.data.orderId);
        if (!order) {
          return { success: false, error: `Order not found with ID: ${parsed.data.orderId}` };
        }

        await queries.deleteOrder(db, parsed.data.orderId);

        return {
          success: true,
          message: `Order "${order.orderNumber}" (${parsed.data.orderId}) permanently deleted. Inventory restored for non-returned lines.`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to delete order: ${error.message}` };
      }
    },
  }),
});
