import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as q from "./queries";
import * as v from "./validation";
import { NotFoundError, ValidationError, BusinessLogicError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export async function listGroups(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const query: any = (c.req as any).valid?.("query");
  const filters = query ?? v.groupFiltersSchema.parse({
    search: c.req.query("search"),
    parentId: c.req.query("parentId"),
  });
  const data = await q.getAllGroups(db, filters);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const group = await q.getGroupById(db, id);
  if (!group) {
    throw new NotFoundError("Product Group", id);
  }
  return c.json({ success: true, data: group }, 200);
}

export async function createGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? v.createGroupSchema.parse(await c.req.json());
  const group = await q.createGroup(db, body);
  if (!group) {
    throw new SystemError("Failed to create product group");
  }
  return c.json({ success: true, data: group }, 201);
}

export async function updateGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const jsonBody: any = (c.req as any).valid?.("json");
  const body = jsonBody ?? v.updateGroupSchema.parse(await c.req.json());
  const group = await q.updateGroup(db, id, body);
  if (!group) {
    throw new NotFoundError("Product Group", id);
  }
  return c.json({ success: true, data: group }, 200);
}

export async function deleteGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  
  // Check if group exists
  const group = await q.getGroupById(db, id);
  if (!group) {
    throw new NotFoundError("Product Group", id);
  }
  
  // Check if group has products
  if (group.productsCount > 0) {
    throw new BusinessLogicError(
      "Cannot delete product group with existing products",
      ERROR_CODES.PRODUCT_GROUP_HAS_PRODUCTS,
      {
        groupId: id,
        groupName: group.name,
        productsCount: group.productsCount,
      }
    );
  }
  
  await q.deleteGroup(db, id);
  return c.json({ success: true }, 200);
}
