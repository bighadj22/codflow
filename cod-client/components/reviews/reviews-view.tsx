"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, CheckCircle, XCircle, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/use-confirm";
import { updateReviewStatus, deleteReview } from "@/actions/reviews";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { useReviews } from "@/lib/translations";
import type { Review } from "@/actions/reviews";
import { cn } from "@/lib/utils";

interface Props {
  reviews: Review[];
  total: number;
  pendingCount: number;
  userScopes: string[];
  currentStatus: "all" | "pending" | "approved" | "rejected";
  currentPage: number;
  limit: number;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "w-3.5 h-3.5",
            s <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsView({
  reviews,
  total,
  pendingCount,
  userScopes,
  currentStatus,
  currentPage,
  limit,
}: Props) {
  const t = useReviews();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "approved", "rejected"];

  const filterLabels: Record<StatusFilter, string> = {
    all:      t.filter_all,
    pending:  t.filter_pending,
    approved: t.filter_approved,
    rejected: t.filter_rejected,
  };

  const statusBadgeLabel: Record<string, string> = {
    pending:  t.status_pending,
    approved: t.status_approved,
    rejected: t.status_rejected,
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function buildUrl(status: StatusFilter, page: number) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/reviews?${qs}` : "/reviews";
  }

  function formatDate(val: string) {
    const n = Number(val);
    return (isNaN(n) ? new Date(val) : new Date(n)).toLocaleDateString("ar-DZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  async function handleApprove(review: Review) {
    startTransition(async () => {
      try {
        await updateReviewStatus(review.id, "approved");
        toast.success(t.toast_approved);
        router.refresh();
      } catch {
        toast.error(t.toast_error_update);
      }
    });
  }

  async function handleReject(review: Review) {
    startTransition(async () => {
      try {
        await updateReviewStatus(review.id, "rejected");
        toast.success(t.toast_rejected);
        router.refresh();
      } catch {
        toast.error(t.toast_error_update);
      }
    });
  }

  async function handleDelete(review: Review) {
    const ok = await confirmDialog({
      title: t.confirm_delete_title,
      description: t.confirm_delete_desc.replace("{name}", review.customerName),
      variant: "destructive",
      confirmLabel: t.confirm_delete_label,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteReview(review.id);
        toast.success(t.toast_deleted);
        router.refresh();
      } catch {
        toast.error(t.toast_error_delete);
      }
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl w-fit">
          <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary fill-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {t.total.replace("{n}", String(total))}
          </p>
          {pendingCount > 0 && (
            <span className="ms-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {t.new_badge.replace("{n}", String(pendingCount))}
            </span>
          )}
        </div>

        {/* Filter tabs — horizontally scrollable on mobile */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/50 w-max sm:w-auto min-w-full sm:min-w-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => router.push(buildUrl(s, 1))}
                className={cn(
                  "shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                  currentStatus === s
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filterLabels[s]}
                {s === "pending" && pendingCount > 0 && (
                  <span className="ms-1 text-amber-500">({pendingCount})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reviews list ── */}
      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t.empty_title}
          description={t.empty_desc}
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={cn(
                "bg-card border rounded-2xl overflow-hidden transition-all",
                review.status === "pending"
                  ? "border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10"
                  : "border-border/60"
              )}
            >
              {/* Card body */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 sm:p-5">
                {/* Left: reviewer info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-sm text-primary shrink-0">
                    {review.customerName.trim().charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-black text-[0.9375rem] text-foreground">
                        {review.customerName}
                      </span>
                      <Badge
                        variant={
                          review.status === "approved"
                            ? "default"
                            : review.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-full",
                          review.status === "pending" &&
                            "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900"
                        )}
                      >
                        {statusBadgeLabel[review.status] ?? review.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <StarRating rating={review.rating} />
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {t.order_label}: {review.orderNumber}
                      </span>
                      {review.productName && (
                        <span className="text-[11px] font-bold text-muted-foreground truncate max-w-[200px]">
                          {review.productName}
                        </span>
                      )}
                    </div>

                    {review.title && (
                      <p className="font-black text-[0.875rem] text-foreground mb-1">
                        {review.title}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {review.body}
                    </p>

                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-2">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Desktop-only action column */}
                <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.REVIEWS_MANAGE}>
                  <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                    {review.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 rounded-xl text-[10px] font-black text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950"
                        onClick={() => handleApprove(review)}
                        disabled={isPending}
                      >
                        <CheckCircle className="w-3.5 h-3.5 me-1" />
                        {t.action_approve}
                      </Button>
                    )}
                    {review.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 rounded-xl text-[10px] font-black text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 dark:text-orange-400 dark:border-orange-900 dark:hover:bg-orange-950"
                        onClick={() => handleReject(review)}
                        disabled={isPending}
                      >
                        <XCircle className="w-3.5 h-3.5 me-1" />
                        {t.action_reject}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 rounded-xl text-[10px] font-black text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(review)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 me-1" />
                      {t.action_delete}
                    </Button>
                  </div>
                </ProtectedAction>
              </div>

              {/* Mobile-only action bar — full-width strip at bottom of card */}
              <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.REVIEWS_MANAGE}>
                <div className="sm:hidden flex border-t border-border/40">
                  {review.status !== "approved" && (
                    <button
                      onClick={() => handleApprove(review)}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-emerald-600 active:bg-emerald-50/50 dark:active:bg-emerald-950/30 transition-colors disabled:opacity-40"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t.action_approve}
                    </button>
                  )}
                  {review.status !== "approved" && review.status !== "rejected" && (
                    <div className="w-px bg-border/40 self-stretch" />
                  )}
                  {review.status !== "rejected" && (
                    <button
                      onClick={() => handleReject(review)}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-orange-600 active:bg-orange-50/50 dark:active:bg-orange-950/30 transition-colors disabled:opacity-40"
                    >
                      <XCircle className="w-4 h-4" />
                      {t.action_reject}
                    </button>
                  )}
                  <div className="w-px bg-border/40 self-stretch" />
                  <button
                    onClick={() => handleDelete(review)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-black text-destructive active:bg-destructive/5 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.action_delete}
                  </button>
                </div>
              </ProtectedAction>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-10 sm:h-8 px-4 sm:px-3 rounded-xl text-[11px] font-black"
            disabled={currentPage <= 1 || isPending}
            onClick={() => router.push(buildUrl(currentStatus, currentPage - 1))}
          >
            <ChevronRight className="w-3.5 h-3.5 me-1" />
            {t.page_prev}
          </Button>
          <span className="text-[11px] font-bold text-muted-foreground">
            {t.page_of
              .replace("{current}", String(currentPage))
              .replace("{total}", String(totalPages))}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-10 sm:h-8 px-4 sm:px-3 rounded-xl text-[11px] font-black"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => router.push(buildUrl(currentStatus, currentPage + 1))}
          >
            {t.page_next}
            <ChevronLeft className="w-3.5 h-3.5 ms-1" />
          </Button>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
