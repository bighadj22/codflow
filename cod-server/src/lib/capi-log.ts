import { capiEventLog } from "@/db/schema";
import type { getDb } from "@/db";

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
}

/**
 * Audit row for every CAPI outcome. Fire-and-forget by design — an audit
 * write failure must never propagate into order or delivery flows.
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
      error: entry.error ?? null,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[capi-log] failed to write audit row:", err instanceof Error ? err.message : err);
  }
}
