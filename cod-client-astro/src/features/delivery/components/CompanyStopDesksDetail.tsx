import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  MapPin,
  RefreshCw,
  ToggleRight,
  X,
} from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  fetchCompanyStopDesks,
  listAllDeliveryCompanies,
  listWilayas,
  toggleCompanyStopDesk,
} from "@/features/delivery/api";
import type { DeliveryCompany, StopDesk, Wilaya } from "@/features/delivery/types";
import { getProviderConfig } from "@/features/delivery/types";
import {
  Alert,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  CompanyStopDeskDesktopRow,
  CompanyStopDeskMobileCard,
} from "@/features/delivery/components/CompanyStopDeskRow";
import { notify } from "@/lib/notify";

const PAGE_SIZE = 10;

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function CompanyStopDesksDetail({ providerCode }: { providerCode: string }) {
  const t = useT("delivery_companies");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const locale = useLocale();
  const [company, setCompany] = useState<DeliveryCompany | null | undefined>(undefined);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [desks, setDesks] = useState<StopDesk[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const config = getProviderConfig(providerCode);
  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);

  const wilayaName = useMemo(() => {
    const map = new Map<number, string>();
    for (const wilaya of wilayas) map.set(wilaya.id, locale === "ar" ? wilaya.nameAr : wilaya.name);
    return map;
  }, [wilayas, locale]);

  async function loadCompany() {
    try {
      const companies = await listAllDeliveryCompanies();
      const found = companies.find((item) => item.code === providerCode);
      setCompany(found ?? null);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  async function loadWilayas() {
    try {
      setWilayas(await listWilayas());
    } catch {
      setWilayas([]);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) {
      void loadCompany();
      void loadWilayas();
    }
  }, [identity?.role, identity?.scopes.join(","), providerCode]);

  async function loadDesks() {
    if (!company) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await fetchCompanyStopDesks(company.id, { activeOnly: false });
      setDesks(data);
    } catch {
      setNotice({ message: t("error_load"), error: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (company) void loadDesks();
  }, [company?.id]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  async function handleToggle(desk: StopDesk) {
    if (!company || togglingCode === desk.code) return;
    setTogglingCode(desk.code);
    setNotice(null);
    try {
      const result = await toggleCompanyStopDesk(company.id, desk.code);
      setDesks((current) =>
        current.map((item) => (item.code === desk.code ? { ...item, active: result.active } : item)),
      );
      const message = result.active
        ? t("stop_desks_activated")
        : t("stop_desks_deactivated");
      setNotice({ message, error: false });
      notify.success(message);
    } catch {
      const message = t("error_saving");
      setNotice({ message, error: true });
      notify.error(message);
    } finally {
      setTogglingCode(null);
    }
  }

  if (!canScope(identity, SCOPES.DELIVERY_READ)) {
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  }

  if (!config) {
    return (
      <Alert role="alert" tone="critical">
        {t("error_not_found")}
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("error_load")}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              void loadCompany();
            }}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  }

  if (company === undefined) return <Loading />;

  if (!company) {
    return (
      <Alert role="alert" tone="critical">
        {t("error_not_found")}
      </Alert>
    );
  }

  const activeCount = desks.filter((desk) => desk.active).length;
  const filtered = query.trim()
    ? desks.filter(
        (desk) =>
          desk.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) ||
          desk.code.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      )
    : desks;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {notice && (
        <Alert role={notice.error ? "alert" : "status"} tone={notice.error ? "critical" : "info"}>
          {notice.error ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
          <span className="flex-1">{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={common("cancel")}>
            <X size={16} />
          </button>
        </Alert>
      )}

      <PageHeader
        title={t("stop_desks_title")}
        subtitle={company.name}
        backHref={`/delivery/companies/${providerCode}`}
        backLabel={common("cancel")}
        actions={
          <button
            type="button"
            onClick={() => void loadDesks()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            {t("stop_desks_refresh")}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-foreground">
              {t("stop_desks_title")}
            </span>
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {company.name}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t("stop_desks_active")}
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-violet-600">
              {loading ? "—" : activeCount}
            </span>
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
            <ToggleRight size={17} aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t("stop_desks_total")}
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-foreground">
              {loading ? "—" : desks.length}
            </span>
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Building2 size={17} aria-hidden="true" />
          </span>
        </div>
      </div>

      <Card flush>
        <div className="border-b border-border p-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("stop_desks_search")}
          />
        </div>

        {!loading && filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} />}
            title={t("stop_desks_empty_title")}
            description={query.trim() ? undefined : t("stop_desks_empty")}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stop_desks_col_name")}</TableHead>
                    <TableHead>{t("stop_desks_col_wilaya")}</TableHead>
                    <TableHead>{t("stop_desks_col_code")}</TableHead>
                    <TableHead className="text-center">{t("stop_desks_col_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((desk) => (
                    <CompanyStopDeskDesktopRow
                      key={desk.id}
                      desk={desk}
                      wilayaName={desk.wilayaId != null ? wilayaName.get(desk.wilayaId) ?? "—" : "—"}
                      canManage={canManage}
                      togglingCode={togglingCode}
                      onToggle={(d) => void handleToggle(d)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {visible.map((desk) => (
                <CompanyStopDeskMobileCard
                  key={desk.id}
                  desk={desk}
                  wilayaName={desk.wilayaId != null ? wilayaName.get(desk.wilayaId) ?? "—" : "—"}
                  canManage={canManage}
                  togglingCode={togglingCode}
                  onToggle={(d) => void handleToggle(d)}
                />
              ))}
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
