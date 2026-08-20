
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getReviews } from "@/actions/reviews";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { ReviewsView } from "@/components/reviews/reviews-view";

const LIMIT = 20;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const userScopes = await getUserScopes();

  const statusParam = sp.status;
  const status =
    statusParam === "pending" || statusParam === "approved" || statusParam === "rejected"
      ? (statusParam as "pending" | "approved" | "rejected")
      : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const offset = (page - 1) * LIMIT;

  let result = { rows: [] as any[], total: 0, pendingCount: 0 };
  try {
    result = await getReviews({ status, limit: LIMIT, offset });
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
  }

  return (
    <ProtectedRoute requiredScope={SCOPES.REVIEWS_READ}>
      <ReviewsView
        reviews={result.rows}
        total={result.total}
        pendingCount={result.pendingCount}
        userScopes={userScopes}
        currentStatus={status ?? "all"}
        currentPage={page}
        limit={LIMIT}
      />
    </ProtectedRoute>
  );
}
