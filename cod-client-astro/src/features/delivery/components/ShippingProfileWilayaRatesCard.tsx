import { DollarSign, Info, Layers, MapPin, Search, Zap } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { ShippingRateMap, Wilaya } from "@/features/delivery/types";

export function ShippingProfileWilayaRatesCard({
  rates,
  wilayas,
  savedWilayaIds,
  search,
  onSearchChange,
  showBulkFill,
  onToggleBulkFill,
  bulkHome,
  onBulkHomeChange,
  bulkDesk,
  onBulkDeskChange,
  onBulkFill,
  onSetRate,
  onSetEnabled,
  onOpenCommuneDrawer,
  editing,
}: {
  rates: ShippingRateMap;
  wilayas: Wilaya[];
  savedWilayaIds: Set<number>;
  search: string;
  onSearchChange: (value: string) => void;
  showBulkFill: boolean;
  onToggleBulkFill: () => void;
  bulkHome: string;
  onBulkHomeChange: (value: string) => void;
  bulkDesk: string;
  onBulkDeskChange: (value: string) => void;
  onBulkFill: () => void;
  onSetRate: (wilayaId: number, field: "homePrice" | "stopDeskPrice", raw: string) => void;
  onSetEnabled: (wilayaId: number, field: "homeEnabled" | "stopDeskEnabled", value: boolean) => void;
  onOpenCommuneDrawer: (wilaya: { wilayaId: number; wilayaName: string; wilayaNameAr: string }) => void;
  editing: boolean;
}) {
  const t = useT("settings");
  const delivery = useT("delivery");

  return (
    <Card title={t("shipping.form_rates_section")}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onToggleBulkFill}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
              showBulkFill
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Zap size={13} aria-hidden="true" />
            {t("shipping.bulk_fill")}
          </button>
          <label className="relative block min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              placeholder={t("shipping.search_wilaya")}
              className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>

        {showBulkFill && (
          <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 sm:flex-row sm:items-center">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="relative">
                <DollarSign
                  size={12}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <Input
                  type="number"
                  min={0}
                  value={bulkHome}
                  onChange={(event) => onBulkHomeChange(event.currentTarget.value)}
                  placeholder={delivery("shipping_profiles.home_placeholder")}
                  className="ps-8"
                />
              </div>
              <div className="relative">
                <DollarSign
                  size={12}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <Input
                  type="number"
                  min={0}
                  value={bulkDesk}
                  onChange={(event) => onBulkDeskChange(event.currentTarget.value)}
                  placeholder={delivery("shipping_profiles.desk_placeholder")}
                  className="ps-8"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onBulkFill}
              disabled={!bulkHome && !bulkDesk}
            >
              {t("shipping.bulk_fill_apply")}
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            <span>{t("shipping.wilaya")}</span>
            <span className="text-center">
              {delivery("shipping_profiles.home_placeholder")}
            </span>
            <span className="text-center">
              {delivery("shipping_profiles.desk_placeholder")}
            </span>
            <span className="w-9 text-center" aria-hidden="true" />
          </div>
          <div className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {wilayas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground/40">
                <MapPin size={26} aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  {delivery("shipping_profiles.no_matching_wilayas")}
                </p>
              </div>
            ) : (
              wilayas.map((wilaya) => {
                const rate = rates[wilaya.id];
                const homeVal = rate?.homePrice ?? 0;
                const deskVal = rate?.stopDeskPrice ?? 0;
                const homeEnabled = rate?.homeEnabled ?? false;
                const deskEnabled = rate?.stopDeskEnabled ?? false;
                const hasAnyRate = homeEnabled || deskEnabled;
                const savedRule = savedWilayaIds.has(wilaya.id);
                return (
                  <div
                    key={wilaya.id}
                    className={`grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 px-3 py-2.5 transition-colors ${
                      hasAnyRate ? "" : "opacity-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {wilaya.nameAr}
                      </p>
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                        {wilaya.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSetEnabled(wilaya.id, "homeEnabled", !homeEnabled)
                        }
                        className={`inline-flex h-7 w-full items-center justify-center rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          homeEnabled
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border bg-muted/20 text-muted-foreground/60"
                        }`}
                      >
                        {homeEnabled
                          ? t("shipping.toggle_on")
                          : t("shipping.toggle_off")}
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={homeVal === 0 ? "" : homeVal}
                        onChange={(event) => {
                          onSetRate(wilaya.id, "homePrice", event.currentTarget.value);
                          if (parseFloat(event.currentTarget.value) > 0)
                            onSetEnabled(wilaya.id, "homeEnabled", true);
                        }}
                        placeholder="0"
                        disabled={!homeEnabled}
                        className="h-8 w-full rounded-md border border-input bg-background px-1 text-center text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-30"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSetEnabled(
                            wilaya.id,
                            "stopDeskEnabled",
                            !deskEnabled,
                          )
                        }
                        className={`inline-flex h-7 w-full items-center justify-center rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          deskEnabled
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border bg-muted/20 text-muted-foreground/60"
                        }`}
                      >
                        {deskEnabled
                          ? t("shipping.toggle_on")
                          : t("shipping.toggle_off")}
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={deskVal === 0 ? "" : deskVal}
                        onChange={(event) => {
                          onSetRate(
                            wilaya.id,
                            "stopDeskPrice",
                            event.currentTarget.value,
                          );
                          if (parseFloat(event.currentTarget.value) > 0)
                            onSetEnabled(wilaya.id, "stopDeskEnabled", true);
                        }}
                        placeholder="0"
                        disabled={!deskEnabled}
                        className="h-8 w-full rounded-md border border-input bg-background px-1 text-center text-sm font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-30"
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenCommuneDrawer({
                            wilayaId: wilaya.id,
                            wilayaName: wilaya.name,
                            wilayaNameAr: wilaya.nameAr,
                          })
                        }
                        disabled={!editing || !savedRule || !hasAnyRate}
                        title={
                          !editing || !savedRule
                            ? delivery("shipping_profiles.communes_save_first")
                            : delivery("shipping_profiles.manage_communes")
                        }
                        aria-label={delivery("shipping_profiles.manage_communes")}
                        className={`grid size-9 place-items-center rounded-lg border transition-colors ${
                          editing && savedRule && hasAnyRate
                            ? "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                            : "cursor-not-allowed border-border/40 bg-muted/10 text-muted-foreground/30"
                        }`}
                      >
                        <Layers size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Info size={13} className="shrink-0 text-muted-foreground/60" />
          {t("shipping.table_note")}
        </p>
      </div>
    </Card>
  );
}
