import type { AppDb } from "../db/client";
import { capiEventLog } from "../db/schema";
import { and, count, desc, eq, gt, gte, max, sql } from "drizzle-orm";

/**
 * What the dashboard shows about Conversions API delivery.
 *
 * `capi_event_log` is deliberately narrow — a public pixel id, an event name, a
 * status and Meta's message — and this projection keeps it that way: no order
 * id, no customer field, no token. The log has no `store_id` because it does
 * not need one (one store per database, the same assumption every server-side
 * sender already makes).
 */
export interface CapiFailureSummary {
  eventName: string;
  stage: string;
  httpStatus: number | null;
  message: string | null;
  at: string;
}

export interface CapiHealth {
  /** Last attempt of any outcome — null until the first order fires an event. */
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailure: CapiFailureSummary | null;
  /** Failures since the last success; 0 when the last outcome was a send. */
  consecutiveFailures: number;
  sentLast30Days: number;
  failedLast30Days: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getCapiHealth(db: AppDb, now: number = Date.now()): Promise<CapiHealth> {
  const since = new Date(now - THIRTY_DAYS_MS).toISOString();

  const attempt = await db
    .select({ at: max(capiEventLog.sentAt) })
    .from(capiEventLog)
    .get();

  const success = await db
    .select({ at: max(capiEventLog.sentAt) })
    .from(capiEventLog)
    .where(eq(capiEventLog.status, "sent"))
    .get();

  const failure = await db
    .select({
      eventName: capiEventLog.eventName,
      stage: capiEventLog.stage,
      httpStatus: capiEventLog.httpStatus,
      message: capiEventLog.error,
      at: capiEventLog.sentAt,
    })
    .from(capiEventLog)
    .where(eq(capiEventLog.status, "failed"))
    .orderBy(desc(capiEventLog.sentAt))
    .limit(1)
    .get();

  const lastSuccessAt = success?.at ?? null;

  const streak = await db
    .select({ c: count() })
    .from(capiEventLog)
    .where(
      lastSuccessAt
        ? and(eq(capiEventLog.status, "failed"), gt(capiEventLog.sentAt, lastSuccessAt))
        : eq(capiEventLog.status, "failed"),
    )
    .get();

  const totals = await db
    .select({
      sent: sql<number>`sum(case when ${capiEventLog.status} = 'sent' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${capiEventLog.status} = 'failed' then 1 else 0 end)`,
    })
    .from(capiEventLog)
    .where(gte(capiEventLog.sentAt, since))
    .get();

  return {
    lastAttemptAt: attempt?.at ?? null,
    lastSuccessAt,
    lastFailure: failure
      ? {
          eventName: failure.eventName,
          stage: failure.stage,
          httpStatus: failure.httpStatus ?? null,
          message: failure.message ?? null,
          at: failure.at,
        }
      : null,
    consecutiveFailures: Number(streak?.c ?? 0),
    sentLast30Days: Number(totals?.sent ?? 0),
    failedLast30Days: Number(totals?.failed ?? 0),
  };
}
