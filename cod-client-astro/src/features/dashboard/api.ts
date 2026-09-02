import { apiFetch } from "@/lib/api";
import type { OrderStatusStat } from "../../../../cod-shared/queries/analytics";

interface DashboardStatsResponse {
  success: boolean;
  data: OrderStatusStat[];
}

export async function getDashboardStats(): Promise<OrderStatusStat[]> {
  const response = await apiFetch<DashboardStatsResponse>("/api/analytics/dashboard-stats");
  return response.data;
}
