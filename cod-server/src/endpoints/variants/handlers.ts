import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as q from "./queries";
import * as v from "./validation";
import { NotFoundError, BusinessLogicError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export async function listVariants(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await q.getVariantsByProduct(db, c.req.param("productId")!);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getVariant(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const variantId = c.req.param("variantId")!;
  const variant = await q.getVariantById(db, variantId);
  if (!variant) {
    throw new NotFoundError("Variant", variantId);
  }
  return c.json({ success: true, data: variant }, 200);
}

export async function createVariant(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("productId")!;
  const jsonData: any = (c.req as any).valid?.("json");
  const body = jsonData ?? v.createVariantSchema.parse(await c.req.json());
  const variant = await q.createVariant(db, productId, body);
  if (!variant) {
    throw new SystemError("Failed to create variant");
  }
  return c.json({ success: true, data: variant }, 201);
}

export async function updateVariant(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const variantId = c.req.param("variantId")!;
  const jsonData: any = (c.req as any).valid?.("json");
  const body = jsonData ?? v.updateVariantSchema.parse(await c.req.json());
  const variant = await q.updateVariant(db, variantId, body);
  if (!variant) {
    throw new NotFoundError("Variant", variantId);
  }
  return c.json({ success: true, data: variant }, 200);
}

export async function deleteVariant(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const variantId = c.req.param("variantId")!;
  const productId = c.req.param("productId")!;

  const existing = await q.getVariantById(db, variantId);
  if (!existing) {
    throw new NotFoundError("Variant", variantId);
  }

  try {
    await q.deleteVariant(db, variantId);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Cannot delete")) {
      throw new BusinessLogicError(
        err.message,
        ERROR_CODES.VARIANT_HAS_ORDERS,
        { variantId, productId }
      );
    }
    throw err;
  }
  return c.json({ success: true }, 200);
}
