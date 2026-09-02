import { apiFetch } from "@/lib/api";
import type { Review, ReviewListResult, ReviewStatus } from "./types";

interface ReviewListEnvelope {
  success: boolean;
  data: Review[];
  count?: number;
  total: number;
  pendingCount: number;
}

interface DataEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function json(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  };
}

export interface ReviewListParams {
  status?: ReviewStatus;
  productId?: string;
  limit?: number;
  offset?: number;
}

export async function listReviews(params: ReviewListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  });
  for (const key of ["status", "productId"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const envelope = await apiFetch<ReviewListEnvelope>(`/api/reviews?${query}`);
  return { rows: envelope.data, total: envelope.total, pendingCount: envelope.pendingCount } satisfies ReviewListResult;
}

export function updateReviewStatus(id: string, status: ReviewStatus) {
  return apiFetch<DataEnvelope<Review>>(`/api/reviews/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify({ status }) }));
}

export function deleteReview(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
}
