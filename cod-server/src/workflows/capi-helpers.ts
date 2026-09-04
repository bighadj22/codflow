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

export interface CapiDispatchConfig {
  enabled: boolean;
  accessToken: string;
  conversionEvent: "Lead" | "Purchase";
  testMode: boolean;
  testEventCode: string | null;
}

export type CapiSkipReason =
  | "tracking-disabled"
  | "no-access-token"
  | "conversion-event-mismatch";

export type CapiDispatch =
  | { send: true; testEventCode: string | null }
  | { send: false; reason: CapiSkipReason; message: string };

/**
 * Single gate for every CAPI send: the store's tracking must be enabled, carry
 * an access token, and the merchant must have chosen `eventName` as the
 * conversion event. Test Mode routes events to Meta's test stream — the
 * test_event_code is attached only when it is on.
 */
export function resolveCapiDispatch(
  config: CapiDispatchConfig | null | undefined,
  eventName: "Lead" | "Purchase",
): CapiDispatch {
  if (!config?.enabled) {
    return { send: false, reason: "tracking-disabled", message: "Tracking disabled in store settings" };
  }
  if (!config.accessToken) {
    return {
      send: false,
      reason: "no-access-token",
      message: "No CAPI access token — configure it in Settings → Tracking",
    };
  }
  if (config.conversionEvent !== eventName) {
    return {
      send: false,
      reason: "conversion-event-mismatch",
      message: `Conversion event is set to ${config.conversionEvent} — ${eventName} not sent`,
    };
  }
  return { send: true, testEventCode: config.testMode ? config.testEventCode : null };
}
