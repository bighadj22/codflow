/**
 * Activity Log Schemas
 *
 * Audit trail for all system actions.
 */

import { z } from "@hono/zod-openapi";

export const ActivityLogSchema = z
  .object({
    id: z.string(),
    actorId: z.string(),
    actorName: z.string().openapi({ example: "Ahmed Benali" }),
    actorRole: z.enum(["admin", "staff"]),
    action: z.string().openapi({
      description:
        'Dot-notation action identifier. Valid values: `order.created`, `order.status_changed`, `order.driver_assigned`, `order.dispatched`, `order.deleted`, `customer.created`, `customer.updated`, `customer.deleted`, `customer_group.created`, `customer_group.updated`, `customer_group.deleted`, `customer_group.member_added`, `customer_group.member_removed`, `customer_tag.created`, `customer_tag.updated`, `customer_tag.deleted`, `customer_tag.assigned`, `customer_tag.unassigned`, `driver.created`, `driver.updated`, `driver.status_changed`, `driver.deleted`, `product.created`, `product.updated`, `product.status_changed`, `product.deleted`, `review.approved`, `review.rejected`, `review.deleted`, `user.created`, `user.updated`, `user.role_changed`, `user.scope_granted`, `user.scope_revoked`, `user.api_key_generated`, `user.api_key_revoked`',
      example: "order.created",
    }),
    entityType: z.string().openapi({
      description:
        'Entity category the action applies to. Valid values: `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `review`, `user`',
      example: "order",
    }),
    entityId: z.string(),
    entityLabel: z.string().nullable().openapi({
      example: "ORD-0042",
      description:
        "Human-readable label at the time of action (order number, customer name, etc.)",
    }),
    metadata: z.string().nullable().openapi({
      description:
        "JSON-encoded extra context. Shape varies by action: `{ from, to }` for `order.status_changed`, `{ amount }` for payments, `{ scope }` for permission changes, `{ role }` for role changes, `{ rating, orderNumber }` for review actions",
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("ActivityLog");
