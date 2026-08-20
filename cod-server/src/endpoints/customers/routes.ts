/**
 * Customers Routes
 * 
 * Defines all customer management API endpoints with RBAC protection.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const customers = new Hono<AppContext>();

// GET /customers - List all customers with filtering
customers.get("/", requireScope(SCOPES.CUSTOMERS_READ), handlers.listCustomers);

// GET /customers/:id/orders - Get orders for a specific customer
customers.get("/:id/orders", requireScope(SCOPES.CUSTOMERS_READ), handlers.listCustomerOrders);

// GET /customers/:id/groups - Get groups for a specific customer
customers.get("/:id/groups", requireScope(SCOPES.CUSTOMER_GROUPS_READ), handlers.listCustomerGroups);

// GET /customers/:id/tags - Get tags for a specific customer
customers.get("/:id/tags", requireScope(SCOPES.CUSTOMER_TAGS_READ), handlers.listCustomerTags);

// GET /customers/:id - Get single customer
customers.get("/:id", requireScope(SCOPES.CUSTOMERS_READ), handlers.getCustomer);

// POST /customers - Create new customer
customers.post("/", requireScope(SCOPES.CUSTOMERS_CREATE), handlers.createCustomer);

// PATCH /customers/:id - Update customer information
customers.patch("/:id", requireScope(SCOPES.CUSTOMERS_UPDATE), handlers.updateCustomer);

// DELETE /customers/:id - Delete customer
customers.delete("/:id", requireScope(SCOPES.CUSTOMERS_DELETE), handlers.deleteCustomer);

export default customers;