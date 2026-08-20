// Southern wilayas with 5-10 day delivery — Workflow triggers at out_for_delivery
// for these to stay within Meta's 7-day window.
const LONG_HAUL_WILAYA_IDS = new Set([
  1,   // Adrar
  8,   // Béchar
  11,  // Tamanrasset
  33,  // Illizi
  37,  // Tindouf
  44,  // Aïn Guezzam
]);

/**
 * Determines whether to trigger CodCapiWorkflow for a given status transition.
 * Call this after updateOrderStatus() resolves.
 */
export function shouldTriggerCapiPurchase(
  newStatus: string,
  wilayaId: number | null | undefined,
): boolean {
  if (newStatus === "delivered") return true;
  if (newStatus === "out_for_delivery" && wilayaId != null && LONG_HAUL_WILAYA_IDS.has(wilayaId)) return true;
  return false;
}
