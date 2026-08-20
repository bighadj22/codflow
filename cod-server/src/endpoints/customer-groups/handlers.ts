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

export async function listGroups(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const filters = validation.customerGroupFiltersSchema.parse({
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const groups = await queries.getAllGroups(db, filters);
  return c.json({ success: true, data: groups, count: groups.length });
}

export async function getGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const groupId = c.req.param("id")!;
  const withMembers = c.req.query("members") === "true";
  const group = withMembers
    ? await queries.getGroupWithMembers(db, groupId)
    : await queries.getGroupById(db, groupId);
  if (!group) {
    throw new NotFoundError("customer_group", groupId);
  }
  return c.json({ success: true, data: group });
}

export async function createGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const validated = validation.createCustomerGroupSchema.parse(await c.req.json());
  const group = await queries.createGroup(db, validated);
  const actor = c.get("user");
  if (group) {
    await logActivity(db, actor, ACTIONS.CUSTOMER_GROUP_CREATED, {
      type: "customer_group", id: group.id, label: group.name,
    });
  }
  return c.json({ success: true, data: group, message: "Group created" }, 201);
}

export async function updateGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const groupId = c.req.param("id")!;
  const validated = validation.updateCustomerGroupSchema.parse(await c.req.json());
  const group = await queries.updateGroup(db, groupId, validated);
  if (!group) {
    throw new NotFoundError("customer_group", groupId);
  }
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_GROUP_UPDATED, {
    type: "customer_group", id: groupId, label: group.name,
  });
  return c.json({ success: true, data: group });
}

export async function deleteGroup(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const groupId = c.req.param("id")!;
  const group = await queries.getGroupById(db, groupId);
  if (!group) {
    throw new NotFoundError("customer_group", groupId);
  }
  
  // Check if group has members before deletion
  if (group.memberCount > 0) {
    throw new BusinessLogicError(
      "Cannot delete group with members",
      ERROR_CODES.GROUP_HAS_MEMBERS,
      {
        groupId,
        groupName: group.name,
        memberCount: group.memberCount,
      }
    );
  }
  
  await queries.deleteGroup(db, groupId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_GROUP_DELETED, {
    type: "customer_group", id: groupId, label: group.name,
  });
  return c.json({ success: true, message: "Group deleted" });
}

export async function addMember(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const groupId = c.req.param("id")!;
  const { customerId } = validation.addMemberSchema.parse(await c.req.json());

  const group = await queries.getGroupById(db, groupId);
  if (!group) {
    throw new NotFoundError("customer_group", groupId);
  }

  const customer = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) {
    throw new NotFoundError("customer", customerId);
  }

  await queries.addMember(db, groupId, customerId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_GROUP_MEMBER_ADDED, {
    type: "customer_group", id: groupId, label: group.name,
  }, { customerId });
  return c.json({ success: true, message: "Member added" });
}

export async function removeMember(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const groupId = c.req.param("id")!;
  const customerId = c.req.param("customerId")!;

  const group = await queries.getGroupById(db, groupId);
  if (!group) {
    throw new NotFoundError("customer_group", groupId);
  }

  await queries.removeMember(db, groupId, customerId);
  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_GROUP_MEMBER_REMOVED, {
    type: "customer_group", id: groupId, label: group.name,
  }, { customerId });
  return c.json({ success: true, message: "Member removed" });
}
