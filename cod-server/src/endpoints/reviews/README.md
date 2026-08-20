# Product Reviews & Moderation API

Comprehensive API for managing and moderating product reviews submitted by customers. This module allows admins to approve or reject reviews before they appear on the storefront.

## Structure

```
reviews/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## Moderation Workflow

Reviews are typically submitted through the storefront and enter the system with a `pending` status. 

1. **Pending Queue:** Admins use `GET /api/reviews?status=pending` to view items requiring attention.
2. **Review Action:** Admins can `approve` or `reject` a review via the `PATCH` endpoint.
3. **Storefront Display:** Only `approved` reviews are factored into a product's average rating and visible to other customers.

## API Endpoints

### GET /api/reviews
List all reviews with comprehensive filtering and metadata.

**Authorization:** Requires `reviews:read` scope

**Query Parameters:**
- `status` - Filter by moderation state (`pending`, `approved`, `rejected`)
- `productId` - Filter reviews for a specific product.
- `limit` - Pagination limit (default: 20, max: 100).
- `offset` - Pagination offset (default: 0).

**Response Includes:**
- `rows`: Array of reviews, each joined with its corresponding `productName`.
- `total`: Total number of reviews matching the current filters.
- `pendingCount`: **Global count** of all pending reviews (ignoring filters). This is used by the frontend to display notification badges on the sidebar/dashboard.

### PATCH /api/reviews/:id
Update the moderation status of a review.

**Authorization:** Requires `reviews:manage` scope

**Request Body:**
```json
{
  "status": "approved"
}
```

**Side Effects:**
- **Activity Logging:** Records a `review.approved` or `review.rejected` action in the audit trail.
- **Timestamping:** Updates the `updatedAt` field.

### DELETE /api/reviews/:id
Permanently delete a review from the database.

**Authorization:** Requires `reviews:manage` scope

**Side Effects:**
- **Activity Logging:** Records a `review.deleted` action.
- **Rating Update:** Automatically affects the product's average rating (since the review no longer exists).

## Implementation Details

- **Database Joins:** The list query performs a `leftJoin` with the `products` table to provide the product name directly in the review object, reducing the need for extra frontend lookups.
- **Real-time Metrics:** The `pendingCount` is recalculated with every list request to ensure that moderation badges in the UI are always accurate.
- **Audit Trail:** Every moderation action (approval, rejection, deletion) is logged with the actor's details and includes the original review's rating and order number in the metadata.
- **RBAC:** Strictly separates viewing (`reviews:read`) from management/moderation (`reviews:manage`).
