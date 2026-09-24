import { useDeferredValue, useEffect, useState } from "react";
import {
  AlertCircle,
  Copy,
  CopyPlus,
  ExternalLink,
  Megaphone,
  MegaphoneOff,
  MoreHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteLandingPage,
  duplicateLandingPage,
  listLandingPages,
  publishLandingPage,
  unpublishLandingPage,
} from "@/features/landing-pages/api";
import {
  filterLandingPages,
  landingPageCvr,
  landingPageErrorMessage,
  landingPagePublicUrl,
  trackingView,
} from "@/features/landing-pages/model";
import { TrackingBadge } from "@/features/landing-pages/components/TrackingBadge";
import { getPixelConfig } from "@/features/settings/api";
import type { LandingPageListItem } from "@/features/landing-pages/types";
import type { StoreTrackingSwitches } from "../../../../../cod-shared/queries/tracking-config";
import { formatMoneyValue } from "@/features/products/model";
import {
  Alert,
  Badge,
  Card,
  DropdownItem,
  DropdownMenu,
  EmptyState,
  IconButton,
  LinkButton,
  SearchInput,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmDialog,
} from "@/components/ui";

function statusTone(status: LandingPageListItem["status"]) {
  if (status === "published") return "success" as const;
  if (status === "archived") return "neutral" as const;
  return "warning" as const;
}

function ListSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="h-12 border-b border-border bg-muted/35" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid h-16 grid-cols-[1.6fr_1.1fr_0.9fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-20 justify-self-center" />
          <Skeleton className="h-3 w-12 justify-self-end" />
          <Skeleton className="h-3 w-12 justify-self-end" />
          <Skeleton className="h-3 w-12 justify-self-end" />
          <Skeleton className="h-3 w-20 justify-self-end" />
          <Skeleton className="h-9 w-9 justify-self-end" />
        </div>
      ))}
    </div>
  );
}

