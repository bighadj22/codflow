import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, BusinessLogicError, ConflictError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export async function listTags(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const filters = validation.customerTagFiltersSchema.parse({
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const tags = await queries.getAllTags(db, filters);
  return c.json({ success: true, data: tags, count: tags.length });
}

export async function getTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const tagId = c.req.param("id")!;
  const withCustomers = c.req.query("customers") === "true";
  const tag = withCustomers
    ? await queries.getTagWithCustomers(db, tagId)
    : await queries.getTagById(db, tagId);
  if (!tag) {
    throw new NotFoundError("customer_tag", tagId);
  }
  return c.json({ success: true, data: tag });
}

export async function createTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const validated = validation.createCustomerTagSchema.parse(await c.req.json());
  const tag = await queries.createTag(db, validated);
  const actor = c.get("user");
  if (tag) {
    await logActivity(db, actor, ACTIONS.CUSTOMER_TAG_CREATED, {
      type: "customer_tag", id: tag.id, label: tag.name,
    });
  }
  return c.json({ success: true, data: tag, message: "Tag created" }, 201);
}

export async function updateTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const tagId = c.req.param("id")!;
  const validated = validation.updateCustomerTagSchema.parse(await c.req.json());
  const tag = await queries.updateTag(db, tagId, validated);
  if (!tag) {
    throw new NotFoundError("customer_tag", tagId);
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_TAG_UPDATED, {
    type: "customer_tag", id: tagId, label: tag.name,
  });
  return c.json({ success: true, data: tag });
}

export async function deleteTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const tagId = c.req.param("id")!;
  const tag = await queries.getTagById(db, tagId);
  if (!tag) {
    throw new NotFoundError("customer_tag", tagId);
  }
  
  // Check if tag has assignments before deletion
  if (tag.assignmentCount > 0) {
    throw new BusinessLogicError(
      "Cannot delete tag with assignments",
      ERROR_CODES.TAG_HAS_ASSIGNMENTS,
      {
        tagId,
        tagName: tag.name,
        assignmentCount: tag.assignmentCount,
      }
    );
  }
  
  await queries.deleteTag(db, tagId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_TAG_DELETED, {
    type: "customer_tag", id: tagId, label: tag.name,
  });
  return c.json({ success: true, message: "Tag deleted" });
}

export async function assignTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const tagId = c.req.param("id")!;
  const { customerId } = validation.assignTagSchema.parse(await c.req.json());

  const tag = await queries.getTagById(db, tagId);
  if (!tag) {
    throw new NotFoundError("customer_tag", tagId);
  }

  const customer = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) {
    throw new NotFoundError("customer", customerId);
  }

  await queries.assignTag(db, tagId, customerId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_TAG_ASSIGNED, {
    type: "customer_tag", id: tagId, label: tag.name,
  }, { customerId });
  return c.json({ success: true, message: "Tag assigned" });
}

export async function unassignTag(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const tagId = c.req.param("id")!;
  const customerId = c.req.param("customerId")!;

  const tag = await queries.getTagById(db, tagId);
  if (!tag) {
    throw new NotFoundError("customer_tag", tagId);
  }

  await queries.unassignTag(db, tagId, customerId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_TAG_UNASSIGNED, {
    type: "customer_tag", id: tagId, label: tag.name,
  }, { customerId });
  return c.json({ success: true, message: "Tag unassigned" });
}
