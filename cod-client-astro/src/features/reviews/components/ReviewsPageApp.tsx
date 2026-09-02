import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Star, Trash2, X, XCircle } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { deleteReview, listReviews, updateReviewStatus } from "@/features/reviews/api";
import { buildReviewsUrl, formatReviewDate, parseReviewStatus, reviewErrorMessage } from "@/features/reviews/model";
import type { Review, ReviewListResult, ReviewStatus } from "@/features/reviews/types";
import { Button, EmptyState, Alert, PageHeader, Badge, useConfirmDialog } from "@/components/ui";

const LIMIT = 20;
const FILTERS: Array<ReviewStatus | "all"> = ["all", "pending", "approved", "rejected"];

function StarRating({ rating }: { rating: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} className={star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />)}</span>;
}

function ReviewSkeleton() {
  return <div role="status" aria-busy="true" className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-xl border border-border bg-card" />)}</div>;
}

function ReviewCard({ review, canManage, busyKey, onApprove, onReject, onDelete }: { review: Review; canManage: boolean; busyKey: string | null; onApprove: () => void; onReject: () => void; onDelete: () => void }) {
  const t = useT("reviews");
  const locale = useLocale();
  const statusTone = review.status === "approved" ? "success" : review.status === "rejected" ? "critical" : "warning";
  const statusLabel = t(review.status === "pending" ? "status_pending" : review.status === "approved" ? "status_approved" : "status_rejected");
  return (
    <article className={`rounded-xl border border-border bg-card shadow-xs ${review.status === "pending" ? "border-amber-300/60 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10" : ""}`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{review.customerName.trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-foreground">{review.customerName}</span>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <StarRating rating={review.rating} />
              <span className="text-xs font-semibold text-muted-foreground">{t("order_label")}: {review.orderNumber}</span>
              {review.productName && <span className="max-w-[200px] truncate text-xs font-semibold text-muted-foreground">{review.productName}</span>}
            </div>
            {review.title && <p className="mt-2 text-sm font-bold text-foreground">{review.title}</p>}
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground/70">{formatReviewDate(review.createdAt, locale)}</p>
          </div>
        </div>
        {canManage && <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">{review.status !== "approved" && <Button type="button" variant="secondary" disabled={busyKey === `status-${review.id}`} onClick={onApprove} className="min-h-8 px-3 text-xs text-violet-600 hover:bg-violet-50 dark:text-violet-400"><CheckCircle size={14} />{t("action_approve")}</Button>}{review.status !== "rejected" && <Button type="button" variant="secondary" disabled={busyKey === `status-${review.id}`} onClick={onReject} className="min-h-8 px-3 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400"><XCircle size={14} />{t("action_reject")}</Button>}<Button type="button" variant="secondary" disabled={busyKey === `delete-${review.id}`} onClick={onDelete} className="min-h-8 px-3 text-xs text-destructive hover:bg-destructive/10"><Trash2 size={14} />{t("action_delete")}</Button></div>}
      </div>
    </article>
  );
}

function ReviewsList() {
  const t = useT("reviews");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [result, setResult] = useState<ReviewListResult | null>(null);
  const status = parseReviewStatus(new URLSearchParams(window.location.search).get("status") ?? undefined) ?? "all";
  const page = Math.max(1, parseInt(new URLSearchParams(window.location.search).get("page") ?? "1", 10) || 1);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setResult(await listReviews({ status: status === "all" ? undefined : status, limit: LIMIT, offset: (page - 1) * LIMIT }));
    } catch (cause) { setLoadError(cause); }
  }, [status, page]);

  useEffect(() => { if (canScope(identity, SCOPES.REVIEWS_READ)) void load(); }, [load, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.REVIEWS_READ)) return <Alert role="alert" tone="critical">{auth("no_access")}</Alert>;
  if (loadError) return <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><div className="flex-1"><p className="font-semibold">{t("error_load")}</p><button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold underline underline-offset-4">{common("retry")}</button></div></Alert>;
  if (result === null) return <ReviewSkeleton />;

  const totalPages = Math.max(1, Math.ceil(result.total / LIMIT));
  const safePage = Math.min(page, totalPages);
  const canManage = canScope(identity, SCOPES.REVIEWS_MANAGE);

  function switchStatus(next: ReviewStatus | "all") {
    window.location.assign(buildReviewsUrl(next, 1));
  }
  function switchPage(next: number) {
    window.location.assign(buildReviewsUrl(status, Math.max(1, Math.min(next, totalPages))));
  }
  async function runStatus(review: Review, nextStatus: ReviewStatus) {
    setBusyKey(`status-${review.id}`); setActionError(null);
    try {
      await updateReviewStatus(review.id, nextStatus);
      await load();
      notify.success(t(nextStatus === "approved" ? "toast_approved" : "toast_rejected"));
    } catch (cause) {
      const message = reviewErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    } finally { setBusyKey(null); }
  }
  async function runDelete(review: Review) {
    if (!await confirm({ title: t("confirm_delete_title"), description: t("confirm_delete_desc").replace("{name}", review.customerName), confirmLabel: t("confirm_delete_label"), tone: "danger" })) return;
    setBusyKey(`delete-${review.id}`); setActionError(null);
    try {
      await deleteReview(review.id);
      await load();
      notify.success(t("toast_deleted"));
    } catch (cause) {
      const message = reviewErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    } finally { setBusyKey(null); }
  }

  return <div className="space-y-4">
    {actionError && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span className="flex-1">{actionError}</span><button type="button" onClick={() => setActionError(null)} aria-label={common("cancel")}><X size={16} /></button></Alert>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-1.5"><Star size={14} className="fill-primary text-primary" /><p className="text-[11px] font-bold uppercase tracking-widest text-primary">{t("total").replace("{n}", String(result.total))}</p>{result.pendingCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{t("new_badge").replace("{n}", String(result.pendingCount))}</span>}</div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1"><div className="flex gap-1">{FILTERS.map((filter) => <button key={filter} type="button" onClick={() => switchStatus(filter)} className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${status === filter ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>{t(`filter_${filter}`)}{filter === "pending" && result.pendingCount > 0 && <span className="ms-1 text-amber-500">({result.pendingCount})</span>}</button>)}</div></div>
    </div>
    {result.rows.length === 0 ? <EmptyState icon={<Star size={22} />} title={t("empty_title")} description={t("empty_desc")} /> : <div className="space-y-3">{result.rows.map((review) => <ReviewCard key={review.id} review={review} canManage={canManage} busyKey={busyKey} onApprove={() => void runStatus(review, "approved")} onReject={() => void runStatus(review, "rejected")} onDelete={() => void runDelete(review)} />)}</div>}
    {totalPages > 1 && <div className="flex items-center justify-between pt-1"><Button type="button" variant="secondary" disabled={safePage <= 1} onClick={() => switchPage(safePage - 1)} className="min-h-9 px-3 text-xs"><ChevronDown size={14} className="rotate-90" />{t("page_prev")}</Button><span className="text-xs font-bold text-muted-foreground">{t("page_of").replace("{current}", String(safePage)).replace("{total}", String(totalPages))}</span><Button type="button" variant="secondary" disabled={safePage >= totalPages} onClick={() => switchPage(safePage + 1)} className="min-h-9 px-3 text-xs">{t("page_next")}<ChevronUp size={14} className="rotate-90" /></Button></div>}
  </div>;
}

function Gated() {
  const t = useT("reviews");
  return <DashboardChrome currentPath="/reviews"><PageHeader title={t("page_title")} /><ReviewsList /></DashboardChrome>;
}

export default function ReviewsPageApp() { return <RequireAuth><Gated /></RequireAuth>; }
