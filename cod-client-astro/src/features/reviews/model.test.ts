import { describe, expect, it } from "vitest";
import { buildReviewsUrl, formatReviewDate, parseReviewStatus, reviewErrorMessage } from "./model";

const t = (key: string) => key;

describe("reviews model", () => {
  it("parses only valid review statuses", () => {
    expect(parseReviewStatus("pending")).toBe("pending");
    expect(parseReviewStatus("approved")).toBe("approved");
    expect(parseReviewStatus("rejected")).toBe("rejected");
    expect(parseReviewStatus("all")).toBeUndefined();
    expect(parseReviewStatus(undefined)).toBeUndefined();
  });

  it("builds paginated status URLs", () => {
    expect(buildReviewsUrl("all", 1)).toBe("/reviews");
    expect(buildReviewsUrl("pending", 1)).toBe("/reviews?status=pending");
    expect(buildReviewsUrl("approved", 2)).toBe("/reviews?status=approved&page=2");
  });

  it("maps business error codes and formats dates", () => {
    expect(reviewErrorMessage({ code: "REVIEW_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(reviewErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(formatReviewDate("2026-08-26T00:00:00.000Z", "en")).toBe("August 26, 2026");
    expect(formatReviewDate("not-a-date", "en")).toBe("-");
  });
});
