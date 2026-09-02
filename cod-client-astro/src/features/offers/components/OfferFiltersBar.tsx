import type { Dispatch, SetStateAction } from "react";
import { Button, SearchInput, Select } from "@/components/ui";
import { useT } from "@/i18n/react";
import type {
  OfferDiscountType,
  OfferStatus,
} from "@/features/offers/types";
import type { OfferFilters } from "@/features/offers/model";

const STATUS_OPTIONS: OfferStatus[] = ["active", "inactive"];
const TYPE_OPTIONS: OfferDiscountType[] = ["free", "free_shipping"];
export const EMPTY_FILTERS: OfferFilters = {
  query: "",
  status: "all",
  type: "all",
};

interface OfferFiltersBarProps {
  filters: OfferFilters;
  setFilters: Dispatch<SetStateAction<OfferFilters>>;
  filteredCount: number;
  hasFilters: boolean;
}

export function OfferFiltersBar({
  filters,
  setFilters,
  filteredCount,
  hasFilters,
}: OfferFiltersBarProps) {
  const t = useT("offers");
  const common = useT("common");

  return (
    <div className="space-y-3 border-b border-border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.query}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              query: value,
            }))
          }
          placeholder={t("search_placeholder")}
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {filteredCount} {t("offers_count")}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label={t("table.status")}
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.currentTarget.value as OfferStatus | "all",
            }))
          }
          wrapperClassName="sm:w-44"
        >
          <option value="all">{common("table.all")}</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t("table.type")}
          value={filters.type}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              type: event.currentTarget.value as OfferDiscountType | "all",
            }))
          }
          wrapperClassName="sm:w-44"
        >
          <option value="all">{common("table.all")}</option>
          {TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {t(`discount_type.${type}`)}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            {common("cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
