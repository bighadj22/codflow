import {
  CheckCircle2,
  Clock,
  PackageCheck,
  PhoneCall,
  Sparkles,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/i18n/react";

/**
 * Which moment counts as a conversion.
 *
 * Chosen in two places now — the store's Settings → Tracking, and a single
 * landing page's own tracking — so the four options, their copy and the
 * "recommended" mark live here rather than in two drifting copies. A merchant
 * comparing a page's choice against the store's has to be reading the same
 * four cards or the comparison is meaningless.
 *
 * The strings stay in the `settings` namespace: they describe Meta events, not
 * a particular screen.
 */
export type ConversionEvent =
  | "Purchase"
  | "Purchase_Confirmed"
  | "Purchase_Delivered"
  | "Lead";

interface EventOptionMeta {
  value: ConversionEvent;
  titleKey: string;
  stageKey: string;
  hintKey: string;
  timingKey: string;
  tagKey: string;
  isRecommended?: boolean;
  icon: LucideIcon;
  theme: {
    iconBg: string;
    iconColor: string;
    stageBadge: string;
  };
}

export const CONVERSION_EVENT_OPTIONS: EventOptionMeta[] = [
  {
    value: "Purchase",
    titleKey: "store.tracking_event_purchase_instant_title",
    stageKey: "store.tracking_event_purchase_instant_stage",
    hintKey: "store.tracking_event_purchase_instant_hint",
    timingKey: "store.tracking_event_purchase_instant_timing",
    tagKey: "store.tracking_event_purchase_instant_tag",
    isRecommended: true,
    icon: Zap,
    theme: {
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      stageBadge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
  },
  {
    value: "Purchase_Confirmed",
    titleKey: "store.tracking_event_purchase_confirmed_title",
    stageKey: "store.tracking_event_purchase_confirmed_stage",
    hintKey: "store.tracking_event_purchase_confirmed_hint",
    timingKey: "store.tracking_event_purchase_confirmed_timing",
    tagKey: "store.tracking_event_purchase_confirmed_tag",
    icon: PhoneCall,
    theme: {
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      stageBadge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
  },
  {
    value: "Purchase_Delivered",
    titleKey: "store.tracking_event_purchase_delivered_title",
    stageKey: "store.tracking_event_purchase_delivered_stage",
    hintKey: "store.tracking_event_purchase_delivered_hint",
    timingKey: "store.tracking_event_purchase_delivered_timing",
    tagKey: "store.tracking_event_purchase_delivered_tag",
    icon: PackageCheck,
    theme: {
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      stageBadge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
  },
  {
    value: "Lead",
    titleKey: "store.tracking_event_lead_title",
    stageKey: "store.tracking_event_lead_stage",
    hintKey: "store.tracking_event_lead_hint",
    timingKey: "store.tracking_event_lead_timing",
    tagKey: "store.tracking_event_lead_tag",
    icon: UserCheck,
    theme: {
      iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
      iconColor: "text-purple-600 dark:text-purple-400",
      stageBadge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    },
  },
];

/** The human name of a conversion event, for summaries and badges. */
export function useConversionEventLabel() {
  const t = useT("settings");
  return (value: ConversionEvent) => {
    const option = CONVERSION_EVENT_OPTIONS.find((candidate) => candidate.value === value);
    return option ? t(option.titleKey) : value;
  };
}

export function ConversionEventPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  /** null until the merchant chooses — never defaulted for them. */
  value: ConversionEvent | null;
  onChange: (value: ConversionEvent) => void;
  disabled?: boolean;
  /** Drops the micro-specs row, for the narrower dialog. */
  compact?: boolean;
}) {
  const t = useT("settings");

  return (
    <div className="grid gap-2.5" role="radiogroup" aria-label={t("store.tracking_event_label")}>
      {CONVERSION_EVENT_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`group relative flex w-full cursor-pointer items-start gap-3.5 rounded-xl border p-3.5 text-start transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? "border-primary/80 bg-primary/[0.03] shadow-xs ring-1 ring-primary/20"
                : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            {/* Custom accessible radio indicator */}
            <span className="mt-0.5 shrink-0">
              <span
                className={`flex size-4.5 items-center justify-center rounded-full border transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-muted-foreground/40 bg-background group-hover:border-primary/60"
                }`}
              >
                {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
            </span>

            {/* Stage Icon */}
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-lg ${option.theme.iconBg} ${option.theme.iconColor} transition-transform group-hover:scale-105`}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
            </span>

            {/* Content body */}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{t(option.titleKey)}</span>

                {option.isRecommended && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Sparkles size={11} aria-hidden="true" />
                    {t("store.tracking_event_recommended")}
                  </span>
                )}

                <span
                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${option.theme.stageBadge}`}
                >
                  {t(option.stageKey)}
                </span>
              </span>

              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {t(option.hintKey)}
              </span>

              {!compact && (
                <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Clock size={12} className="text-muted-foreground/70" aria-hidden="true" />
                    <span>{t(option.timingKey)}</span>
                  </span>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                    <CheckCircle2
                      size={12}
                      className="text-emerald-600/80 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>{t(option.tagKey)}</span>
                  </span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
