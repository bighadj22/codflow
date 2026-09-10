import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { storeOrderSchema, storeReviewSchema } from "./validation";
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { assertOtpVerification } from "./otp-gate";
import { assertTurnstile } from "./turnstile-gate";
import { getPixelConfig } from "../../../../cod-shared/queries/pixel-config";
import { resolveConversionForStage, getCapiWorkflowId } from "@/workflows/capi-helpers";
import { stores } from "../../../../cod-shared/db/schema";
import { eq } from "drizzle-orm";

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

export async function getStoreLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const slug = c.req.param("slug")!;

  // Two round trips total: the row by slug, then ONE batched call carrying
  // images + stats + the product ref.
  const lp = await queries.getLandingPageDetailBySlug(db, slug);
  if (!lp || lp.status !== "published") {
    // Unknown, draft, or archived — same answer so nothing leaks.
    throw new NotFoundError("Landing Page", slug);
  }

  // The page renders the store product exactly like the product page does —
  // same shape (variants, offers, inventory, review stats) so the theme's
  // form + scripts work unmodified. A hidden/unavailable product still
  // renders: the merchant published the link deliberately; the order engine
  // guards sellability.
  const product = lp.product?.handle
    ? await queries.getStoreProductByHandle(db, lp.product.handle)
    : null;

  // One render = one view. Atomic single-row UPDATE, deferred via waitUntil
  // so the write never blocks the render response (Cloudflare's documented
  // pattern for analytics-after-response; same seam the CAPI trigger uses).
  // A counting failure is logged and swallowed — it must never break a render.
  c.executionCtx.waitUntil(
    queries.incrementLandingPageViews(db, lp.id).catch((err) => {
      console.error("[landing-pages] view increment failed:", err);
    }),
  );

  return c.json(
    {
      success: true,
      data: {
        id: lp.id,
        slug: lp.slug,
        name: lp.name,
        status: lp.status,
        imageGap: lp.imageGap,
        metaTitle: lp.metaTitle,
        metaDescription: lp.metaDescription,
        publishedAt: lp.publishedAt,
        images: lp.images,
        product,
      },
    },
    200,
  );
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

  // Turnstile bot gate — runs before the SKU/stock lookups so bot traffic is
  // rejected before spending D1 reads. No-op when the store has it disabled.
  await assertTurnstile(c, db, data);

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

  const deliveryFee = await queries.getDeliveryFee(
    db,
    data.wilayaId,
    data.deliveryType
  );

  if (deliveryFee === null) {
    // Delivery to this wilaya (or this delivery type) is not configured —
    // refuse the order instead of silently shipping for free. Refusal must
    // happen BEFORE the customer is created so no orphan customer rows.
    throw new BusinessLogicError(
      data.deliveryType === "home"
        ? "Home delivery is not available to this wilaya"
        : "Stop-desk delivery is not available to this wilaya",
      ERROR_CODES.DELIVERY_NOT_AVAILABLE,
      { wilayaId: data.wilayaId, deliveryType: data.deliveryType }
    );
  }

  const customer = await queries.findOrCreateCustomer(db, {
    phone: data.phone,
    name: data.customerName,
    wilayaId: data.wilayaId,
    communeId: data.communeId,
  });

  // X-Forwarded-For first: the storefront worker forwards the shopper's IP
  // there — CF-Connecting-IP on this hop is the worker itself.
  const ipAddress =
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    c.req.header("CF-Connecting-IP") ??
    undefined;
  const userAgent = c.req.header("User-Agent") ?? undefined;

  // Landing page attribution — resolve best-effort BEFORE the customer is
  // created so a resolution failure leaves zero side effects. A bad slug
  // never blocks the order; it just leaves it unattributed.
  let landingPageId: string | null = null;
  if (data.landingPageSlug) {
    try {
      landingPageId = await queries.findPublishedLandingPageIdBySlug(db, data.landingPageSlug);
    } catch (err) {
      console.error("[store] landing page attribution lookup failed:", err);
    }
  }

  const order = await queries.createStoreOrder(db, {
    ...data,
    customerId: customer.id,
    customerName: customer.name,
    deliveryFee,
    landingPageId,
    ipAddress,
    userAgent,
  });

  // Meta CAPI conversion event at checkout — evaluated against merchant's tracking mode.
  // When mode is instant "Purchase", sends Purchase (matching the thank-you Pixel).
  // When mode is "Lead", sends Lead (matching the thank-you Pixel).
  // When mode is "Purchase_Confirmed" or "Purchase_Delivered", skips at checkout
  // and fires down-funnel via server CAPI.
  if (c.env.CAPI_WORKFLOW) {
    try {
      const storeId = c.get("storeId");
      const pixelConfig =
        storeId && typeof db.select === "function"
          ? await getPixelConfig(db, storeId)
          : undefined;
      const decision = resolveConversionForStage(pixelConfig?.conversionEvent, "checkout");

      if (decision.shouldFire && decision.eventName) {
        let storeRow: { domain: string | null } | undefined = undefined;
        if (storeId && typeof db.select === "function") {
          storeRow = await db
            .select({ domain: stores.domain })
            .from(stores)
            .where(eq(stores.id, storeId))
            .get();
        }

        let eventSourceUrl: string | undefined = storeRow?.domain
          ? `https://${storeRow.domain}/thank-you`
          : undefined;

        if (!eventSourceUrl) {
          const referer = c.req.header("Referer");
          if (referer && (referer.startsWith("http://") || referer.startsWith("https://"))) {
            eventSourceUrl = referer;
          }
        }

        const workflowId = getCapiWorkflowId(order.id, "checkout", decision.eventName);

        c.executionCtx.waitUntil(
          c.env.CAPI_WORKFLOW.create({
            id: workflowId,
            params: {
              orderId: order.id,
              eventName: decision.eventName,
              stage: "checkout",
              triggeredAt: Math.floor(Date.now() / 1000),
              triggerStatus: "order_created",
              eventSourceUrl,
            },
          }).catch((err: unknown) =>
            console.error(`[capi-workflow] checkout ${decision.eventName} trigger failed:`, (err as Error)?.message)
          )
        );
      }
    } catch (err) {
      console.error("[capi-workflow] checkout evaluation failed:", (err as Error)?.message);
    }
  } else {
    console.error("[capi-workflow] CAPI_WORKFLOW binding is undefined — worker needs re-provision");
  }

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
