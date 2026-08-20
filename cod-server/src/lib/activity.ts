/**
 * Activity Log System
 *
 * Centralized helper for writing audit log entries.
 * Only admins can read activity logs via the API.
 *
 * logActivity() silently swallows errors so that audit failures
 * never break the primary business operation.
 */

import { activityLogs } from "@/db/schema";
import type { AppDb } from "@/db";
import type { AuthUser } from "@/types";

// ─── Action Constants ─────────────────────────────────────────────────────────

export const ACTIONS = {
  // Orders
  ORDER_CREATED:           "order.created",
  ORDER_STATUS_CHANGED:    "order.status_changed",
  ORDER_DRIVER_ASSIGNED:   "order.driver_assigned",
  ORDER_DISPATCHED:        "order.dispatched",
  ORDER_PRODUCT_RETURNED:  "order.product_returned",
  ORDER_DELETED:           "order.deleted",

  // Customers
  CUSTOMER_CREATED:        "customer.created",
  CUSTOMER_UPDATED:        "customer.updated",
  CUSTOMER_DELETED:        "customer.deleted",

  // Customer Groups
  CUSTOMER_GROUP_CREATED:        "customer_group.created",
  CUSTOMER_GROUP_UPDATED:        "customer_group.updated",
  CUSTOMER_GROUP_DELETED:        "customer_group.deleted",
  CUSTOMER_GROUP_MEMBER_ADDED:   "customer_group.member_added",
  CUSTOMER_GROUP_MEMBER_REMOVED: "customer_group.member_removed",

  // Customer Tags
  CUSTOMER_TAG_CREATED:          "customer_tag.created",
  CUSTOMER_TAG_UPDATED:          "customer_tag.updated",
  CUSTOMER_TAG_DELETED:          "customer_tag.deleted",
  CUSTOMER_TAG_ASSIGNED:         "customer_tag.assigned",
  CUSTOMER_TAG_UNASSIGNED:       "customer_tag.unassigned",

  // Drivers
  DRIVER_CREATED:          "driver.created",
  DRIVER_UPDATED:          "driver.updated",
  DRIVER_STATUS_CHANGED:   "driver.status_changed",
  DRIVER_DELETED:          "driver.deleted",

  // Products
  PRODUCT_CREATED:         "product.created",
  PRODUCT_UPDATED:         "product.updated",
  PRODUCT_STATUS_CHANGED:  "product.status_changed",
  PRODUCT_DELETED:         "product.deleted",

  // Stock
  STOCK_ADJUSTED:          "stock.adjusted",

  // Reviews
  REVIEW_APPROVED:         "review.approved",
  REVIEW_REJECTED:         "review.rejected",
  REVIEW_DELETED:          "review.deleted",

  // Users / Team
  USER_CREATED:            "user.created",
  USER_UPDATED:            "user.updated",
  USER_ROLE_CHANGED:       "user.role_changed",
  USER_SCOPE_GRANTED:      "user.scope_granted",
  USER_SCOPE_REVOKED:      "user.scope_revoked",

  // MCP — one row per remote MCP tool call (success or failure),
  // plus one row for user-declined HITL elicitations. Lets ops audit
  // exactly what each AI agent did, and when it was told "no".
  MCP_TOOL_CALLED:         "mcp.tool_called",
  MCP_TOOL_DECLINED:       "mcp.tool_declined",
  /** User or admin revoked an MCP client's access from the /mcp page. */
  MCP_CONNECTION_REVOKED:  "mcp.connection_revoked",
} as const;

export type ActivityAction = (typeof ACTIONS)[keyof typeof ACTIONS];

// ─── Helper ───────────────────────────────────────────────────────────────────

export async function logActivity(
  db: AppDb,
  actor: Pick<AuthUser, "id" | "name" | "role">,
  action: ActivityAction,
  entity: { type: string; id: string; label?: string | null },
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      actorName: actor.name ?? "Unknown",
      actorRole: actor.role,
      action,
      entityType: entity.type,
      entityId: entity.id,
      entityLabel: entity.label ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[activity] Failed to log:", action, entity.id, err);
  }
}
