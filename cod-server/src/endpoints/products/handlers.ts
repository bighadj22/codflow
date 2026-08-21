import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, BusinessLogicError, ConflictError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export async function listProducts(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const queryData: any = (c.req as any).valid?.("query");
  const filters = queryData ?? validation.productFiltersSchema.parse({
    categoryId: c.req.query("categoryId"),
    status: c.req.query("status"),
    visibility: c.req.query("visibility"),
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const data = await queries.getAllProducts(db, filters);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getProduct(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const product = await queries.getProductById(db, productId);
  if (!product) {
    throw new NotFoundError("Product", productId);
  }
  return c.json({ success: true, data: product }, 200);
}

export async function createProduct(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const jsonData: any = (c.req as any).valid?.("json");
  const validated = jsonData ?? validation.createProductSchema.parse(await c.req.json());
  
  // Check for duplicate SKU if provided
  if (validated.sku) {
    const { products } = await import("@/db/schema");
    const { eq, isNull, and } = await import("drizzle-orm");
    const existingProduct = await db.select().from(products)
      .where(and(eq(products.sku, validated.sku), isNull(products.deletedAt)))
      .get();
    if (existingProduct) {
      throw new ConflictError(
        `Product with SKU "${validated.sku}" already exists`,
        ERROR_CODES.DUPLICATE_SKU,
        { sku: validated.sku, existingProductId: existingProduct.id }
      );
    }
  }
  
  const product = await queries.createProduct(db, validated);
  if (!product) {
    throw new SystemError("Failed to create product");
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.PRODUCT_CREATED, {
    type: "product", id: product.id, label: validated.name,
  });
  return c.json({ success: true, data: product }, 201);
}

export async function updateProduct(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const jsonData: any = (c.req as any).valid?.("json");
  const validated = jsonData ?? validation.updateProductSchema.parse(await c.req.json());
  const product = await queries.updateProduct(db, productId, validated);
  if (!product) {
    throw new NotFoundError("Product", productId);
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.PRODUCT_UPDATED, {
    type: "product", id: product.id, label: product.name,
  });
  return c.json({ success: true, data: product }, 200);
}

export async function updateProductStatus(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const productId = c.req.param("id")!;
  const jsonData: any = (c.req as any).valid?.("json");
  const { status } = jsonData ?? validation.updateStatusSchema.parse(await c.req.json());
  const product = await queries.updateProduct(db, productId, { status });
  if (!product) {
    throw new NotFoundError("Product", productId);
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.PRODUCT_STATUS_CHANGED, {
    type: "product", id: product.id, label: product.name,
  }, { status });
  return c.json({ success: true, data: product }, 200);
}

export async function deleteProduct(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const existing = await queries.getProductById(db, id);
  if (!existing) {
    throw new NotFoundError("Product", id);
  }
  
  // Check if product has orders
  const { orderProducts } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const ordersWithProduct = await db.select().from(orderProducts).where(eq(orderProducts.productId, id)).get();
  if (ordersWithProduct) {
    throw new BusinessLogicError(
      "Cannot delete product with existing orders",
      ERROR_CODES.PRODUCT_HAS_ORDERS,
      { productId: id, productName: existing.name }
    );
  }
  
  await queries.deleteProduct(db, id);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.PRODUCT_DELETED, { type: "product", id });
  return c.json({ success: true, message: "Product deleted" }, 200);
}
