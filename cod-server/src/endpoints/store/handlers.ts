import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { storeOrderSchema, storeReviewSchema, validateCartSchema } from "./validation";
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { assertOtpVerification } from "./otp-gate";
import { assertTurnstile } from "./turnstile-gate";
import { resolveTrackingConfig } from "../../../../cod-shared/queries/tracking-config";
import {
  normalizeOrderLines,
  CartValidationError,
  type CartLine,
} from "../../../../cod-shared/queries/cart";
// Pure, like normalizeOrderLines: imported directly rather than through
// ./queries so there is nothing for a test to stub and no way for the priced
// subtotal to diverge from what the engine charges.
import { priceCartLines } from "../../../../cod-shared/queries/catalog-snapshot";
import {
  resolveConversionForStage,
  getCapiWorkflowId,
  conversionSourceUrl,
} from "@/workflows/capi-helpers";
import { stores, orders } from "../../../../cod-shared/db/schema";
import { eq } from "drizzle-orm";
import type { PageLocale } from "../../../../cod-shared/legal/kinds";

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
  // form + scripts work unmodified. A store-hidden product (showInStore=false)
  // still renders: the merchant published the link deliberately, and the
  // landing page is its sales channel. The other gates (ACTIVE, visibility,
  // not deleted) still apply, and the order engine guards sellability.
  const product = lp.product?.handle
    ? await queries.getStoreProductByHandle(db, lp.product.handle, {
        allowUnlisted: true,
      })
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
        // Which pixel this page loads and fires at — resolved server-side,
        // inside the batch above, so the browser never works it out for
        // itself and cannot disagree with the Conversions API mirror.
        tracking: lp.tracking,
      },
    },
    200,
  );
}

/**
 * GET /store/orders/{id}/tracking
 *
 * Which pixel this order belongs to, and which browser event to fire for it.
 *
 * The thank-you page fires the sale event but has no idea which landing page
 * the shopper came from — the redirect carries the order number, the total and
 * the order id, nothing else. It cannot be told by the URL either: landing-page
 * attribution is best-effort, so an unknown, draft or archived slug leaves the
 * order unattributed, and a browser trusting that slug would fire at a pixel
 * the server never recorded. Asking is the only way the two sides cannot drift.
 *
 * Returns the DECISION, not the configuration: `event` is null whenever no
 * browser event should fire, which deletes the copy of the conversion-stage
 * rule that used to live in the theme.
 *
 * Deliberately narrow: an unguessable order id in, a public pixel id and an
 * event name out. No customer, no total, no contents, and never a token.
 */
