import { useEffect, useState } from "react";
import { AlertCircle, Phone, Save, UserRound } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Field, Input, Textarea } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { createCustomer, getCustomer, listCommunes, listWilayas, updateCustomer } from "@/features/customers/api";
import { customerErrorMessage } from "@/features/customers/model";
import type { Commune, Wilaya } from "@/features/orders/types";
import type { CustomerFormValues } from "@/features/customers/types";
import { Button, Alert, PageHeader, Select, Card } from "@/components/ui";

const EMPTY_FORM: CustomerFormValues = { name: "", phone: "", phone2: "", wilayaId: "", communeId: "", address: "" };

function CustomerForm({ customerId }: { customerId?: string }) {
  const t = useT("customers");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const editing = Boolean(customerId);
  const [form, setForm] = useState<CustomerFormValues>(EMPTY_FORM);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);
  const [communesLoading, setCommunesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canLoadExisting = !editing || (canScope(identity, SCOPES.CUSTOMERS_READ) && canScope(identity, SCOPES.CUSTOMERS_UPDATE));
  const canSave = editing ? canLoadExisting : canScope(identity, SCOPES.CUSTOMERS_CREATE);

  useEffect(() => {
    let alive = true;
    if (!canLoadExisting) { setLoading(false); return; }
    Promise.all([listWilayas(), customerId ? getCustomer(customerId) : Promise.resolve(null)])
      .then(([nextWilayas, customer]) => {
        if (!alive) return;
        setWilayas(nextWilayas);
        if (customer) setForm({ name: customer.name, phone: customer.phone, phone2: customer.phone2 ?? "", wilayaId: customer.wilayaId ? String(customer.wilayaId) : "", communeId: customer.communeId ?? "", address: customer.address ?? "" });
      })
      .catch((cause) => { if (alive) setMessage(customerErrorMessage(cause, t)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId, canLoadExisting]);

  useEffect(() => {
    if (!form.wilayaId) { setCommunes([]); return; }
    let alive = true;
    setCommunesLoading(true);
    listCommunes(Number(form.wilayaId))
      .then((rows) => { if (alive) setCommunes(rows); })
      .catch(() => { if (alive) setCommunes([]); })
      .finally(() => { if (alive) setCommunesLoading(false); });
    return () => { alive = false; };
  }, [form.wilayaId]);

  function update<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("form.error_name_required");
    if (!/^0[5-7]\d{8}$/.test(form.phone.trim())) next.phone = t("form.error_phone_required");
    if (form.phone2.trim() && !/^0[5-7]\d{8}$/.test(form.phone2.trim())) next.phone2 = t("form.error_phone2_invalid");
    if (!form.wilayaId) next.wilayaId = t("form.error_wilaya_required");
    if (!form.communeId) next.communeId = t("form.error_commune_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    const body = { name: form.name.trim(), phone: form.phone.trim(), phone2: form.phone2.trim() || null, wilayaId: Number(form.wilayaId), communeId: form.communeId, address: form.address.trim() };
    try {
      const customer = customerId
        ? await updateCustomer(customerId, { ...body, address: body.address || null })
        : await createCustomer({ ...body, address: body.address || undefined });
      notify.flashSuccess(t(customerId ? "form.success_edit" : "form.success_add"));
      window.location.assign(`/customers/${encodeURIComponent(customer.id)}`);
    } catch (cause) {
      const message = customerErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  if (!canSave || (editing && message && !form.name && !form.phone)) return <Alert role="alert" tone="critical">{message ?? auth("no_access")}</Alert>;
  if (loading) return <div role="status" aria-busy="true" className="space-y-4"><div className="h-20 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;

  const backHref = customerId ? `/customers/${encodeURIComponent(customerId)}` : "/customers";
  return <div className="space-y-5 pb-20 lg:pb-0"><PageHeader title={editing ? t("form.title_edit") : t("form.title_add")} backHref={backHref} backLabel={common("cancel")} actions={<Button type="button" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? t("form.saving") : t("form.save")}</Button>} />{message && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span>{message}</span></Alert>}<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><Card title={t("profile.contact_info")}><div className="grid gap-4 sm:grid-cols-2"><Field label={t("form.name_label")} error={errors.name}><Input value={form.name} onChange={(event) => update("name", event.currentTarget.value)} placeholder={t("form.name_placeholder")} disabled={busy} /></Field><Field label={t("form.phone_label")} error={errors.phone}><div className="relative"><Phone size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={form.phone} onChange={(event) => update("phone", event.currentTarget.value)} placeholder={t("form.phone_placeholder")} inputMode="tel" dir="ltr" className="ps-9" disabled={busy} /></div></Field><Field label={t("form.phone2_label")} error={errors.phone2}><div className="relative"><Phone size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={form.phone2} onChange={(event) => update("phone2", event.currentTarget.value)} placeholder={t("form.phone2_placeholder")} inputMode="tel" dir="ltr" className="ps-9" disabled={busy} /></div></Field></div></Card><Card title={t("form.wilaya_label")}><div className="grid gap-4 sm:grid-cols-2"><Field label={t("form.wilaya_label")} error={errors.wilayaId}><Select value={form.wilayaId} onChange={(event) => { update("wilayaId", event.currentTarget.value); update("communeId", ""); }} disabled={busy}><option value="">{t("form.wilaya_placeholder")}</option>{wilayas.map((wilaya) => <option key={wilaya.id} value={wilaya.id}>{locale === "ar" ? wilaya.nameAr : wilaya.name}</option>)}</Select></Field><Field label={t("form.commune_label")} error={errors.communeId}><Select value={form.communeId} onChange={(event) => update("communeId", event.currentTarget.value)} disabled={busy || !form.wilayaId || communesLoading}><option value="">{communesLoading ? t("form.commune_loading") : t("form.commune_placeholder")}</option>{communes.map((commune) => <option key={commune.id} value={commune.id}>{locale === "ar" ? commune.nameAr : commune.name}</option>)}</Select></Field></div><div className="mt-4"><Field label={t("form.address_label")}><Textarea value={form.address} onChange={(event) => update("address", event.currentTarget.value)} placeholder={t("form.address_placeholder")} disabled={busy} /></Field></div></Card></div><aside className="hidden lg:block"><Card><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground"><UserRound size={18} /></span><p className="text-sm leading-6 text-muted-foreground">{editing ? t("form.title_edit") : t("form.title_add")}</p></div><div className="mt-4 border-t border-border pt-4"><Button type="button" className="w-full" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? t("form.saving") : t("form.save")}</Button></div></Card></aside></div></div>;
}

function Gated({ customerId }: { customerId?: string }) {
  return <DashboardChrome currentPath={customerId ? `/customers/${customerId}/edit` : "/customers/new"}><CustomerForm customerId={customerId} /></DashboardChrome>;
}

export default function CustomerFormPageApp({ customerId }: { customerId?: string }) { return <RequireAuth><Gated customerId={customerId} /></RequireAuth>; }
