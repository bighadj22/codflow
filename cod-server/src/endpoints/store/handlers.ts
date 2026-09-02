import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { storeOrderSchema, storeReviewSchema } from "./validation";
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { getPixelConfig } from "../../../../cod-shared/queries/pixel-config";
import { sendCapiEvent } from "@/lib/capi";
import { assertOtpVerification } from "./otp-gate";

async function sendCapiLeadMirror(
  db: ReturnType<typeof getDb>,
  storeId: string,
  order: { id: string },
  phone: string,
  fbc?: string,
  fbp?: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const pixelConfig = await getPixelConfig(db, storeId);
  if (!pixelConfig?.enabled) return;
  await sendCapiEvent(pixelConfig.pixelId, pixelConfig.accessToken, {
    eventName: "Lead",
    eventId: order.id,
    eventTime: Math.floor(Date.now() / 1000),
    userData: { phone, fbc, fbp, clientIpAddress: ipAddress, clientUserAgent: userAgent },
    testEventCode: pixelConfig.testEventCode,
  });
}

export async function getStoreConfig(c: Context<AppContext>) {
  const storeId = c.get("storeId")!;
  const db = getDb(c.env.DB);
  const store = await queries.getStoreConfig(db, storeId);
  if (!store) {
    throw new NotFoundError("Store", storeId);
  }
  return c.json({ success: true, data: store }, 200);
}

export async function listStoreProducts(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const queryData: any = (c.req as any).valid?.("query");
  const rawFeatured = queryData?.featured ?? c.req.query("featured");
  const featured = rawFeatured === "true";
  const categoryId = queryData?.categoryId ?? c.req.query("categoryId") ?? undefined;
  const limit = Math.min(parseInt(String(queryData?.limit ?? c.req.query("limit") ?? "24")), 100);
  const data = await queries.getStoreProducts(db, { featured, categoryId, limit });
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getStoreProduct(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const handle = c.req.param("handle")!;
  const data = await queries.getStoreProductByHandle(db, handle);
  if (!data) {
    throw new NotFoundError("Product", handle);
  }
  return c.json({ success: true, data }, 200);
}

export async function listStoreCategories(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.getStoreCategories(db);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getShippingRates(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.getShippingRates(db);
  return c.json({ success: true, data }, 200);
}

export async function listStoreCommunes(c: Context<AppContext>) {
  const wilayaId = parseInt(c.req.param("wilayaId")!);
  if (isNaN(wilayaId) || wilayaId < 1 || wilayaId > 58) {
    throw new ValidationError(
      "Invalid wilaya ID — must be an integer between 1 and 58",
      ERROR_CODES.VALUE_OUT_OF_RANGE,
      { wilayaId, min: 1, max: 58 }
    );
  }
  const db = getDb(c.env.DB);
  const data = await queries.getStoreCommunes(db, wilayaId);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function createStoreOrder(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const bodyData: any = (c.req as any).valid?.("json");
  const data: import("./validation").StoreOrderInput =
    bodyData ?? storeOrderSchema.parse(await c.req.json());

  const skuMissing = await queries.validateOrderSkus(
    db,
    data.productId,
    data.variantId,
    data.variantSelections
  );
  if (skuMissing) {
    throw new BusinessLogicError(
      `SKU is missing on ${skuMissing.missing} ${skuMissing.id} — add a SKU before accepting orders`,
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { [skuMissing.missing === "variant" ? "variantId" : "productId"]: skuMissing.id }
    );
  }

  const stockError = await queries.checkStoreOrderStock(db, {
    productId: data.productId,
    variantId: data.variantId ?? null,
    variantSelections: data.variantSelections ?? [],
    quantity: data.quantity,
  });
  if (stockError) {
    throw new BusinessLogicError(stockError, ERROR_CODES.INSUFFICIENT_STOCK);
  }

  await assertOtpVerification(c, db, data);

  const customer = await queries.findOrCreateCustomer(db, {
    phone: data.phone,
    name: data.customerName,
    wilayaId: data.wilayaId,
    communeId: data.communeId,
  });

  const deliveryFee = await queries.getDeliveryFee(
    db,
    data.wilayaId,
    data.deliveryType
  );

  const ipAddress =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    undefined;
  const userAgent = c.req.header("User-Agent") ?? undefined;

  const order = await queries.createStoreOrder(db, {
    ...data,
    customerId: customer.id,
    customerName: customer.name,
    deliveryFee,
    ipAddress,
    userAgent,
  });

  // Inline CAPI Lead mirror — server-side counterpart to the browser Pixel Lead.
  // Uses the same event_id (order.id) so Meta deduplicates within 48h.
  // Fire-and-forget: a CAPI failure must never block order confirmation.
  const storeId = c.get("storeId")!;
  void sendCapiLeadMirror(db, storeId, order, data.phone, data.fbc, data.fbp, ipAddress, userAgent).catch(
    (err) => console.warn("[capi-lead-mirror] failed:", err?.message)
  );

  return c.json(
    {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        price: order.price,
        deliveryFee: order.deliveryFee,
        total: order.price + order.deliveryFee,
      },
    },
    201
  );
}

export async function listProductReviews(c: Context<AppContext>) {
  const storeId = c.get("storeId")!;
  const db = getDb(c.env.DB);
  const queryData: any = (c.req as any).valid?.("query");
  const productId = queryData?.productId ?? c.req.query("productId");
  if (!productId) {
    throw new ValidationError(
      "productId is required",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "productId" }
    );
  }
  const limit = Math.min(parseInt(String(queryData?.limit ?? c.req.query("limit") ?? "20")), 50);
  const offset = Math.max(parseInt(String(queryData?.offset ?? c.req.query("offset") ?? "0")), 0);
  const { rows, total } = await queries.getApprovedProductReviews(db, storeId, productId, limit, offset);
  return c.json({ success: true, data: rows, count: rows.length, total }, 200);
}

export async function submitReview(c: Context<AppContext>) {
  const storeId = c.get("storeId")!;
  const db = getDb(c.env.DB);
  const bodyData: any = (c.req as any).valid?.("json");

  // Let Zod validation errors propagate to error middleware
  const data: import("./validation").StoreReviewInput =
    bodyData ?? storeReviewSchema.parse(await c.req.json());

  // Resolve customer-facing orderNumber → internal order record (scoped to
  // this store). The storefront only ever exposes the number, not the UUID.
  const order = await queries.findOrderForReview(db, storeId, data.orderNumber);
  if (!order) {
    throw new NotFoundError("Order", data.orderNumber);
  }

  // Duplicate-review check runs against the internal order.id — that's the
  // stable FK stored on the reviews row, and does not change even if the
  // order-number format ever evolves.
  const existing = await queries.getExistingReviewByOrder(db, order.id);
  if (existing) {
    throw new ConflictError(
      "A review has already been submitted for this order",
      ERROR_CODES.ORDER_ALREADY_REVIEWED,
      { orderNumber: data.orderNumber }
    );
  }

  const review = await queries.createReview(db, {
    storeId,
    productId: data.productId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    rating: data.rating,
    title: data.title,
    body: data.body,
  });

  return c.json({ success: true, data: { id: review.id } }, 201);
}
