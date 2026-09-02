/**
 * EcoTrack Order Reconciliation
 *
 * Pull-based drift repair for EcoTrack-family carriers (no webhooks exist on
 * the platform — this is the only freshness source). Pages through the
 * carrier's get/orders list, maps each row's status via status-mapping.ts,
 * and applies drift fixes through updateOrderStatusWebhook — the SAME
 * forward-only rank guard webhooks use — so an order can never move
 * backwards and terminal statuses are respected.
 *
 * Rate-limit aware: one API call per page (40 orders). A run is capped at
 * maxPages (default 10 = 10 calls), well inside the platform's 50 req/min.
 *
 * Unmapped carrier statuses are skipped and sampled in the result — never
 * guessed into a transition (webhook contract rule).
 */

import type { AppDb } from "@/db";
import { getOrderByTracking } from "@/endpoints/webhooks/queries";
import { updateOrderStatusWebhook } from "@/endpoints/orders/queries";
import { EcotrackProvider } from "./adapter";
import { mapEcotrackStatus } from "./status-mapping";

export interface ReconcileSummary {
  pagesFetched: number;
  ordersSeen: number;
  updated: number;
  unchanged: number;
  notFound: number;
  skippedUnmapped: number;
  unmappedSamples: string[];
  morePagesRemain: boolean;
}

export const DEFAULT_MAX_PAGES = 10;

export async function reconcileEcotrackOrders(
  db: AppDb,
  provider: EcotrackProvider,
  companyCode: string,
  options?: { maxPages?: number }
): Promise<ReconcileSummary> {
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const source = `ecotrack-reconcile:${companyCode}`;

  const summary: ReconcileSummary = {
    pagesFetched: 0,
    ordersSeen: 0,
    updated: 0,
    unchanged: 0,
    notFound: 0,
    skippedUnmapped: 0,
    unmappedSamples: [],
    morePagesRemain: false,
  };

  let page = 1;
  let lastPage = 1;

  while (page <= Math.min(maxPages, lastPage)) {
    const result = await provider.getOrders({ page });
    summary.pagesFetched += 1;
    lastPage = result.last_page;

    for (const row of result.data) {
      summary.ordersSeen += 1;

      const mapped = mapEcotrackStatus(row.status);
      if (mapped === undefined) {
        summary.skippedUnmapped += 1;
        if (summary.unmappedSamples.length < 5) {
          summary.unmappedSamples.push(row.status);
        }
        continue;
      }

      const order = await getOrderByTracking(db, row.tracking);
      if (!order) {
        summary.notFound += 1;
        continue;
      }

      if (order.status === mapped) {
        summary.unchanged += 1;
        continue;
      }

      const { updated } = await updateOrderStatusWebhook(db, order.id, mapped, source);
      if (updated) {
        summary.updated += 1;
      } else {
        summary.unchanged += 1;
      }
    }

    if (page >= lastPage) break;
    page += 1;
  }

  summary.morePagesRemain = lastPage > summary.pagesFetched;

  return summary;
}
