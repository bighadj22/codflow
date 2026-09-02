import { useEffect, useMemo, useState } from "react";
import { Home, Info, Search, Store } from "lucide-react";
import { Dialog } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import {
  deleteCommuneOverride,
  listShippingRuleCommunes,
  setCommuneOverride,
} from "@/features/delivery/api";
import type { CommuneOverride } from "@/features/delivery/types";
import { shippingErrorMessage } from "@/features/delivery/model";
import {
  CommuneOverrideItem,
  type CommuneDraft,
} from "./CommuneOverrideItem";
import { notify } from "@/lib/notify";

type Draft = CommuneDraft;

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  wilayaId: number;
  wilayaName: string;
  wilayaNameAr: string;
  wilayaDefaults: {
    homePrice: number;
    stopDeskPrice: number;
    homeEnabled: boolean;
    stopDeskEnabled: boolean;
  };
}

function toDraft(override: CommuneOverride): Draft {
  return {
    homePrice: override.homePrice == null ? "" : String(override.homePrice),
    stopDeskPrice:
      override.stopDeskPrice == null ? "" : String(override.stopDeskPrice),
    homeEnabled: override.homeEnabled,
    stopDeskEnabled: override.stopDeskEnabled,
  };
}

export function CommuneOverridesDrawer({
  open,
  onClose,
  profileId,
  wilayaId,
  wilayaName,
  wilayaNameAr,
  wilayaDefaults,
}: Props) {
  const t = useT("delivery");
  const locale = useLocale();
  const sp = (key: string) => t(`shipping_profiles.${key}`);
  const [items, setItems] = useState<CommuneOverride[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setItems(null);
    setSearch("");
    setError(null);
    listShippingRuleCommunes(profileId, wilayaId)
      .then((data) => {
        if (!alive) return;
        setItems(data);
        const map: Record<string, Draft> = {};
        for (const commune of data) map[commune.communeId] = toDraft(commune);
        setDrafts(map);
      })
      .catch((cause) => {
        if (alive) setError(shippingErrorMessage(cause, t));
      });
    return () => {
      alive = false;
    };
  }, [open, profileId, wilayaId, t]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLocaleLowerCase();
    if (!q) return items;
    return items.filter(
      (commune) =>
        commune.communeName.toLocaleLowerCase().includes(q) ||
        commune.communeNameAr.includes(search) ||
        (commune.postalCode ?? "").includes(q),
    );
  }, [items, search]);

  const overriddenCount = useMemo(
    () => items?.filter((commune) => commune.hasOverride).length ?? 0,
    [items],
  );

  function updateDraft(communeId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [communeId]: {
        ...(current[communeId] ?? {
          homePrice: "",
          stopDeskPrice: "",
          homeEnabled: null,
          stopDeskEnabled: null,
        }),
        ...patch,
      },
    }));
  }

  function resetItem(commune: CommuneOverride): CommuneOverride {
    return {
      ...commune,
      homeEnabled: null,
      stopDeskEnabled: null,
      homePrice: null,
      stopDeskPrice: null,
      effectiveHomeEnabled: wilayaDefaults.homeEnabled,
      effectiveStopDeskEnabled: wilayaDefaults.stopDeskEnabled,
      effectiveHomePrice: wilayaDefaults.homePrice,
      effectiveStopDeskPrice: wilayaDefaults.stopDeskPrice,
      hasOverride: false,
    };
  }

  async function handleSave(communeId: string) {
    const draft = drafts[communeId];
    if (!draft) return;
    const homePriceNum =
      draft.homePrice.trim() === ""
        ? null
        : Math.max(0, parseFloat(draft.homePrice) || 0);
    const stopDeskPriceNum =
      draft.stopDeskPrice.trim() === ""
        ? null
        : Math.max(0, parseFloat(draft.stopDeskPrice) || 0);
    setSavingId(communeId);
    setError(null);
    try {
      await setCommuneOverride(profileId, wilayaId, communeId, {
        homeEnabled: draft.homeEnabled,
        stopDeskEnabled: draft.stopDeskEnabled,
        homePrice: homePriceNum,
        stopDeskPrice: stopDeskPriceNum,
      });
      const allNull =
        homePriceNum == null &&
        stopDeskPriceNum == null &&
        draft.homeEnabled == null &&
        draft.stopDeskEnabled == null;
      setItems((current) =>
        current?.map((commune) => {
          if (commune.communeId !== communeId) return commune;
          if (allNull) return resetItem(commune);
          return {
            ...commune,
            homeEnabled: draft.homeEnabled,
            stopDeskEnabled: draft.stopDeskEnabled,
            homePrice: homePriceNum,
            stopDeskPrice: stopDeskPriceNum,
            effectiveHomeEnabled: draft.homeEnabled ?? wilayaDefaults.homeEnabled,
            effectiveStopDeskEnabled:
              draft.stopDeskEnabled ?? wilayaDefaults.stopDeskEnabled,
            effectiveHomePrice: homePriceNum ?? wilayaDefaults.homePrice,
            effectiveStopDeskPrice:
              stopDeskPriceNum ?? wilayaDefaults.stopDeskPrice,
            hasOverride: true,
          };
        }) ?? current,
      );
      notify.success(sp("commune_override_saved"));
    } catch (cause) {
      const message = shippingErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleReset(communeId: string) {
    setSavingId(communeId);
    setError(null);
    try {
      await deleteCommuneOverride(profileId, wilayaId, communeId);
      setItems((current) =>
        current?.map((commune) =>
          commune.communeId === communeId ? resetItem(commune) : commune,
        ) ?? current,
      );
      setDrafts((current) => ({
        ...current,
        [communeId]: {
          homePrice: "",
          stopDeskPrice: "",
          homeEnabled: null,
          stopDeskEnabled: null,
        },
      }));
      notify.success(sp("commune_override_removed"));
    } catch (cause) {
      const message = shippingErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    } finally {
      setSavingId(null);
    }
  }

  const displayName = locale === "ar" ? wilayaNameAr : wilayaName;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="end"
      className="sm:w-[520px]"
      title={sp("communes_drawer_title")}
      description={sp("communes_drawer_subtitle")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-lg font-bold text-foreground">
          {displayName}
        </p>
        {overriddenCount > 0 && (
          <span className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            {sp("commune_overrides_count").replace(
              "{{count}}",
              String(overriddenCount),
            )}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
        <span className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Home size={12} className="shrink-0 text-muted-foreground" />
          <span className="uppercase tracking-wider text-muted-foreground/70">
            {sp("home_placeholder")}
          </span>
          <span className="ms-auto tabular-nums text-foreground">
            {wilayaDefaults.homeEnabled ? wilayaDefaults.homePrice : "—"}
          </span>
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Store size={12} className="shrink-0 text-muted-foreground" />
          <span className="uppercase tracking-wider text-muted-foreground/70">
            {sp("desk_placeholder")}
          </span>
          <span className="ms-auto tabular-nums text-foreground">
            {wilayaDefaults.stopDeskEnabled ? wilayaDefaults.stopDeskPrice : "—"}
          </span>
        </span>
      </div>

      <label className="relative mt-3 block">
        <Search
          size={14}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={sp("commune_search_placeholder")}
          className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      {error && (
        <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>
      )}

      <div className="-mx-5 mt-4 max-h-[45dvh] divide-y divide-border overflow-y-auto border-y border-border px-5">
        {items === null ? (
          <p className="py-12 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {sp("communes_loading")}
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/50">
            <Info size={22} aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider">
              {sp("communes_empty")}
            </p>
          </div>
        ) : (
          filtered.map((commune) => (
            <CommuneOverrideItem
              key={commune.communeId}
              commune={commune}
              draft={
                drafts[commune.communeId] ?? {
                  homePrice: "",
                  stopDeskPrice: "",
                  homeEnabled: null,
                  stopDeskEnabled: null,
                }
              }
              wilayaDefaults={wilayaDefaults}
              saving={savingId === commune.communeId}
              onUpdateDraft={(patch) => updateDraft(commune.communeId, patch)}
              onSave={() => void handleSave(commune.communeId)}
              onReset={() => void handleReset(commune.communeId)}
            />
          ))
        )}
      </div>
    </Dialog>
  );
}
