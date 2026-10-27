/**
 * Reviews MCP tools — output-schema conformance.
 *
 * `listReviews.productName` comes from a LEFT JOIN onto products
 * (cod-shared/queries/reviews.ts): Drizzle types it `string | null`, so the
 * output schema must accept null even though reviews.product_id is NOT NULL
 * today (the join is a miss only if referential integrity is bypassed).
 * Declaring it non-nullable risked the same failure mode as the listOrders bug
 * — a whole payload rejected, structuredContent dropped, and MCP clients
 * erroring with "has an output schema but no structured content was provided".
 *
 * `body` is NOT NULL in the reviews table, so the schema rejects a null body.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const reviewQueries = vi.hoisted(() => ({
  getAllReviews: vi.fn(),
}));

vi.mock("./queries", () => reviewQueries);

import { getReviewTools, REVIEW_TOOL_OUTPUT_SCHEMAS } from "./ai-tools";

type Executable = { execute: (args: unknown, options: unknown) => Promise<unknown> };

function tool(name: string): Executable {
  const tools = getReviewTools({} as never) as unknown as Record<string, Executable>;
  const found = tools[name];
  if (!found) throw new Error(`${name} tool is not registered`);
  return found;
}

const reviewRow = (overrides: Record<string, unknown> = {}) => ({
  id: "rev_1",
  productId: "prod_1",
  productName: "ساعة ذكية",
  orderId: "ord_1",
  orderNumber: "ORD-0042",
  customerName: "Yacine B",
  rating: 5,
  title: null as string | null,
  body: "جودة عالية وسعر مناسب",
  status: "approved",
  helpfulCount: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("review tool output-schema conformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listReviews accepts an empty result set", async () => {
    reviewQueries.getAllReviews.mockResolvedValue({ rows: [], total: 0, pendingCount: 0 });

    const result = await tool("listReviews").execute({}, { toolCallId: "t" });

    const parsed = REVIEW_TOOL_OUTPUT_SCHEMAS["listReviews"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(result).toMatchObject({ success: true, count: 0, reviews: [] });
  });

  it("listReviews accepts multiple reviews, including a null productName and null title", async () => {
    reviewQueries.getAllReviews.mockResolvedValue({
      rows: [
        reviewRow(),
        reviewRow({
          id: "rev_2",
          productName: null,
          customerName: "Sara M",
          rating: 3,
          title: "Pas mal",
          status: "pending",
        }),
      ],
      total: 2,
      pendingCount: 1,
    });

    const result = await tool("listReviews").execute({}, { toolCallId: "t" });

    const parsed = REVIEW_TOOL_OUTPUT_SCHEMAS["listReviews"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const payload = result as { reviews: Array<{ productName: string | null }> };
    expect(payload.reviews[1]!.productName).toBeNull();
  });

  it("listReviews output schema rejects a null body — reviews.body is NOT NULL", async () => {
    reviewQueries.getAllReviews.mockResolvedValue({
      rows: [reviewRow({ body: null })],
      total: 1,
      pendingCount: 0,
    });

    const result = await tool("listReviews").execute({}, { toolCallId: "t" });

    const parsed = REVIEW_TOOL_OUTPUT_SCHEMAS["listReviews"]!.safeParse(result);
    expect(parsed.success).toBe(false);
  });
});
