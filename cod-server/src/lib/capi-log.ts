import { capiEventLog } from "@/db/schema";
import type { getDb } from "@/db";
import { sanitizeErrorForLog } from "@/lib/redact";

export type CapiLogStatus = "sent" | "failed" | "skipped" | "claimed";

export interface CapiLogEntry {
  orderId: string;
  eventName: "Lead" | "Purchase";
  stage?: "checkout" | "confirmed" | "delivered";
  status: CapiLogStatus;
  /** Which Meta pixel this attempt was aimed at — null only when none was resolved. */
  pixelId?: string | null;
  metaEventId?: string | null;
  error?: string | null;
  /** Meta's HTTP status, when the attempt reached Meta. */
  httpStatus?: number | null;
}

/**
 * Audit row for every CAPI outcome. Fire-and-forget by design — an audit
 * write failure must never propagate into order or delivery flows.
 *
 * The message is redacted and bounded here as a last line of defence: no
 * token and no request body may reach this table.
 */
export async function logCapiEvent(db: ReturnType<typeof getDb>, entry: CapiLogEntry): Promise<void> {
  try {
    await db.insert(capiEventLog).values({
      id: crypto.randomUUID(),
      orderId: entry.orderId,
      eventName: entry.eventName,
      stage: entry.stage ?? "delivered",
      status: entry.status,
      pixelId: entry.pixelId ?? null,
      metaEventId: entry.metaEventId ?? null,
      error: sanitizeErrorForLog(entry.error),
      httpStatus: entry.httpStatus ?? null,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[capi-log] failed to write audit row:", err instanceof Error ? err.message : err);
  }
}
