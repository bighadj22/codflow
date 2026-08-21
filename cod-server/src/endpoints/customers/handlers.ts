/**
 * Customers Route Handlers
 * 
 * HTTP handlers for customer management CRUD operations.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { logActivity, ACTIONS } from "@/lib/activity";
import { NotFoundError, ValidationError, BusinessLogicError, ConflictError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/**
 * GET /customers
 * List all customers with optional filters
 */
export async function listCustomers(c: Context<AppContext>) {
  const db = getDb(c.env.DB);

  const query: any = (c.req as any).valid?.("query");
  const filters = query ?? validation.customerFiltersSchema.parse({
    wilayaId: c.req.query("wilayaId"),
    search: c.req.query("search"),
    groupId: c.req.query("groupId"),
    tagId: c.req.query("tagId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  const customers = await queries.getAllCustomers(db, filters);

  return c.json({
    success: true,
    data: customers,
    count: customers.length,
  }, 200);
}

/**
 * GET /customers/:id
 * Get single customer by ID
 */
export async function getCustomer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");

  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  const customer = await queries.getCustomerById(db, customerId);

  if (!customer) {
    throw new NotFoundError("Customer", customerId);
  }

  return c.json({
    success: true,
    data: customer,
  }, 200);
}

/**
 * POST /customers
 * Create new customer
 */
export async function createCustomer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? validation.createCustomerSchema.parse(await c.req.json());

  // Check for duplicate phone number
  const existingCustomer = await queries.getCustomerByPhone(db, validated.phone);
  if (existingCustomer) {
    throw new ConflictError(
      "A customer with this phone number already exists",
      ERROR_CODES.DUPLICATE_PHONE,
      { phone: validated.phone, existingCustomerId: existingCustomer.id }
    );
  }

  const customer = await queries.createCustomer(db, validated);

  if (!customer) {
    throw new SystemError("Failed to create customer");
  }

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_CREATED, {
    type: "customer", id: customer.id, label: customer.name,
  });

  return c.json(
    {
      success: true,
      data: customer,
      message: "Customer created successfully",
    },
    201
  );
}

/**
 * PATCH /customers/:id
 * Update customer information
 */
export async function updateCustomer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");
  
  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }
  
  const body = await c.req.json();

  // Validate request body
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? validation.updateCustomerSchema.parse(body);

  // Check if phone is being updated and if it's a duplicate
  if (validated.phone) {
    const existingCustomer = await queries.getCustomerByPhone(db, validated.phone);
    if (existingCustomer && existingCustomer.id !== customerId) {
      throw new ConflictError(
        "A customer with this phone number already exists",
        ERROR_CODES.DUPLICATE_PHONE,
        { phone: validated.phone, existingCustomerId: existingCustomer.id }
      );
    }
  }

  const customer = await queries.updateCustomer(db, customerId, validated);

  if (!customer) {
    throw new NotFoundError("Customer", customerId);
  }

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_UPDATED, {
    type: "customer", id: customerId, label: customer.name,
  });

  return c.json({
    success: true,
    data: customer,
    message: "Customer updated successfully",
  }, 200);
}

/**
 * GET /customers/:id/orders
 * Get all orders for a specific customer
 */
export async function listCustomerOrders(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");

  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  const orders = await queries.getOrdersByCustomerId(db, customerId);

  return c.json({
    success: true,
    data: orders,
    count: orders.length,
  }, 200);
}

/**
 * GET /customers/:id/groups
 * Get all groups a customer belongs to
 */
export async function listCustomerGroups(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");

  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  const groups = await queries.getCustomerGroupMemberships(db, customerId);
  return c.json({ success: true, data: groups }, 200);
}

/**
 * GET /customers/:id/tags
 * Get all tags assigned to a customer
 */
export async function listCustomerTags(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");

  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  const tags = await queries.getCustomerTagMemberships(db, customerId);
  return c.json({ success: true, data: tags }, 200);
}

/**
 * DELETE /customers/:id
 * Delete customer
 */
export async function deleteCustomer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const customerId = c.req.param("id");

  if (!customerId) {
    throw new ValidationError("Customer ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING, { field: "id" });
  }

  // Check if customer exists
  const customer = await queries.getCustomerById(db, customerId);
  if (!customer) {
    throw new NotFoundError("Customer", customerId);
  }

  await queries.deleteCustomer(db, customerId);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.CUSTOMER_DELETED, {
    type: "customer", id: customerId, label: customer.name,
  });

  return c.json({
    success: true,
    message: "Customer deleted successfully",
  }, 200);
}