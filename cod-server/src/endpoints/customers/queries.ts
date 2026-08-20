/**
 * Customers Database Queries
 *
 * Pure CRUD + list helpers live in cod-shared.
 * deleteCustomer stays here because it raises BusinessLogicError.
 */

import { eq, count } from "drizzle-orm";
import { customers, orders } from "@/db/schema";
import { getDb } from "@/db";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export {
  getAllCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
  getOrdersByCustomerId,
  getCustomerGroupMemberships,
  getCustomerTagMemberships,
} from "../../../../cod-shared/queries/customers";

type Database = ReturnType<typeof getDb>;

/**
 * Delete customer. Blocks when the customer has any orders.
 */
export async function deleteCustomer(db: Database, customerId: string) {
  const customerOrders = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .get();

  const orderCount = customerOrders?.count || 0;

  if (orderCount > 0) {
    throw new BusinessLogicError(
      "Cannot delete customer with existing orders",
      ERROR_CODES.CUSTOMER_HAS_ORDERS,
      { customerId, orderCount },
    );
  }

  await db.delete(customers).where(eq(customers.id, customerId));

  return { success: true };
}
