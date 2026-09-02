import type { ReviewStatus } from "./types";

export const REVIEW_STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

export function parseReviewStatus(value: string | undefined): ReviewStatus | undefined {
  return REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as ReviewStatus) : undefined;
}

export function reviewErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "REVIEW_NOT_FOUND") return t("error_not_found");
  return t("error_generic");
}

export function formatReviewDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function buildReviewsUrl(status: ReviewStatus | "all", page: number) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/reviews?${qs}` : "/reviews";
}
