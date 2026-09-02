import { useEffect, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { createDriver, getDriver, updateDriver } from "@/features/delivery/api";
import { driverErrorMessage } from "@/features/delivery/model";
import type { DriverFormValues } from "@/features/delivery/types";
import { Button, Alert, PageHeader, Select, Card } from "@/components/ui";
import { notify } from "@/lib/notify";

const EMPTY_FORM: DriverFormValues = { firstName: "", lastName: "", phone: "", phone2: "", vehicleType: "", notes: "" };
const VEHICLE_TYPES = ["motorcycle", "car", "van"] as const;

function DriverForm({ driverId }: { driverId?: string }) {
  const t = useT("delivery");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const editing = Boolean(driverId);
  const [form, setForm] = useState<DriverFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canLoadExisting = !editing || (canScope(identity, SCOPES.DELIVERY_READ) && canScope(identity, SCOPES.DELIVERY_MANAGE));
  const canSave = editing ? canLoadExisting : canScope(identity, SCOPES.DELIVERY_MANAGE);

  useEffect(() => {
    if (!driverId || !canLoadExisting) { if (!driverId) setLoading(false); return; }
    let alive = true;
    getDriver(driverId)
      .then((driver) => { if (alive) setForm({ firstName: driver.firstName, lastName: driver.lastName, phone: driver.phone, phone2: driver.phone2 ?? "", vehicleType: driver.vehicleType ?? "", notes: driver.notes ?? "" }); })
      .catch((cause) => { if (alive) setMessage(driverErrorMessage(cause, t)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [driverId, canLoadExisting]);

  function update<K extends keyof DriverFormValues>(key: K, value: DriverFormValues[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = t("driver_form.error_required");
    if (!form.lastName.trim()) next.lastName = t("driver_form.error_required");
    if (!/^0[5-7]\d{8}$/.test(form.phone.trim())) next.phone = t("driver_form.error_required");
    if (form.phone2.trim() && !/^0[5-7]\d{8}$/.test(form.phone2.trim())) next.phone2 = t("driver_form.error_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    const body = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(), phone2: form.phone2.trim() || null, vehicleType: (form.vehicleType as "motorcycle" | "car" | "van") || null, notes: form.notes.trim() || null };
    try {
      if (driverId) {
        await updateDriver(driverId, body);
        notify.flashSuccess(t("driver_form.success_edit"));
        window.location.assign(`/delivery/drivers/${encodeURIComponent(driverId)}`);
      } else {
        const created = (await createDriver(body)).data;
        notify.flashSuccess(t("driver_form.success_add"));
        window.location.assign(`/delivery/drivers/${encodeURIComponent(created.id)}`);
      }
    } catch (cause) {
      const message = driverErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  if (!canSave || (editing && message && !form.firstName)) return <Alert role="alert" tone="critical">{message ?? auth("no_access")}</Alert>;
  if (loading) return <div role="status" aria-busy="true" className="space-y-4"><div className="h-20 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;

  const backHref = driverId ? `/delivery/drivers/${encodeURIComponent(driverId)}` : "/delivery/drivers";
  return <div className="space-y-5 pb-24 lg:pb-0">
    <PageHeader title={editing ? t("driver_form.title_edit") : t("driver_form.title_add")} backHref={backHref} backLabel={common("cancel")} actions={<Button type="button" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? t("driver_form.saving") : t("driver_form.save")}</Button>} />
    {message && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span>{message}</span></Alert>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t("driver_form.personal_info_label")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("driver_form.first_name_label")} *`} error={errors.firstName}><Input value={form.firstName} onChange={(event) => update("firstName", event.currentTarget.value)} placeholder={t("driver_form.first_name_placeholder")} disabled={busy} /></Field>
          <Field label={`${t("driver_form.last_name_label")} *`} error={errors.lastName}><Input value={form.lastName} onChange={(event) => update("lastName", event.currentTarget.value)} placeholder={t("driver_form.last_name_placeholder")} disabled={busy} /></Field>
          <Field label={`${t("driver_form.phone_label")} *`} error={errors.phone}><Input value={form.phone} onChange={(event) => update("phone", event.currentTarget.value)} placeholder={t("driver_form.phone_placeholder")} inputMode="tel" dir="ltr" className="font-mono" disabled={busy} /></Field>
          <Field label={t("driver_form.phone2_label")} error={errors.phone2}><Input value={form.phone2} onChange={(event) => update("phone2", event.currentTarget.value)} placeholder={t("driver_form.phone2_placeholder")} inputMode="tel" dir="ltr" className="font-mono" disabled={busy} /></Field>
        </div>
      </Card>
      <div className="space-y-5">
        <Card title={t("driver_form.vehicle_label")}>
          <Field label={t("driver_form.vehicle_label")}>
            <Select value={form.vehicleType} onChange={(event) => update("vehicleType", event.currentTarget.value)} disabled={busy}><option value="">{t("driver_form.vehicle_placeholder")}</option>{VEHICLE_TYPES.map((type) => <option key={type} value={type}>{t(`vehicle_type.${type}`)}</option>)}</Select>
          </Field>
        </Card>
        <Card title={t("driver_form.notes_label")}>
          <Field label={t("driver_form.notes_label")}><Textarea value={form.notes} onChange={(event) => update("notes", event.currentTarget.value)} placeholder={t("driver_form.notes_placeholder")} rows={4} disabled={busy} /></Field>
        </Card>
      </div>
    </div>
  </div>;
}

function Gated({ driverId }: { driverId?: string }) {
  return <DashboardChrome currentPath={driverId ? `/delivery/drivers/${driverId}/edit` : "/delivery/drivers/new"}><DriverForm driverId={driverId} /></DashboardChrome>;
}

export default function DriverFormPageApp({ driverId }: { driverId?: string }) { return <RequireAuth><Gated driverId={driverId} /></RequireAuth>; }
