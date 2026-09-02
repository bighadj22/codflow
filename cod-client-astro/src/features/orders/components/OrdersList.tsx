import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Filter, PackageOpen, X } from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { ApiError } from "@/lib/api";
import {
  listDeliveryCompanies,
  listDrivers,
  listOrders,
} from "@/features/orders/api";
import {
  FILTER_STATUSES,
  filterOrders,
  paginateOrders,
  sortOrders,
  type OrderFilters,
  type OrderSortKey,
} from "@/features/orders/model";
import type {
  DeliveryCompany,
  Driver,
  OrderListItem,
} from "@/features/orders/types";
import {
  EmptyState,
  LinkButton,
  Alert,
  Card,
  Pagination,
  SearchInput,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  SortHeader,
} from "@/components/ui";
import { OrderDesktopRow, OrderMobileCard } from "@/features/orders/components/OrderRow";

const EMPTY_FILTERS: OrderFilters = {
  query: "",
  status: "all",
  delivery: "all",
  wilaya: "all",
  type: "all",
};

function OrderSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="h-14 border-b border-border bg-muted/35" />
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid h-14 grid-cols-[1fr_1.2fr_0.8fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <span className="h-6 w-20 justify-self-end animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 sm:flex-none">
      <Filter
        size={14}
        aria-hidden="true"
        className="shrink-0 text-muted-foreground"
      />
      <Select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        variant="bare"
        size="sm"
        wrapperClassName="min-w-0 flex-1"
        triggerClassName="min-w-0 flex-1"
      >
        {children}
      </Select>
    </label>
  );
}

export function OrdersList() {
  const t = useT("orders");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadError, setLoadError] = useState<ApiError | Error | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(() => ({
    ...EMPTY_FILTERS,
    query: new URLSearchParams(window.location.search).get("search") ?? "",
  }));
  const [sortKey, setSortKey] = useState<OrderSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredFilters = useDeferredValue(filters);
  const pageSize = 10;

  async function load() {
    if (!canScope(identity, "orders:read")) return;
    setLoadError(null);
    try {
      const mayReadDelivery = canScope(identity, "delivery:read");
      const [orderResponse, companyResponse, driverResponse] =
        await Promise.all([
          listOrders({ limit: 100, offset: 0 }),
          mayReadDelivery ? listDeliveryCompanies(true) : Promise.resolve([]),
          mayReadDelivery ? listDrivers() : Promise.resolve([]),
        ]);
      setOrders(orderResponse.data ?? []);
      setCompanies(companyResponse);
      setDrivers(driverResponse);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }

  useEffect(() => {
    void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    setPage(1);
  }, [deferredFilters, sortKey, sortDirection]);

  if (!canScope(identity, "orders:read")) {
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{t("load_error")}</p>
          <p className="mt-1 text-xs opacity-80">{loadError.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  }

  if (orders === null) return <OrderSkeleton />;

  const filteredOrders = filterOrders(orders, deferredFilters);
  const sortedOrders = sortOrders(filteredOrders, sortKey, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleOrders = paginateOrders(sortedOrders, safePage, pageSize);
  const wilayas = [
    ...new Set(orders.map((order) => order.wilaya).filter(Boolean)),
  ] as string[];
  const hasFilters = Object.values(filters).some(
    (value) => value !== "all" && value !== "",
  );

  function setFilter(key: keyof OrderFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleSort(key: string) {
    const cast = key as OrderSortKey;
    if (sortKey === cast)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(cast);
      setSortDirection("asc");
    }
  }

  const rowProps = {
    drivers,
    companies,
    onChanged: load,
    onError: setActionError,
  };

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <div className="flex-1">{actionError}</div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <Card flush>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={filters.query}
              onChange={(query) => setFilter("query", query)}
              placeholder={t("search_placeholder")}
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {filteredOrders.length} {t("orders_count")}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <FilterSelect
              label={t("filters.status")}
              value={filters.status}
              onChange={(value) => setFilter("status", value)}
            >
              <option value="all">{t("status.all")}</option>
              {FILTER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label={t("filters.delivery_method")}
              value={filters.delivery}
              onChange={(value) => setFilter("delivery", value)}
            >
              <option value="all">{t("filters.all_delivery")}</option>
              <option value="driver">{t("filters.driver")}</option>
              <option value="company">{t("filters.company")}</option>
              <option value="unassigned">{t("filters.unassigned")}</option>
            </FilterSelect>
            <FilterSelect
              label={t("filters.type")}
              value={filters.type}
              onChange={(value) => setFilter("type", value)}
            >
              <option value="all">{t("filters.type")}</option>
              <option value="online">{t("type.online")}</option>
              <option value="offline">{t("type.offline")}</option>
            </FilterSelect>
            {wilayas.length > 1 && (
              <FilterSelect
                label={t("filters.wilaya")}
                value={filters.wilaya}
                onChange={(value) => setFilter("wilaya", value)}
              >
                <option value="all">{t("filters.all_wilayas")}</option>
                {wilayas.map((wilaya) => (
                  <option key={wilaya} value={wilaya}>
                    {wilaya}
                  </option>
                ))}
              </FilterSelect>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="h-10 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {common("cancel")}
              </button>
            )}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={22} />}
            title={
              hasFilters ? common("no_results_found") : t("empty_state.title")
            }
            description={hasFilters ? undefined : t("empty_state.description")}
            action={
              !hasFilters && canScope(identity, "orders:create") ? (
                <LinkButton href="/orders/new">
                  {t("empty_state.action")}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visibleOrders.map((order) => (
                <OrderMobileCard key={order.id} order={order} {...rowProps} />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[940px]">
                <TableHeader>
                  <TableRow className="text-xs font-semibold text-muted-foreground">
                    <SortHeader
                      label={t("table.order_number")}
                      sortKey="orderNumber"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label={t("table.customer")}
                      sortKey="customerName"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <TableHead className="text-start">
                      {t("table.phone")}
                    </TableHead>
                    <SortHeader
                      label={t("table.status")}
                      sortKey="status"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label={t("table.wilaya")}
                      sortKey="wilaya"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <TableHead className="text-start">
                      {t("table.delivery")}
                    </TableHead>
                    <SortHeader
                      label={t("table.total")}
                      sortKey="total"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      align="end"
                    />
                    <TableHead className="w-12">
                      <span className="sr-only">{common("table.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOrders.map((order) => (
                    <OrderDesktopRow key={order.id} order={order} {...rowProps} />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={sortedOrders.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
