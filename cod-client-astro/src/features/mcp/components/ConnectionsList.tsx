import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { connectionKey } from "@/features/mcp/model";
import type { McpConnection } from "@/features/mcp/types";
import { ConnectionCard } from "@/features/mcp/components/ConnectionCard";

const PAGE_SIZE = 6;

/**
 * Paginated list of connection cards. Renders a ConnectionCard per row,
 * tracks which row is mid-revoke via `pendingKey`, and shows the shared
 * empty state when there is nothing to list.
 */
export function ConnectionsList({
  connections,
  showOwner = false,
  pendingKey,
  onRevoke,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
}: {
  connections: McpConnection[];
  showOwner?: boolean;
  pendingKey: string | null;
  onRevoke: (conn: McpConnection) => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: LucideIcon;
}) {
  const common = useT("common");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(connections.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const visible = connections.slice(startIdx, startIdx + PAGE_SIZE);
  const isRtl = locale === "ar";

  if (connections.length === 0) {
    return <EmptyState icon={<EmptyIcon size={22} />} title={emptyTitle} description={emptyDescription} />;
  }

  const FirstIcon = isRtl ? ChevronsRight : ChevronsLeft;
  const LastIcon = isRtl ? ChevronsLeft : ChevronsRight;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {visible.map((conn) => {
          const key = connectionKey(conn);
          return (
            <ConnectionCard
              key={key}
              conn={conn}
              showOwner={showOwner}
              pending={pendingKey === key}
              onRevoke={() => onRevoke(conn)}
            />
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[11px] font-medium text-muted-foreground/60">
            {common("table.showing")
              .replace("{from}", String(startIdx + 1))
              .replace("{to}", String(Math.min(startIdx + PAGE_SIZE, connections.length)))
              .replace("{total}", String(connections.length))}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label={common("table.page")}
            >
              <FirstIcon size={15} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              aria-label={common("table.page")}
            >
              <PrevIcon size={15} />
            </Button>

            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground/60">{common("table.page")}</span>
              <span className="text-[13px] font-bold tabular-nums text-primary">{safePage}</span>
              <span className="text-[11px] font-medium text-muted-foreground/60">
                {common("table.of")} {totalPages}
              </span>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              aria-label={common("table.page")}
            >
              <NextIcon size={15} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label={common("table.page")}
            >
              <LastIcon size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
