import { useEffect, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { createCustomerGroup, getCustomerGroup, updateCustomerGroup } from "@/features/customer-groups/api";
import { customerGroupErrorMessage } from "@/features/customer-groups/model";
import type { CustomerGroupFormValues } from "@/features/customer-groups/types";
import { Button, Alert, PageHeader, Card } from "@/components/ui";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

const EMPTY_FORM: CustomerGroupFormValues = { name: "", description: "", color: "#6366f1" };

function CustomerGroupForm({ groupId }: { groupId?: string }) {
  const t = useT("customer-groups");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const editing = Boolean(groupId);
  const [form, setForm] = useState<CustomerGroupFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canLoadExisting = !editing || (canScope(identity, SCOPES.CUSTOMER_GROUPS_READ) && canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE));
  const canSave = editing ? canLoadExisting : canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE);

  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    getCustomerGroup(groupId)
      .then((group) => { if (alive) setForm({ name: group.name, description: group.description ?? "", color: group.color }); })
      .catch((cause) => { if (alive) setMessage(customerGroupErrorMessage(cause, t)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, canLoadExisting]);

  function update<K extends keyof CustomerGroupFormValues>(key: K, value: CustomerGroupFormValues[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("form.error_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    const body = { name: form.name.trim(), description: form.description.trim() || null, color: form.color };
    try {
      const group = groupId
        ? (await updateCustomerGroup(groupId, body)).data
        : (await createCustomerGroup({ ...body, description: body.description || undefined })).data;
      notify.flashSuccess(t(groupId ? "form.success_edit" : "form.success_add"));
      window.location.assign(`/customer-groups/${encodeURIComponent(group.id)}`);
    } catch (cause) {
      const message = customerGroupErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  if (!canSave || (editing && message && !form.name)) return <Alert role="alert" tone="critical">{message ?? auth("no_access")}</Alert>;
  if (loading) return <div role="status" aria-busy="true" className="space-y-4"><div className="h-20 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;

  const backHref = groupId ? `/customer-groups/${encodeURIComponent(groupId)}` : "/customer-groups";
  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        title={editing ? t("form.title_edit") : t("form.title_add")}
        backHref={backHref}
        backLabel={common("cancel")}
        actions={<Button type="button" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? t("form.saving") : t("form.save")}</Button>}
      />
      {message && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span>{message}</span></Alert>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card title={t("form.name_label")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("form.name_label")} error={errors.name}>
                <Input value={form.name} onChange={(event) => update("name", event.currentTarget.value)} placeholder={t("form.name_placeholder")} disabled={busy} />
              </Field>
              <Field label={t("form.description_label")}>
                <Input value={form.description} onChange={(event) => update("description", event.currentTarget.value)} placeholder={t("form.description_placeholder")} disabled={busy} />
              </Field>
            </div>
          </Card>
          <Card title={t("form.color_label")}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <span className="size-10 shrink-0 rounded-lg shadow-sm transition-all" style={{ backgroundColor: form.color }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{form.name || t("form.name_placeholder")}</p>
                  <p className="mt-0.5 text-xs font-mono text-muted-foreground">{form.color}</p>
                </div>
              </div>
              <Field label={t("form.color_label")}>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((color) => <button key={color} type="button" onClick={() => update("color", color)} disabled={busy} aria-label={color} title={color} className="size-9 rounded-lg transition-all active:scale-90 disabled:opacity-50" style={{ backgroundColor: color, boxShadow: form.color === color ? `0 0 0 2px var(--background), 0 0 0 4px ${color}` : "none" }} />)}
                  <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/40">
                    <input type="color" value={form.color} onChange={(event) => update("color", event.currentTarget.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={t("form.color_label")} />
                    <span className="text-sm font-bold" aria-hidden="true">+</span>
                  </label>
                </div>
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Gated({ groupId }: { groupId?: string }) {
  return <DashboardChrome currentPath={groupId ? `/customer-groups/${groupId}/edit` : "/customer-groups/new"}><CustomerGroupForm groupId={groupId} /></DashboardChrome>;
}

export default function CustomerGroupFormPageApp({ groupId }: { groupId?: string }) { return <RequireAuth><Gated groupId={groupId} /></RequireAuth>; }