export function LandingPagesList() {
  const t = useT("landing-pages");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [pages, setPages] = useState<LandingPageListItem[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  // The store switches decide whether a page's own pixel is actually in force.
  // Fetched once for the whole list, not per row.
  const [storeSwitches, setStoreSwitches] = useState<StoreTrackingSwitches | null>(null);
  const deferredQuery = useDeferredValue(query);

  const canManage = canScope(identity, SCOPES.LANDING_PAGES_MANAGE);

  async function load() {
    setLoadError(null);
    try {
      setPages(await listLandingPages());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.LANDING_PAGES_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    if (!canScope(identity, SCOPES.LANDING_PAGES_READ)) return;
    let alive = true;
    void getPixelConfig()
      .then((store) => {
        if (!alive) return;
        setStoreSwitches(
          store
            ? { enabled: store.enabled, perPageTrackingEnabled: store.perPageTrackingEnabled }
            : null,
        );
      })
      // Non-critical — without it a page's badge reads as "not in force",
      // which is the safe way to be wrong.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.LANDING_PAGES_READ))
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
          <p className="font-semibold">{t("error_generic")}</p>
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

  if (pages === null) return <ListSkeleton />;

  const filtered = filterLandingPages(pages, {
    query: deferredQuery,
    productId: "",
    status: status as LandingPageListItem["status"] | "all",
  });

  const statusLabels = {
    draft: t("status_draft"),
    published: t("status_published"),
    archived: t("status_archived"),
  } as const;

  async function onTogglePublish(page: LandingPageListItem) {
    try {
      if (page.status === "published") {
        await unpublishLandingPage(page.id);
        setPages(
          (current) =>
            current?.map((item) =>
              item.id === page.id ? { ...item, status: "draft" as const } : item,
            ) ?? current,
        );
      } else {
        await publishLandingPage(page.id);
        setPages(
          (current) =>
            current?.map((item) =>
              item.id === page.id ? { ...item, status: "published" as const } : item,
            ) ?? current,
        );
      }
      notify.success(common("feedback.updated"));
    } catch (cause) {
      const message = landingPageErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

  async function onDuplicate(page: LandingPageListItem) {
    try {
      const dup = await duplicateLandingPage(page.id);
      // The duplicate endpoint returns the full detail — map it to the
      // list-item shape so the row renders without a reload.
      const entry: LandingPageListItem = {
        id: dup.data.id,
        slug: dup.data.slug,
        name: dup.data.name,
        status: dup.data.status,
        productId: dup.data.productId,
        productName: dup.data.product?.name ?? null,
        productHandle: dup.data.product?.handle ?? null,
        imageCount: dup.data.images.length,
        views: dup.data.views,
        orders: dup.data.stats.orders,
        revenue: dup.data.stats.revenue,
        publicUrl: dup.data.publicUrl,
        publishedAt: dup.data.publishedAt,
        createdAt: dup.data.createdAt,
        updatedAt: dup.data.updatedAt,
        // The copy inherits the source's pixel — see duplicateLandingPage.
        tracking: page.tracking,
      };
      setPages((current) => [entry, ...(current ?? [])]);
      notify.success(t("actions.duplicated"));
    } catch (cause) {
      const message = landingPageErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

  async function onDelete(page: LandingPageListItem) {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace("{name}", page.name),
        description: t("actions.confirm_delete"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteLandingPage(page.id);
      setPages((current) => current?.filter((item) => item.id !== page.id) ?? current);
      notify.success(common("feedback.deleted"));
    } catch (cause) {
      const message = landingPageErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

  function onCopyLink(page: LandingPageListItem) {
    // The STOREFRONT URL — the thing the merchant pastes into an ad set.
    // Never the dashboard origin: that would send shoppers to a sign-in wall.
    const url = landingPagePublicUrl(page);
    void navigator.clipboard?.writeText(url).then(
      () => notify.success(t("list.link_copied")),
      () => notify.error(t("error_generic")),
    );
  }

  const rows = filtered.map((page) => ({ page, cvr: landingPageCvr(page) }));
  const hasFilters = deferredQuery.trim() !== "" || status !== "all";

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
        </Alert>
      )}

      <Card flush>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={(value) => setQuery(value)}
            placeholder={t("search_placeholder")}
          />
          <Select
            aria-label={t("list.status")}
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value)}
            wrapperClassName="shrink-0 sm:w-44"
          >
            <option value="all">{t("filter_all_statuses")}</option>
            <option value="draft">{t("status_draft")}</option>
            <option value="published">{t("status_published")}</option>
            <option value="archived">{t("status_archived")}</option>
          </Select>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {filtered.length} {t("landing_pages_count")}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Megaphone size={28} />}
            title={hasFilters ? common("no_results_found") : t("list.empty")}
            description={hasFilters ? undefined : t("list.empty_hint")}
            action={
              !hasFilters && canManage ? (
                <LinkButton href="/landing-pages/new">{t("create_landing_page")}</LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("list.name")}</TableHead>
                    <TableHead>{t("list.product")}</TableHead>
                    <TableHead className="text-center">{t("list.status")}</TableHead>
                    <TableHead className="text-end">{t("list.views")}</TableHead>
                    <TableHead className="text-end">{t("list.orders")}</TableHead>
                    <TableHead className="text-end">{t("list.cvr")}</TableHead>
                    <TableHead className="text-end">{t("list.revenue")}</TableHead>
                    <TableHead className="text-end">{common("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ page, cvr }) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <LinkButton
                            href={`/landing-pages/${encodeURIComponent(page.id)}/studio`}
                            variant="ghost"
                            className="h-auto justify-start p-0 text-start font-semibold"
                          >
                            {page.name}
                          </LinkButton>
                          <span className="mt-0.5 whitespace-nowrap font-mono text-[0.7rem] text-muted-foreground">
                            /lp/{page.slug}
                          </span>
                          {page.tracking && (
                            <TrackingBadge
                              view={trackingView(storeSwitches, page.tracking)}
                              className="mt-1 self-start"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {page.productName ?? "—"}
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({page.imageCount})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge tone={statusTone(page.status)}>
                          {statusLabels[page.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {page.views.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {page.orders.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {cvr === null ? "—" : `${cvr.toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-end tabular-nums whitespace-nowrap">
                        {formatMoneyValue(page.revenue, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end">
                          <DropdownMenu
                            trigger={<MoreHorizontal size={16} />}
                            triggerLabel={common("table.actions")}
                          >
                            <DropdownItem
                              onClick={() =>
                                window.open(
                                  landingPagePublicUrl(page),
                                  "_blank",
                                  "noopener",
                                )
                              }
                              disabled={page.status !== "published"}
                            >
                              <ExternalLink size={15} />
                              {t("list.view")}
                            </DropdownItem>
                            <DropdownItem onClick={() => onCopyLink(page)}>
                              <Copy size={15} />
                              {t("list.copy_link")}
                            </DropdownItem>
                            {canManage && (
                              <DropdownItem onClick={() => void onTogglePublish(page)}>
                                {page.status === "published" ? (
                                  <MegaphoneOff size={15} />
                                ) : (
                                  <Megaphone size={15} />
                                )}
                                {page.status === "published"
                                  ? t("actions.unpublish")
                                  : t("actions.publish")}
                              </DropdownItem>
                            )}
                            {canManage && (
                              <DropdownItem onClick={() => void onDuplicate(page)}>
                                <CopyPlus size={15} />
                                {t("actions.duplicate")}
                              </DropdownItem>
                            )}
                            {canManage && (
                              <DropdownItem danger onClick={() => void onDelete(page)}>
                                <Trash2 size={15} />
                                {common("delete")}
                              </DropdownItem>
                            )}
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {rows.map(({ page, cvr }) => (
                <article key={page.id} className="p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(page.status)}>{statusLabels[page.status]}</Badge>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    <IconButton
                      type="button"
                      aria-label={t("list.view")}
                      onClick={() =>
                        window.open(landingPagePublicUrl(page), "_blank", "noopener")
                      }
                      disabled={page.status !== "published"}
                    >
                      <ExternalLink size={15} />
                    </IconButton>
                    <IconButton
                      type="button"
                      aria-label={t("list.copy_link")}
                      onClick={() => onCopyLink(page)}
                    >
                      <Copy size={15} />
                    </IconButton>
                  </div>
                </div>
                <LinkButton
                  href={`/landing-pages/${encodeURIComponent(page.id)}/studio`}
                  variant="ghost"
                  className="mt-2 h-auto justify-start p-0 text-start text-sm font-semibold"
                >
                  {page.name}
                </LinkButton>
                <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">
                  /lp/{page.slug} · {page.productName ?? "—"} ({page.imageCount})
                </p>
                <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                      {t("list.views")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums">
                      {page.views.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                      {t("list.orders")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums">
                      {page.orders.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                      {t("list.cvr")}
                    </dt>
                    <dd className="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-bold tabular-nums">
                      <TrendingUp size={12} className="text-muted-foreground" />
                      {cvr === null ? "—" : `${cvr.toFixed(1)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                      {t("list.revenue")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums">
                      {formatMoneyValue(page.revenue, locale)}
                    </dd>
                  </div>
                </dl>
                {canManage && (
                  <>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void onDuplicate(page)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                      >
                        <CopyPlus size={14} />
                        {t("actions.duplicate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(page)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-destructive hover:bg-muted"
                      >
                        <Trash2 size={14} />
                        {common("delete")}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onTogglePublish(page)}
                      className="mt-2 w-full rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                    >
                      {page.status === "published"
                        ? t("actions.unpublish")
                        : t("actions.publish")}
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
