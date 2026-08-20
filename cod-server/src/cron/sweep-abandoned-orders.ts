import { getDb } from "@/db";
import { sweepPendingToAbandoned } from "../../../cod-shared/queries/abandoned-orders";
import type { Env } from "@/types";

export async function sweepAbandonedOrders(env: Env): Promise<void> {
  const db = getDb(env.DB);
  const count = await sweepPendingToAbandoned(db);
  console.log(`[cron:sweep-abandoned] swept ${count} pending → abandoned`);
}
