import { History } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui";
import { useT } from "@/i18n/react";
import {
  customerHistoryTone,
  type CustomerHistoryTone,
} from "@/features/orders/model";
import type { CustomerHistory } from "@/features/orders/types";

const BADGE_TONE: Record<CustomerHistoryTone, BadgeTone> = {
  new: "neutral",
  pending: "info",
  reliable: "success",
  risky: "critical",
};

/**
 * How this customer's other orders ended — lets the confirmation team spot
 * repeat refusers (and loyal buyers) before calling or dispatching.
 */
export function CustomerHistoryBadge({ history }: { history: CustomerHistory }) {
  const t = useT("orders");
  const tone = customerHistoryTone(history);

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <Badge tone={BADGE_TONE[tone]}>
        <History size={11} className="me-1" />
        {t(`detail.customer_history.${tone}`)}
      </Badge>
      {history.total > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("detail.customer_history.summary")
            .replace("{total}", String(history.total))
            .replace("{delivered}", String(history.delivered))
            .replace("{returned}", String(history.returned))
            .replace("{cancelled}", String(history.cancelled))}
        </p>
      )}
    </div>
  );
}
