import { useEffect, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { createProductGroup, getProductGroup, listProductGroups, updateProductGroup } from "@/features/product-groups/api";
import { productGroupErrorMessage, toSlug } from "@/features/product-groups/model";
import type { ProductCategory, ProductCategoryFormValues } from "@/features/product-groups/types";
import { Button, Alert, PageHeader, Select, Card } from "@/components/ui";
import { CategoryImageUploader } from "@/features/product-groups/components/CategoryImageUploader";

const EMPTY_FORM: ProductCategoryFormValues = { name: "", slug: "", description: "", parentId: "", imageUrl: "", metaTitle: "", metaDescription: "", metaKeywords: "" };

function ProductGroupForm({ groupId }: { groupId?: string }) {
  const t = useT("product-groups");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const editing = Boolean(groupId);
  const [form, setForm] = useState<ProductCategoryFormValues>(EMPTY_FORM);
  const [allGroups, setAllGroups] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.PRODUCT_GROUPS_MANAGE);
  const canSave = editing ? canScope(identity, SCOPES.PRODUCT_GROUPS_READ) && canManage : canManage;

  useEffect(() => { if (!editing && form.name) setForm((current) => ({ ...current, slug: toSlug(form.name) })); }, [form.name, editing]);

  useEffect(() => {
    let alive = true;
    Promise.all([listProductGroups().catch(() => []), groupId ? getProductGroup(groupId) : Promise.resolve(null)])
      .then(([groups, group]) => {
        if (!alive) return;
        setAllGroups(groups);
        if (group) setForm({ name: group.name, slug: group.slug, description: group.description ?? "", parentId: group.parentId ?? "", imageUrl: group.imageUrl ?? "", metaTitle: group.metaTitle ?? "", metaDescription: group.metaDescription ?? "", metaKeywords: group.metaKeywords ?? "" });
      })
      .catch((cause) => { if (alive) setMessage(productGroupErrorMessage(cause, t)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, canSave]);

  function update<K extends keyof ProductCategoryFormValues>(key: K, value: ProductCategoryFormValues[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("form.error_name_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || toSlug(form.name),
      description: form.description.trim() || undefined,
      parentId: form.parentId || undefined,
      imageUrl: form.imageUrl || undefined,
      metaTitle: form.metaTitle.trim() || undefined,
      metaDescription: form.metaDescription.trim() || undefined,
      metaKeywords: form.metaKeywords.trim() || undefined,
    };
    try {
      if (groupId) await updateProductGroup(groupId, body);
      else await createProductGroup(body);
      notify.flashSuccess(t(groupId ? "form.success_edit" : "form.success_add"));
      window.location.assign("/product-groups");
    } catch (cause) {
      const message = productGroupErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  if (!canSave || (editing && message && !form.name)) return <Alert role="alert" tone="critical">{message ?? auth("no_access")}</Alert>;
  if (loading) return <div role="status" aria-busy="true" className="space-y-4"><div className="h-20 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;

  const parentOptions = allGroups.filter((group) => group.id !== groupId);
  const backHref = "/product-groups";
  return <div className="space-y-5 pb-24 lg:pb-0">
    <PageHeader title={editing ? t("form.title_edit") : t("form.title_add")} backHref={backHref} backLabel={common("cancel")} actions={<Button type="button" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? t("form.saving") : t("form.save")}</Button>} />
    {message && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span>{message}</span></Alert>}
    <div className="space-y-5">
      <Card title={t("form.title_add")}>
        <div className="grid gap-4">
          <Field label={`${t("form.name_label")} *`} error={errors.name}>
            <Input value={form.name} onChange={(event) => update("name", event.currentTarget.value)} placeholder={t("form.name_placeholder")} disabled={busy} />
          </Field>
          <Field label={t("form.slug_label")}>
            <Input value={form.slug} onChange={(event) => update("slug", event.currentTarget.value)} className="font-mono" disabled={busy} dir="ltr" />
          </Field>
          <Field label={t("form.parent_label")}>
            <Select value={form.parentId} onChange={(event) => update("parentId", event.currentTarget.value)} disabled={busy}><option value="">{t("form.parent_placeholder")}</option>{parentOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select>
          </Field>
          <Field label={t("form.description_label")}>
            <Textarea value={form.description} onChange={(event) => update("description", event.currentTarget.value)} rows={4} disabled={busy} />
          </Field>
        </div>
      </Card>
      <Card title={t("form.section_image")}>
        <Field label={t("form.image_label")}>
          <CategoryImageUploader value={form.imageUrl || null} onChange={(url) => update("imageUrl", url ?? "")} disabled={busy} />
          <p className="mt-2 text-xs text-muted-foreground">{t("form.image_help")}</p>
        </Field>
      </Card>
      <Card title={t("form.section_seo")}>
        <div className="grid gap-4">
          <Field label={t("form.meta_title_label")}>
            <div className="space-y-1.5">
              <Input value={form.metaTitle} onChange={(event) => update("metaTitle", event.currentTarget.value)} placeholder={t("form.meta_title_placeholder")} maxLength={60} disabled={busy} />
              <div className="flex items-center justify-between px-1 text-xs"><span className="text-muted-foreground">{t("form.meta_title_help")}</span><span className={`font-mono font-bold ${form.metaTitle.length > 55 ? "text-amber-500" : "text-muted-foreground"}`}>{form.metaTitle.length}/60</span></div>
            </div>
          </Field>
          <Field label={t("form.meta_description_label")}>
            <div className="space-y-1.5">
              <Textarea value={form.metaDescription} onChange={(event) => update("metaDescription", event.currentTarget.value)} placeholder={t("form.meta_description_placeholder")} maxLength={160} rows={3} disabled={busy} />
              <div className="flex items-center justify-between px-1 text-xs"><span className="text-muted-foreground">{t("form.meta_description_help")}</span><span className={`font-mono font-bold ${form.metaDescription.length > 150 ? "text-amber-500" : "text-muted-foreground"}`}>{form.metaDescription.length}/160</span></div>
            </div>
          </Field>
          <Field label={t("form.meta_keywords_label")}>
            <Input value={form.metaKeywords} onChange={(event) => update("metaKeywords", event.currentTarget.value)} placeholder={t("form.meta_keywords_placeholder")} disabled={busy} />
            <p className="mt-1.5 px-1 text-xs text-muted-foreground">{t("form.meta_keywords_help")}</p>
          </Field>
        </div>
      </Card>
    </div>
  </div>;
}

function Gated({ groupId }: { groupId?: string }) {
  return <DashboardChrome currentPath={groupId ? `/product-groups/${groupId}/edit` : "/product-groups/new"}><ProductGroupForm groupId={groupId} /></DashboardChrome>;
}

export default function ProductGroupFormPageApp({ groupId }: { groupId?: string }) { return <RequireAuth><Gated groupId={groupId} /></RequireAuth>; }
