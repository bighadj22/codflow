import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { eq, isNull, and } from "drizzle-orm";
import { products } from "@/db/schema";
import * as queries from "./queries";
import * as productsQueries from "../products/queries";
import { createUpsellSchema, updateUpsellSchema } from "./validation";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

async function assertParentProduct(db: ReturnType<typeof getDb>, productId: string) {
  const parent = await productsQueries.getProductById(db, productId);
  if (!parent) throw new NotFoundError("Product", productId);
  return parent;
}

async function assertUpsellProductExists(db: ReturnType<typeof getDb>, upsellProductId: string) {
  const row = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, upsellProductId), isNull(products.deletedAt)))
    .get();
  if (!row) throw new NotFoundError("Product", upsellProductId);
}

export async function listProductUpsells(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  await assertParentProduct(db, productId);
  const data = await queries.listProductUpsells(db, productId);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function createProductUpsell(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  await assertParentProduct(db, productId);

  const body: any = (c.req as any).valid?.("json");
  const data = body ?? createUpsellSchema.parse(await c.req.json());

  if (data.upsellProductId === productId) {
    throw new ValidationError(
      "A product cannot upsell itself",
      ERROR_CODES.VALIDATION_FAILED,
      { productId, upsellProductId: data.upsellProductId }
    );
  }
  await assertUpsellProductExists(db, data.upsellProductId);

  const result = await queries.createProductUpsell(db, {
    productId,
    upsellProductId: data.upsellProductId,
    price: data.price ?? null,
    compareAtPrice: data.compareAtPrice ?? null,
    isActive: data.isActive ?? true,
    position: data.position ?? 1,
  });

  if (result.duplicated) {
    throw new ConflictError(
      "This product already has that upsell assignment",
      ERROR_CODES.DUPLICATE_ENTITY,
      { productId, upsellProductId: data.upsellProductId }
    );
  }

  return c.json({ success: true, data: result.offers }, 201);
}

export async function updateProductUpsell(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  const upsellId = c.req.param("upsellId")!;
  await assertParentProduct(db, productId);

  const body: any = (c.req as any).valid?.("json");
  const data = body ?? updateUpsellSchema.parse(await c.req.json());

  const result = await queries.updateProductUpsell(db, upsellId, data);
  if (!result) throw new NotFoundError("ProductUpsell", upsellId);
  if (result.productId !== productId) {
    throw new NotFoundError("ProductUpsell", upsellId);
  }

  return c.json({ success: true, data: result.offers }, 200);
}

export async function deleteProductUpsell(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  const upsellId = c.req.param("upsellId")!;
  await assertParentProduct(db, productId);

  const result = await queries.deleteProductUpsell(db, upsellId);
  if (!result) throw new NotFoundError("ProductUpsell", upsellId);
  if (result.productId !== productId) {
    throw new NotFoundError("ProductUpsell", upsellId);
  }

  return c.json({ success: true, data: result.offers }, 200);
}