export async function getStoreOrderTracking(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const orderId = c.req.param("id")!;

  const order = await db
    .select({ id: orders.id, landingPageId: orders.landingPageId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();
  if (!order) throw new NotFoundError("Order", orderId);

  const config = await resolveTrackingConfig(db, {
    storeId: c.get("storeId")!,
    landingPageId: order.landingPageId,
  });

  if (!config?.enabled || !config.pixelId) {
    return c.json({ success: true, data: { pixelId: null, event: null } }, 200);
  }

  const decision = resolveConversionForStage(config.conversionEvent, "checkout");

  return c.json(
    {
      success: true,
      data: {
        pixelId: config.pixelId,
        event: decision.shouldFire ? decision.eventName ?? null : null,
      },
    },
    200,
  );
}

/**
 * A published legal or custom page, in the store's own language — the same
 * `Promise.all`-lean shape as the rest of this file: one lookup for the
 * store's locale, one resolved read. Draft, unknown, and foreign-store slugs
 * all answer the same 404, so nothing about a page's existence leaks.
 */
export async function getStorePage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const storeId = c.get("storeId")!;
  const slug = c.req.param("slug")!;

  const storeRow = await db.select({ lang: stores.lang }).from(stores).where(eq(stores.id, storeId)).get();
  if (!storeRow) throw new NotFoundError("Store", storeId);

  const page = await queries.resolvePublishedPage(db, storeId, slug, storeRow.lang as PageLocale);
  if (!page) throw new NotFoundError("Store Page", slug);

  return c.json({ success: true, data: page }, 200);
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

  // Normalise first: every request shape becomes one list, and a basket that
  // breaks its own bounds is refused here with a 4xx rather than surfacing as
  // an unhandled error deeper in the engine.
  //
  // Imported directly rather than through ./queries: this is a pure function
  // and a plain error class, so there is nothing to stub, and routing them
  // through the mockable module would only make `instanceof` fragile in tests.
  let lines: CartLine[];
  try {
    lines = normalizeOrderLines(data);
  } catch (err) {
    if (err instanceof CartValidationError) {
      throw new ValidationError(err.message, ERROR_CODES.VALUE_OUT_OF_RANGE, err.detail);
    }
    throw err;
  }

  // ONE catalog read for the whole checkout. The SKU check, the stock check and
  // the order engine all answer their questions from this same snapshot, so a
  // product row is fetched once per order instead of once per question.
  const snapshot = await queries.loadCatalogSnapshot(
    db,
    lines,
    new Date().toISOString()
  );

  const skuMissing = queries.findMissingSku(snapshot, lines);
  if (skuMissing) {
    throw new BusinessLogicError(
      `SKU is missing on ${skuMissing.missing} ${skuMissing.id} — add a SKU before accepting orders`,
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { [skuMissing.missing === "variant" ? "variantId" : "productId"]: skuMissing.id }
    );
  }

  const stockError = queries.findStockShortfall(snapshot, lines);
  if (stockError) {
    throw new BusinessLogicError(stockError, ERROR_CODES.INSUFFICIENT_STOCK);
  }

  await assertOtpVerification(c, db, data);

  // Resolves each product's own shipping profile and the commune-level
  // override, not just the default profile's wilaya rate. A basket spanning
  // two profiles pays the highest applicable rate (plan Q1).
  // Priced from the same snapshot the engine will use, so the number the
  // free-delivery threshold is judged against is the number the customer is
  // charged — they cannot drift apart.
  const { subtotal } = priceCartLines(snapshot, lines);

  const deliveryFee = await queries.resolveDeliveryFee(db, {
    productIds: [...new Set(lines.map((l) => l.productId))],
    wilayaId: data.wilayaId,
    communeId: data.communeId,
    deliveryType: data.deliveryType,
    storeId: c.get("storeId"),
    subtotal,
  });

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

  const order = await queries.createStoreOrder(
    db,
    {
      ...data,
      customerId: customer.id,
      customerName: customer.name,
      deliveryFee,
      landingPageId,
      ipAddress,
      userAgent,
    },
    snapshot
  );

  // Meta CAPI conversion event at checkout — evaluated against merchant's tracking mode.
  // When mode is instant "Purchase", sends Purchase (matching the thank-you Pixel).
  // When mode is "Lead", sends Lead (matching the thank-you Pixel).
  // When mode is "Purchase_Confirmed" or "Purchase_Delivered", skips at checkout
  // and fires down-funnel via server CAPI.
  if (c.env.CAPI_WORKFLOW) {
    try {
      const storeId = c.get("storeId");
      const tracking =
        storeId && typeof db.select === "function"
          ? await resolveTrackingConfig(db, { storeId, landingPageId })
          : null;
      const decision = resolveConversionForStage(tracking?.conversionEvent, "checkout");

      if (decision.shouldFire && decision.eventName) {
        let storeRow: { domain: string | null } | undefined = undefined;
        if (storeId && typeof db.select === "function") {
          storeRow = await db
            .select({ domain: stores.domain })
            .from(stores)
            .where(eq(stores.id, storeId))
            .get();
        }

        // The landing page the ad pointed at, when this order came from one —
        // same rule the Workflow uses for every later stage, so an order's
        // source URL does not change between its checkout and delivery events.
        //
        // Keyed on landingPageId, not the raw slug: attribution is
        // best-effort, and a slug that did not resolve is not this order's
        // page. The Workflow reads the attributed page from the order, so
        // naming an unresolved slug here would give one order two source URLs.
        let eventSourceUrl = conversionSourceUrl(
          storeRow?.domain,
          landingPageId ? data.landingPageSlug : null,
        );

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

/**
 * POST /store/cart/validate
 *
 * Re-prices and re-checks a basket so the cart drawer can tell the truth
 * before the shopper commits. Read-only: nothing is written and no stock is
 * reserved.
 *
 * It answers from the SAME snapshot, the SAME pricing function and the SAME
 * offer rules the order engine uses, which is what makes the displayed total
 * and the charged total identical by construction rather than by agreement.
 *
 * The free-delivery figure is subtotal-based, so it can be answered before the
 * shopper has typed an address. Delivery itself still depends on the wilaya
 * and is resolved at checkout.
 */
export async function validateCart(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const bodyData: any = (c.req as any).valid?.("json");
  const data: import("./validation").ValidateCartInput =
    bodyData ?? validateCartSchema.parse(await c.req.json());

  let lines: CartLine[];
  try {
    lines = normalizeOrderLines({
      productId: data.items[0].productId,
      productName: data.items[0].productName,
      quantity: data.items[0].quantity,
      items: data.items,
    });
  } catch (err) {
    if (err instanceof CartValidationError) {
      throw new ValidationError(err.message, ERROR_CODES.VALUE_OUT_OF_RANGE, err.detail);
    }
    throw err;
  }

  const now = new Date().toISOString();
  const snapshot = await queries.loadCatalogSnapshot(db, lines, now);
  const resolved = queries.resolveCartLines(snapshot, lines);

  // Only orderable lines count toward the subtotal and the offers. A line the
  // shopper must fix should not inflate a free-delivery promise it cannot keep.
  const orderable = resolved.filter((entry) => entry.blocker === null);
  const subtotal = orderable.reduce((sum, entry) => sum + entry.lineTotal, 0);

  const { earned, freeShipping } = queries.resolveCartOffers(
    orderable.map((entry) => entry.line),
    snapshot.offers,
  );

  const storeId = c.get("storeId");
  const store = storeId
    ? await db
        .select({ freeShippingThreshold: stores.freeShippingThreshold })
        .from(stores)
        .where(eq(stores.id, storeId))
        .get()
    : undefined;
  const threshold = store?.freeShippingThreshold ?? null;
  const thresholdActive = threshold != null && threshold > 0;

  return c.json(
    {
      success: true,
      data: {
        lines: resolved.map((entry) => ({
          productId: entry.line.productId,
          variantId: entry.line.variantId,
          variantLabel: entry.line.variantLabel,
          productName: entry.productName,
          quantity: entry.line.quantity,
          unitPrice: entry.unitPrice,
          lineTotal: entry.lineTotal,
          maxQuantity: entry.maxQuantity,
          blocker: entry.blocker,
        })),
        subtotal,
        rewards: earned.map((item) => ({
          offerId: item.offer.id,
          productId: item.offer.rewardProductId,
          productName:
            (item.offer.rewardProductId
              ? snapshot.products.get(item.offer.rewardProductId)?.name
              : null) ?? null,
          quantity: item.offer.rewardQuantity,
        })),
        freeDelivery: {
          /** Earned by a single-product basket's free-shipping offer. */
          fromOffer: freeShipping,
          threshold: thresholdActive ? threshold : null,
          qualified: thresholdActive ? subtotal >= threshold : false,
          /** How much more to spend to qualify. 0 once qualified or inactive. */
          remaining:
            thresholdActive && subtotal < threshold ? threshold - subtotal : 0,
        },
      },
    },
    200,
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
