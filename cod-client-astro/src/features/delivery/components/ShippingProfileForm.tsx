import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { Button, Alert, PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  createShippingProfile,
  getShippingProfile,
  listWilayas,
  setShippingRules,
  updateShippingProfile,
} from "@/features/delivery/api";
import {
  buildRateMap,
  defaultRateEntry,
  shippingErrorMessage,
} from "@/features/delivery/model";
import type { ShippingRateMap, Wilaya } from "@/features/delivery/types";
import { CommuneOverridesDrawer } from "@/features/delivery/components/CommuneOverridesDrawer";
import { ShippingProfileInfoCard } from "@/features/delivery/components/ShippingProfileInfoCard";
import { ShippingProfileWilayaRatesCard } from "@/features/delivery/components/ShippingProfileWilayaRatesCard";
import { notify } from "@/lib/notify";

export function ShippingProfileForm({ profileId }: { profileId?: string }) {
  const t = useT("settings");
  const delivery = useT("delivery");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const editing = Boolean(profileId);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [rates, setRates] = useState<ShippingRateMap>({});
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [savedWilayaIds, setSavedWilayaIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [showBulkFill, setShowBulkFill] = useState(false);
  const [bulkHome, setBulkHome] = useState("");
  const [bulkDesk, setBulkDesk] = useState("");
  const [communeDrawer, setCommuneDrawer] = useState<{
    wilayaId: number;
    wilayaName: string;
    wilayaNameAr: string;
  } | null>(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canLoadExisting =
    !editing ||
    (canScope(identity, SCOPES.DELIVERY_READ) &&
      canScope(identity, SCOPES.DELIVERY_MANAGE));
  const canSave = editing
    ? canLoadExisting
    : canScope(identity, SCOPES.DELIVERY_MANAGE);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listWilayas().catch(() => []),
      profileId && canLoadExisting
        ? getShippingProfile(profileId).catch((cause) => {
            if (alive) setMessage(shippingErrorMessage(cause, delivery));
            return null;
          })
        : Promise.resolve(null),
    ]).then(([nextWilayas, profile]) => {
      if (!alive) return;
      setWilayas(nextWilayas);
      if (profile) {
        setName(profile.name);
        setNotes(profile.notes ?? "");
        setIsDefault(profile.isDefault);
        setRates(buildRateMap(profile.rules));
        setSavedWilayaIds(new Set(profile.rules.map((rule) => rule.wilayaId)));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [profileId, canLoadExisting, delivery]);

  function setRate(
    wilayaId: number,
    field: "homePrice" | "stopDeskPrice",
    raw: string,
  ) {
    const value = Math.max(0, parseFloat(raw) || 0);
    setRates((current) => ({
      ...current,
      [wilayaId]: { ...(current[wilayaId] ?? defaultRateEntry()), [field]: value },
    }));
  }

  function setEnabled(
    wilayaId: number,
    field: "homeEnabled" | "stopDeskEnabled",
    value: boolean,
  ) {
    setRates((current) => ({
      ...current,
      [wilayaId]: { ...(current[wilayaId] ?? defaultRateEntry()), [field]: value },
    }));
  }

  function handleBulkFill() {
    const homeVal = parseFloat(bulkHome) || 0;
    const deskVal = parseFloat(bulkDesk) || 0;
    if (homeVal === 0 && deskVal === 0) return;
    setRates((current) => {
      const next = { ...current };
      for (const wilaya of wilayas) {
        const existing = next[wilaya.id] ?? defaultRateEntry();
        next[wilaya.id] = {
          homePrice: homeVal > 0 ? homeVal : existing.homePrice,
          stopDeskPrice: deskVal > 0 ? deskVal : existing.stopDeskPrice,
          homeEnabled: homeVal > 0 ? true : existing.homeEnabled,
          stopDeskEnabled: deskVal > 0 ? true : existing.stopDeskEnabled,
        };
      }
      return next;
    });
    setBulkHome("");
    setBulkDesk("");
    setShowBulkFill(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrors({ name: t("shipping.profile_name_label") });
      return;
    }
    const rules = Object.entries(rates)
      .map(([wilayaId, rate]) => ({
        wilayaId: Number(wilayaId),
        homePrice: rate.homePrice,
        stopDeskPrice: rate.stopDeskPrice,
        homeEnabled: rate.homeEnabled,
        stopDeskEnabled: rate.stopDeskEnabled,
      }))
      .filter((rule) => rule.homeEnabled || rule.stopDeskEnabled);

    setBusy(true);
    setMessage(null);
    try {
      const body = {
        name: name.trim(),
        isDefault,
        notes: notes.trim() || null,
      };
      const profile = profileId
        ? (await updateShippingProfile(profileId, body)).data
        : (await createShippingProfile(body)).data;
      await setShippingRules(profile.id, rules);
      notify.flashSuccess(
        profileId ? t("shipping.success_saved") : t("shipping.success_created"),
      );
      window.location.assign(
        `/delivery/shipping-profiles/${encodeURIComponent(profile.id)}`,
      );
    } catch (cause) {
      const message = shippingErrorMessage(cause, delivery);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }

  const filteredWilayas = useMemo(() => {
    const q = search.trim();
    if (!q) return wilayas;
    return wilayas.filter(
      (wilaya) =>
        wilaya.nameAr.includes(q) ||
        wilaya.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
    );
  }, [wilayas, search]);

  if (!canSave || (editing && message && !name)) {
    return (
      <Alert role="alert" tone="critical">
        {message ?? auth("no_access")}
      </Alert>
    );
  }
  if (loading) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const backHref = "/delivery/shipping-profiles";

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        title={
          editing
            ? t("shipping.form_save_edit")
            : t("shipping.form_save_create")
        }
        backHref={backHref}
        backLabel={common("cancel")}
        actions={
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            <Save size={16} />
            {busy ? t("shipping.saving") : t("shipping.save_rates")}
          </Button>
        }
      />
      {message && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span>{message}</span>
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ShippingProfileWilayaRatesCard
          rates={rates}
          wilayas={filteredWilayas}
          savedWilayaIds={savedWilayaIds}
          search={search}
          onSearchChange={setSearch}
          showBulkFill={showBulkFill}
          onToggleBulkFill={() => setShowBulkFill((current) => !current)}
          bulkHome={bulkHome}
          onBulkHomeChange={setBulkHome}
          bulkDesk={bulkDesk}
          onBulkDeskChange={setBulkDesk}
          onBulkFill={handleBulkFill}
          onSetRate={setRate}
          onSetEnabled={setEnabled}
          onOpenCommuneDrawer={setCommuneDrawer}
          editing={editing}
        />

        <div className="space-y-5">
          <ShippingProfileInfoCard
            name={name}
            onNameChange={(val) => {
              setName(val);
              if (errors.name) setErrors((current) => ({ ...current, name: "" }));
            }}
            notes={notes}
            onNotesChange={setNotes}
            isDefault={isDefault}
            onIsDefaultChange={setIsDefault}
            errors={errors}
            busy={busy}
          />
        </div>
      </div>

      {communeDrawer && profileId && (
        <CommuneOverridesDrawer
          open
          onClose={() => setCommuneDrawer(null)}
          profileId={profileId}
          wilayaId={communeDrawer.wilayaId}
          wilayaName={communeDrawer.wilayaName}
          wilayaNameAr={communeDrawer.wilayaNameAr}
          wilayaDefaults={
            rates[communeDrawer.wilayaId] ?? defaultRateEntry()
          }
        />
      )}
    </div>
  );
}
