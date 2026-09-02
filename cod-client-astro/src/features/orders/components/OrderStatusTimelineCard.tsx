import { Check, Phone, Zap } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { OrderDetail, OrderStatus } from "@/features/orders/types";

interface OrderStatusTimelineCardProps {
  statusFlow: OrderStatus[];
  timeline: OrderDetail["statusHistory"];
  effectiveStatus: OrderStatus;
  locale: string;
}

export function OrderStatusTimelineCard({
  statusFlow,
  timeline,
  effectiveStatus,
  locale,
}: OrderStatusTimelineCardProps) {
  const t = useT("orders");

  return (
    <Card title={t("detail.status_timeline")}>
      <div className="space-y-3">
        {statusFlow.map((flowStatus) => {
          const historyItem = timeline.find(
            (item) => item.status === flowStatus,
          );
          const currentIndex = statusFlow.indexOf(effectiveStatus);
          const flowIndex = statusFlow.indexOf(flowStatus);
          const reached =
            Boolean(historyItem) ||
            (currentIndex >= 0 && flowIndex < currentIndex);
          const current = flowStatus === effectiveStatus;
          return (
            <div key={flowStatus} className="flex items-start gap-3">
              <span
                className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${
                  reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary text-primary"
                      : "border-border text-transparent"
                }`}
              >
                {reached ? (
                  <Check size={12} />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    reached || current
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {t(`status.${flowStatus}`)}
                </p>
                {historyItem && (
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(historyItem.timestamp))}
                    {historyItem.by?.startsWith("webhook:") && (
                      <span className="ms-1 inline-flex items-center gap-1 text-primary">
                        <Zap size={10} />
                        {historyItem.by === "webhook:zr_express"
                          ? "ZR Express"
                          : historyItem.by === "webhook:yalidine"
                            ? "Yalidine"
                            : t("detail.webhook_auto")}
                      </span>
                    )}
                    {historyItem.byName &&
                      !historyItem.by?.startsWith("webhook:") &&
                      ` · ${historyItem.byName}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {effectiveStatus === "unreachable" && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--status-preparing-border)] bg-[var(--status-preparing-bg)] p-3 text-sm font-semibold text-[var(--status-preparing-text)]">
            <Phone size={14} />
            {t("status.unreachable")}
          </div>
        )}
      </div>
    </Card>
  );
}
