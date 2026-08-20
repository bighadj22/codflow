"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, MapPin, RefreshCw, ToggleLeft, ToggleRight, Building2,
} from "lucide-react";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchCompanyStopDesks, toggleCompanyStopDesk } from "@/actions/delivery-companies";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useDelivery } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";
import type { DeliveryCompany, StopDesk, Wilaya } from "@/types";

interface Props {
  company: DeliveryCompany;
  /** Full wilaya catalog (1..58) preloaded by the server component. */
  wilayas: Wilaya[];
}

/**
 * Row shape fed into DataTable — adds display-ready fields so the built-in
 * search/filter/sort work without custom render functions everywhere.
 * `wilayaKey` exists as a string because DataTable's filter uses === comparison.
 */
interface DeskRow extends StopDesk {
  wilayaName: string;
  wilayaKey: string;
  statusKey: "active" | "inactive";
}

export function CompanyStopDesksPage({ company, wilayas }: Props) {
  const t = useDelivery();
  const errorLocale = useErrorLocale();
  const router = useRouter();
  const { dir, locale } = useLanguage();

  const [desks, setDesks] = useState<StopDesk[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Wilaya lookup for fast "id → name" at render time
  const wilayaName = useMemo(() => {
    const map = new Map<number, string>();
    for (const w of wilayas) map.set(w.id, locale === "ar" ? w.nameAr : w.name);
    return map;
  }, [wilayas, locale]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function load() {
    setLoading(true);
    try {
      // Fetch all desks (active + inactive). DataTable handles filtering
      // client-side — snappier than a server round-trip on every toggle and
      // keeps the implementation simple at the Packers scale of ~1,359 rows.
      const data = await fetchCompanyStopDesks(company.id, { activeOnly: false });
      setDesks(data);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : (t.stop_desks?.error_load ?? "Error loading stop desks"), errorLocale);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(desk: DeskRow) {
    const code = desk.code;
    if (togglingCode === code) return;
    setTogglingCode(code);
    startTransition(async () => {
      try {
        const result = await toggleCompanyStopDesk(company.id, code);
        setDesks((prev) => prev.map((d) => d.code === code ? { ...d, active: result.active } : d));
        showSuccessToast(
          result.active ? (t.stop_desks?.activated ?? "Stop desk activated") : (t.stop_desks?.deactivated ?? "Stop desk deactivated"),
          errorLocale,
        );
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Error", errorLocale);
      } finally {
        setTogglingCode(null);
      }
    });
  }

  // Decorate rows for DataTable: searchable text fields, filter keys, sort keys.
  const rows: DeskRow[] = useMemo(() => desks.map((d) => ({
    ...d,
    wilayaName: d.wilayaId != null ? (wilayaName.get(d.wilayaId) ?? "—") : "—",
    wilayaKey:  d.wilayaId != null ? String(d.wilayaId) : "",
    statusKey:  d.active ? "active" : "inactive",
  })), [desks, wilayaName]);

  const activeCount = desks.filter((d) => d.active).length;

  const columns: TableColumn<DeskRow>[] = [
    {
      key: "name",
      label: t.stop_desks?.col_name ?? "Name",
      sortable: true,
      searchable: true,
      isTitle: true,
      render: (value, row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-border/40">
            <MapPin className="w-4 h-4 text-primary/70" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm tracking-tight truncate">{value}</p>
            {row.wilayaId != null && (
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest truncate md:hidden">
                {row.wilayaName}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "wilayaName",
      label: t.stop_desks?.col_wilaya ?? "Wilaya",
      sortable: true,
      searchable: true,
      isSubtitle: true,
      render: (value) => (
        <span className="text-[12px] font-semibold text-muted-foreground/80">{value}</span>
      ),
    },
    {
      key: "code",
      label: t.stop_desks?.col_code ?? "Code",
      sortable: true,
      searchable: true,
      tabletHidden: true,
      render: (value) => (
        <span className="font-mono text-[11px] font-bold text-muted-foreground/60 tabular-nums">{value}</span>
      ),
    },
    {
      key: "statusKey",
      label: t.stop_desks?.col_status ?? "Status",
      sortable: true,
      isStatus: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.active ? "available" : "inactive"} />
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(row); }}
            disabled={togglingCode === row.code}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
              row.active
                ? "border-border/30 bg-muted/20 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/15",
              togglingCode === row.code && "opacity-40 cursor-not-allowed",
            )}
            title={row.active ? (t.stop_desks?.deactivate ?? "Deactivate") : (t.stop_desks?.activate ?? "Activate")}
          >
            {row.active
              ? <ToggleRight className="w-3 h-3" />
              : <ToggleLeft className="w-3 h-3" />}
            {row.active ? (t.stop_desks?.on ?? "On") : (t.stop_desks?.off ?? "Off")}
          </button>
        </div>
      ),
    },
  ];

  const filters = [
    {
      key: "wilayaKey",
      label: t.stop_desks?.col_wilaya ?? "Wilaya",
      options: wilayas.map((w) => ({
        label: `${w.id}. ${locale === "ar" ? w.nameAr : w.name}`,
        value: String(w.id),
      })),
    },
    {
      key: "statusKey",
      label: t.stop_desks?.col_status ?? "Status",
      options: [
        { label: t.stop_desks?.filter_active   ?? "Active",   value: "active"   },
        { label: t.stop_desks?.filter_inactive ?? "Inactive", value: "inactive" },
      ],
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push(`/delivery/companies/${company.code}`)}
        className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors group"
      >
        <ArrowRight
          size={13}
          className={cn(
            "transition-transform shrink-0",
            dir === "rtl" ? "group-hover:translate-x-0.5" : "rotate-180 group-hover:-translate-x-0.5",
          )}
        />
        {company.name}
      </button>

      {/* Header + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1 glass-card rounded-2xl border-border/30 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-foreground tracking-tight truncate">{t.stop_desks?.title ?? "Stop Desks"}</h1>
            <p className="text-[11px] text-muted-foreground/50 font-bold uppercase tracking-widest mt-0.5 truncate">
              {company.name}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl border-border/30 p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t.stop_desks?.active_label ?? "Active"}</p>
            <p className="text-2xl font-black text-emerald-500 mt-1 tabular-nums">{loading ? "—" : activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ToggleRight size={18} className="text-emerald-500" />
          </div>
        </div>

        <div className="glass-card rounded-2xl border-border/30 p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t.stop_desks?.total ?? "Total"}</p>
            <p className="text-2xl font-black text-foreground mt-1 tabular-nums">{loading ? "—" : desks.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
            <Building2 size={18} className="text-muted-foreground/40" />
          </div>
        </div>
      </div>

      {/* Refresh button — small and off to the side to match other tables */}
      <div className="flex justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="h-9 px-3 rounded-lg border border-border/40 bg-card hover:bg-muted/30 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all disabled:opacity-40"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {t.stop_desks?.refresh ?? "Refresh"}
        </button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder={t.stop_desks?.search_placeholder ?? "Search name, code, wilaya…"}
        filterable
        filters={filters}
        pageSize={30}
        emptyState={
          <EmptyState
            icon={Building2}
            title={t.stop_desks?.empty_no_sync_title ?? "No stop desks"}
            description={t.stop_desks?.empty_no_sync ?? "No stop desks — sync first from the company page"}
          />
        }
      />
    </div>
  );
}
