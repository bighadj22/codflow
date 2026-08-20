import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { getDb } from "@/db";

/**
 * AI Tools for Review Moderation
 *
 * Reviews are submitted by customers via the storefront after placing an order.
 * They require moderation before appearing publicly on product pages.
 *
 * Moderation statuses:
 *   pending  → newly submitted, not yet reviewed (default)
 *   approved → visible on the storefront product page
 *   rejected → hidden from storefront, kept in the CRM for audit
 *
 * Key domain facts:
 *   - Only "approved" reviews contribute to a product's avgRating and reviewCount.
 *   - pendingCount is always returned by listReviews regardless of filters —
 *     it drives the dashboard moderation badge.
 *   - Reviews cannot be edited — only their status can be changed.
 *   - deleteReview is permanent (hard delete, no soft-delete).
 *   - Each review is linked to an orderId and orderNumber for traceability.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): Strict validation inside execute() with graceful error handling
 */

// Inline schemas — reviews has no separate validation.ts
const reviewStatusEnum = z.enum(["pending", "approved", "rejected"]);

const reviewFiltersSchema = z.object({
  status: reviewStatusEnum.optional(),
  productId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getReviewTools = (db: ReturnType<typeof getDb>) => ({

  listReviews: tool({
    description:
      "List product reviews with optional filters. Returns reviews ordered newest-first. " +
      "Response always includes pendingCount (total pending reviews across all products — used for the moderation badge). " +
      "Optional filters: status (pending|approved|rejected), productId (UUID to see reviews for one product), " +
      "limit (1-100, default 20), offset (default 0). " +
      "Use status: 'pending' to find reviews awaiting moderation.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const parsed = reviewFiltersSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid filter arguments: ${errorDetails}. Expected: status (pending|approved|rejected, optional), productId (UUID, optional), limit (1-100, default 20), offset (int >= 0, default 0)`,
        };
      }

      try {
        const { rows, total, pendingCount } = await queries.getAllReviews(db, parsed.data);
        return {
          success: true,
          count: rows.length,
          total,
          pendingCount,
          reviews: rows.map((r) => ({
            id: r.id,
            productId: r.productId,
            productName: r.productName,
            orderId: r.orderId,
            orderNumber: r.orderNumber,
            customerName: r.customerName,
            rating: r.rating,
            title: r.title,
            body: r.body,
            status: r.status,
            helpfulCount: r.helpfulCount,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
        };
      } catch (error: any) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    },
  }),

  moderateReview: tool({
    description:
      "Approves, rejects, or resets a review back to pending. " +
      "Required: reviewId (UUID), status (approved|rejected|pending). " +
      "approved → review becomes visible on the storefront and counts toward the product's rating. " +
      "rejected → review is hidden from the storefront but kept in the CRM for audit. " +
      "pending  → resets a previously moderated review back to the queue.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        reviewId: z.string().uuid().describe("UUID of the review to moderate"),
        status: reviewStatusEnum.describe("New moderation status: approved | rejected | pending"),
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: reviewId (UUID), status (approved|rejected|pending)`,
        };
      }

      try {
        const existing = await queries.getReviewById(db, parsed.data.reviewId);
        if (!existing) {
          return {
            success: false,
            error: `Review not found with ID: ${parsed.data.reviewId}`,
          };
        }

        const updated = await queries.updateReviewStatus(db, parsed.data.reviewId, parsed.data.status);
        return {
          success: true,
          review: updated,
          message: `Review by "${existing.customerName}" (rating: ${existing.rating}/5) ${parsed.data.status === "approved" ? "approved — now visible on storefront" : parsed.data.status === "rejected" ? "rejected — hidden from storefront" : "reset to pending"}`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to update review: ${error.message}` };
      }
    },
  }),

  deleteReview: tool({
    description:
      "Permanently deletes a review. This action is irreversible. " +
      "Consider rejecting the review instead (moderateReview with status: 'rejected') " +
      "if you want to keep it for audit purposes without showing it on the storefront.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      // Layer 2: Strict validation
      const validationSchema = z.object({
        reviewId: z.string().uuid().describe("UUID of the review to delete"),
      });

      const parsed = validationSchema.safeParse(args);

      if (!parsed.success) {
        const errorDetails = parsed.error.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        return {
          success: false,
          error: `Invalid arguments: ${errorDetails}. Expected: reviewId (UUID string)`,
        };
      }

      try {
        const existing = await queries.getReviewById(db, parsed.data.reviewId);
        if (!existing) {
          return {
            success: false,
            error: `Review not found with ID: ${parsed.data.reviewId}`,
          };
        }

        await queries.deleteReview(db, parsed.data.reviewId);
        return {
          success: true,
          message: `Review by "${existing.customerName}" (order: ${existing.orderNumber}, rating: ${existing.rating}/5) deleted permanently`,
        };
      } catch (error: any) {
        return { success: false, error: `Failed to delete review: ${error.message}` };
      }
    },
  }),
});
