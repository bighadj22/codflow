import { AlertTriangle, Crosshair, Store } from "lucide-react";
import { useT } from "@/i18n/react";
import type { TrackingView } from "@/features/landing-pages/model";

/**
 * Where this page's conversions actually go, in one glance.
 *
 * Three states, and the amber one is the reason this exists: a pixel is
 * configured but the server is not using it. A merchant seeing "own pixel"
 * there would go on spending against an ad account that is receiving nothing.
 */
export function TrackingBadge({
  view,
  className = "",
}: {
  view: TrackingView;
  className?: string;
}) {
  const t = useT("landing-pages");

  if (view.kind === "store") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground ${className}`}
      >
        <Store size={11} aria-hidden="true" />
        {t("tracking.badge_store")}
      </span>
    );
  }

  if (view.kind === "own") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary ${className}`}
      >
        <Crosshair size={11} aria-hidden="true" />
        {view.testMode ? t("tracking.badge_own_test") : t("tracking.badge_own")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 ${className}`}
      title={inactiveReason(view.reason, t)}
    >
      <AlertTriangle size={11} aria-hidden="true" />
      {t("tracking.badge_inactive")}
    </span>
  );
}

/**
 * Why a configured pixel is not in force. Written out rather than built from
 * the reason string: the i18n guard only verifies static keys, and a silently
 * missing translation here would show a raw key to the merchant.
 */
export function inactiveReason(
  reason: Extract<TrackingView, { kind: "inactive" }>["reason"],
  t: (key: string) => string,
): string {
  if (reason === "tracking_off") return t("tracking.inactive_tracking_off");
  if (reason === "master_switch") return t("tracking.inactive_master_switch");
  return t("tracking.inactive_switched_off");
}
