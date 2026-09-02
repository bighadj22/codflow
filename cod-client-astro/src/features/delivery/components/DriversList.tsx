import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Plus, Truck, X } from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Pagination,
  SearchInput,
  Select,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  SortHeader,
  useConfirmDialog,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteDriver,
  listAllDrivers,
  listAllOrders,
} from "@/features/delivery/api";
import {
  driverErrorMessage,
  driverFullName,
  driverHasActiveOrders,
  driverOrderCount,
  filterDrivers,
  paginateDrivers,
  sortDrivers,
  type DriverFilters,
  type DriverSortKey,
} from "@/features/delivery/model";
import type { Driver, DriverOrder } from "@/features/delivery/types";
import type { OrderListItem } from "@/features/orders/types";
import { AssignOrdersDialog } from "@/features/delivery/components/AssignOrdersDialog";
import {
  DriverDesktopRow,
  DriverMobileCard,
} from "@/features/delivery/components/DriverRow";
import { notify } from "@/lib/notify";

const EMPTY_FILTERS: DriverFilters = { query: "", status: "all" };
const STATUS_OPTIONS = ["available", "busy", "inactive"] as const;
const PAGE_SIZE = 10;

function DriverSkeleton() {
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
          className="grid h-16 grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <span className="h-6 w-20 justify-self-end animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function DriversList() {
  const t = useT("delivery");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DriverFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<DriverSortKey>("firstName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [assignDriverState, setAssignDriverState] = useState<Driver | null>(null);
  const deferredFilters = useDeferredValue(filters);

  async function load() {
    setLoadError(null);
    try {
      const [nextDrivers, nextOrders] = await Promise.all([
        listAllDrivers(),
        listAllOrders().catch(() => []),
      ]);
      setDrivers(nextDrivers);
      setOrders(nextOrders);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);
  useEffect(() => {
    setPage(1);
  }, [deferredFilters, sortKey, sortDirection]);

  if (!canScope(identity, SCOPES.DELIVERY_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("error_load")}</p>
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
  if (drivers === null) return <DriverSkeleton />;

  const readyOrders = orders.filter((order) => order.status === "ready");
  const filtered = filterDrivers(drivers, deferredFilters);
  const sorted = sortDrivers(filtered, sortKey, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = paginateDrivers(sorted, safePage, PAGE_SIZE);
  const hasFilters = filters.query.trim() !== "" || filters.status !== "all";
  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);

  function onSort(key: string) {
    const cast = key as DriverSortKey;
    if (sortKey === cast)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(cast);
      setSortDirection("asc");
    }
  }
  async function onDelete(driver: Driver) {
    if (driverHasActiveOrders(driver.id, orders as unknown as DriverOrder[])) {
      const message = t("error_cannot_delete_with_orders");
      setActionError(message);
      notify.error(message);
      return;
    }
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace("{name}", driverFullName(driver)),
        description: common("delete_description"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteDriver(driver.id);
      setDrivers(
        (current) =>
          current?.filter((item) => item.id !== driver.id) ?? current,
      );
      notify.success(t("success_deleted"));
    } catch (cause) {
      const message = driverErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
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
              onChange={(query) =>
                setFilters((current) => ({ ...current, query }))
              }
              placeholder={t("search_placeholder")}
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {filtered.length} {t("tabs.drivers")}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              aria-label={t("table.status")}
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.currentTarget.value as Driver["status"] | "all",
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
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Truck size={22} />}
            title={
              hasFilters
                ? common("no_results_found")
                : t("empty_state.drivers_title")
            }
            description={
              hasFilters ? undefined : t("empty_state.drivers_description")
            }
            action={
              !hasFilters && canManage ? (
                <LinkButton href="/delivery/drivers/new">
                  <Plus size={16} />
                  {t("empty_state.drivers_action")}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visible.map((driver) => (
                <DriverMobileCard
                  key={driver.id}
                  driver={driver}
                  activeCount={driverOrderCount(
                    driver.id,
                    orders as unknown as DriverOrder[],
                  )}
                  canManage={canManage}
                  onView={(item) =>
                    window.location.assign(
                      `/delivery/drivers/${encodeURIComponent(item.id)}`,
                    )
                  }
                  onAssign={setAssignDriverState}
                  onCompensations={(item) =>
                    window.location.assign(
                      `/delivery/drivers/${encodeURIComponent(item.id)}/compensations`,
                    )
                  }
                  onEdit={(item) =>
                    window.location.assign(
                      `/delivery/drivers/${encodeURIComponent(item.id)}/edit`,
                    )
                  }
                  onDelete={(item) => void onDelete(item)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      label={t("table.driver")}
                      sortKey="firstName"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortHeader
                      label={t("table.phone")}
                      sortKey="phone"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortHeader
                      label={t("table.status")}
                      sortKey="status"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <TableHead>{t("table.rate_card")}</TableHead>
                    <TableHead>{t("table.active_orders")}</TableHead>
                    <TableHead className="text-end">
                      {common("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((driver) => (
                    <DriverDesktopRow
                      key={driver.id}
                      driver={driver}
                      activeCount={driverOrderCount(
                        driver.id,
                        orders as unknown as DriverOrder[],
                      )}
                      canManage={canManage}
                      onView={(item) =>
                        window.location.assign(
                          `/delivery/drivers/${encodeURIComponent(item.id)}`,
                        )
                      }
                      onAssign={setAssignDriverState}
                      onCompensations={(item) =>
                        window.location.assign(
                          `/delivery/drivers/${encodeURIComponent(item.id)}/compensations`,
                        )
                      }
                      onEdit={(item) =>
                        window.location.assign(
                          `/delivery/drivers/${encodeURIComponent(item.id)}/edit`,
                        )
                      }
                      onDelete={(item) => void onDelete(item)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={sorted.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
      <AssignOrdersDialog
        open={assignDriverState !== null}
        driver={assignDriverState}
        readyOrders={readyOrders}
        onClose={() => setAssignDriverState(null)}
      />
    </div>
  );
}
