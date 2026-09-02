import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Gift, Plus, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { deleteOffer, listOffers, updateOffer } from "@/features/offers/api";
import {
  filterOffers,
  offerErrorMessage,
  paginateOffers,
  sortOffers,
  type OfferFilters,
  type OfferSortKey,
} from "@/features/offers/model";
import type { Offer } from "@/features/offers/types";
import {
  Alert,
  Card,
  EmptyState,
  LinkButton,
  Pagination,
  Skeleton,
  SortHeader,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmDialog,
} from "@/components/ui";
import {
  EMPTY_FILTERS,
  OfferFiltersBar,
} from "@/features/offers/components/OfferFiltersBar";
import { OfferDesktopRow } from "@/features/offers/components/OfferDesktopRow";
import { OfferMobileCard } from "@/features/offers/components/OfferMobileCard";

function OfferSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="h-14 border-b border-border bg-muted/35" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid h-16 grid-cols-[1fr_1.5fr_1fr_0.6fr_0.6fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-28" />
          <span className="h-6 w-20 animate-pulse rounded-lg bg-muted" />
          <span className="h-6 w-20 justify-self-end animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function OffersList() {
  const t = useT("offers");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OfferFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<OfferSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredFilters = useDeferredValue(filters);
  const pageSize = 10;

  async function load() {
    setLoadError(null);
    try {
      setOffers(await listOffers());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.OFFERS_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    setPage(1);
  }, [deferredFilters, sortKey, sortDirection]);

  if (!canScope(identity, SCOPES.OFFERS_READ))
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

  if (offers === null) return <OfferSkeleton />;

  const filtered = filterOffers(offers, deferredFilters);
  const sorted = sortOffers(filtered, sortKey, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = paginateOffers(sorted, safePage, pageSize);
  const hasFilters =
    filters.query.trim() !== "" ||
    filters.status !== "all" ||
    filters.type !== "all";
  const canManage = canScope(identity, SCOPES.OFFERS_MANAGE);

  function onSort(key: string) {
    const offerKey = key as OfferSortKey;
    if (sortKey === offerKey)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(offerKey);
      setSortDirection("asc");
    }
  }

  async function onToggle(offer: Offer) {
    const next = offer.status === "active" ? "inactive" : "active";
    try {
      await updateOffer(offer.id, { status: next });
      setOffers(
        (current) =>
          current?.map((item) =>
            item.id === offer.id ? { ...item, status: next } : item,
          ) ?? current,
      );
      notify.success(common("feedback.updated"));
    } catch (cause) {
      const message = offerErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

  async function onDelete(offer: Offer) {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace("{name}", offer.name),
        description: t("form.delete_confirm"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteOffer(offer.id);
      setOffers(
        (current) => current?.filter((item) => item.id !== offer.id) ?? current,
      );
      notify.success(common("feedback.deleted"));
    } catch (cause) {
      const message = offerErrorMessage(cause, t);
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
        <OfferFiltersBar
          filters={filters}
          setFilters={setFilters}
          filteredCount={filtered.length}
          hasFilters={hasFilters}
        />
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Gift size={22} />}
            title={
              hasFilters ? common("no_results_found") : t("empty_state.title")
            }
            description={hasFilters ? undefined : t("empty_state.description")}
            action={
              !hasFilters && canManage ? (
                <LinkButton href="/offers/new">
                  <Plus size={16} />
                  {t("empty_state.action")}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visible.map((offer) => (
                <OfferMobileCard
                  key={offer.id}
                  offer={offer}
                  canManage={canManage}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      label={t("table.name")}
                      sortKey="name"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <TableHead>{t("table.trigger")}</TableHead>
                    <TableHead>{t("table.reward")}</TableHead>
                    <TableHead>{t("table.schedule")}</TableHead>
                    <SortHeader
                      label={t("table.status")}
                      sortKey="status"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <TableHead className="text-end">
                      {common("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((offer) => (
                    <OfferDesktopRow
                      key={offer.id}
                      offer={offer}
                      canManage={canManage}
                      onToggle={onToggle}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={sorted.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
