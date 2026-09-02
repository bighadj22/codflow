import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Gift, Save, Truck } from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { createOffer, getOffer, updateOffer } from "@/features/offers/api";
import { offerErrorMessage } from "@/features/offers/model";
import type { CreateOfferData, OfferFormValues } from "@/features/offers/types";
import { listProducts } from "@/features/products/api";
import type { Product, ProductVariant } from "@/features/products/types";
import { Button, Alert, PageHeader, Select, Card } from "@/components/ui";

const EMPTY_FORM: OfferFormValues = {
  name: "",
  discountType: "free",
  triggerProductId: "",
  triggerVariantId: "",
  triggerQuantity: "2",
  rewardProductId: "",
  rewardVariantId: "",
  rewardQuantity: "1",
  startsAt: "",
  endsAt: "",
  status: "active",
};

function variantLabel(variant: ProductVariant) {
  return Object.values(variant.variations).join(" / ");
}

function OfferForm({ offerId }: { offerId?: string }) {
  const t = useT("offers");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const editing = Boolean(offerId);
  const [form, setForm] = useState<OfferFormValues>(EMPTY_FORM);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.OFFERS_MANAGE);
  const canSave = editing
    ? canScope(identity, SCOPES.OFFERS_READ) && canManage
    : canManage;

  useEffect(() => {
    let alive = true;
    Promise.all([
      listProducts({ status: "ACTIVE" })
        .then((envelope) => envelope.data)
        .catch(() => []),
      offerId ? getOffer(offerId) : Promise.resolve(null),
    ])
      .then(([nextProducts, offer]) => {
        if (!alive) return;
        setProducts(nextProducts);
        if (offer)
          setForm({
            name: offer.name,
            discountType: offer.discountType,
            triggerProductId: offer.triggerProduct?.id ?? "",
            triggerVariantId: offer.triggerVariant?.id ?? "",
            triggerQuantity: String(offer.triggerQuantity),
            rewardProductId: offer.rewardProduct?.id ?? "",
            rewardVariantId: offer.rewardVariant?.id ?? "",
            rewardQuantity: String(offer.rewardQuantity),
            startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : "",
            endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : "",
            status: offer.status,
          });
      })
      .catch((cause) => {
        if (alive) setMessage(offerErrorMessage(cause, t));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [offerId, canSave]);

  function update<K extends keyof OfferFormValues>(
    key: K,
    value: OfferFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const triggerProduct = useMemo(
    () =>
      products.find((product) => product.id === form.triggerProductId) ?? null,
    [products, form.triggerProductId],
  );
  const rewardProduct = useMemo(
    () =>
      products.find((product) => product.id === form.rewardProductId) ?? null,
    [products, form.rewardProductId],
  );
  const triggerVariants: ProductVariant[] = useMemo(
    () =>
      triggerProduct?.hasVariants
        ? (triggerProduct.variants ?? []).filter((variant) => variant.active)
        : [],
    [triggerProduct],
  );
  const rewardVariants: ProductVariant[] = useMemo(
    () =>
      rewardProduct?.hasVariants
        ? (rewardProduct.variants ?? []).filter((variant) => variant.active)
        : [],
    [rewardProduct],
  );
  const rewardIsSameProduct = form.rewardProductId === form.triggerProductId;

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("form.error_name_required");
    if (!form.triggerProductId)
      next.triggerProductId = t("form.error_trigger_product_required");
    if (form.discountType === "free" && !form.rewardProductId)
      next.rewardProductId = t("form.error_reward_product_required");
    const triggerQty = parseInt(form.triggerQuantity, 10);
    if (Number.isNaN(triggerQty) || triggerQty < 1)
      next.triggerQuantity = t("form.error_trigger_qty");
    if (form.discountType === "free") {
      const rewardQty = parseInt(form.rewardQuantity, 10);
      if (Number.isNaN(rewardQty) || rewardQty < 1)
        next.rewardQuantity = t("form.error_reward_qty");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    try {
      const body: CreateOfferData = {
        name: form.name.trim(),
        discountType: form.discountType,
        triggerProductId: form.triggerProductId,
        triggerVariantId: form.triggerVariantId || undefined,
        triggerQuantity: parseInt(form.triggerQuantity, 10),
        rewardProductId:
          form.discountType === "free" ? form.rewardProductId : undefined,
        rewardVariantId:
          form.discountType === "free"
            ? form.rewardVariantId || undefined
            : undefined,
        rewardQuantity:
          form.discountType === "free" ? parseInt(form.rewardQuantity, 10) : 0,
        startsAt: form.startsAt
          ? new Date(form.startsAt).toISOString()
          : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        status: form.status,
      };
      if (offerId) await updateOffer(offerId, body);
      else await createOffer(body);
      notify.flashSuccess(t(offerId ? "form.success_edit" : "form.success_add"));
      window.location.assign("/offers");
    } catch (cause) {
      const message = offerErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }
  if (!canSave || (editing && message && !form.name))
    return (
      <Alert role="alert" tone="critical">
        {message ?? auth("no_access")}
      </Alert>
    );
  if (loading)
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        title={editing ? t("form.title_edit") : t("form.title_add")}
        backHref="/offers"
        backLabel={common("cancel")}
        actions={
          <Button type="button" onClick={() => void save()} disabled={busy}>
            <Save size={16} />
            {busy ? t("form.saving") : t("form.save")}
          </Button>
        }
      />
      {message && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span>{message}</span>
        </Alert>
      )}
      <div className="space-y-5">
        <Card title={editing ? t("form.title_edit") : t("form.title_add")}>
          <div className="grid gap-4">
            <Field label={`${t("form.name_label")} *`} error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.currentTarget.value)}
                placeholder={t("form.name_placeholder")}
                disabled={busy}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("form.discount_type_label")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["free", "free_shipping"] as const).map((type) => {
                  const Icon = type === "free" ? Gift : Truck;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => update("discountType", type)}
                      className={`flex min-h-16 items-center justify-center gap-2.5 rounded-xl border p-4 text-sm font-semibold transition-colors ${form.discountType === type ? "border-ring bg-card text-foreground shadow-xs" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"}`}
                      disabled={busy}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <span>{t(`discount_type.${type}`)}</span>
                    </button>
                  );
                })}
              </div>
              {form.discountType === "free_shipping" && (
                <p className="ms-1 mt-1.5 text-xs font-medium text-muted-foreground/60">
                  {t("form.free_shipping_note")}
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card title={t("form.section_trigger")}>
          <div className="grid gap-4">
            <Field
              label={`${t("form.trigger_product_label")} *`}
              error={errors.triggerProductId}
            >
              <Select
                value={form.triggerProductId}
                onChange={(event) => {
                  update("triggerProductId", event.currentTarget.value);
                  update("triggerVariantId", "");
                }}
                disabled={busy}
              >
                <option value="">
                  {t("form.trigger_product_placeholder")}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            {triggerVariants.length > 0 && (
              <Field label={t("form.trigger_variant_label")}>
                <Select
                  value={form.triggerVariantId || "__any__"}
                  onChange={(event) =>
                    update(
                      "triggerVariantId",
                      event.currentTarget.value === "__any__"
                        ? ""
                        : event.currentTarget.value,
                    )
                  }
                  disabled={busy}
                >
                  <option value="__any__">
                    {t("form.trigger_variant_any")}
                  </option>
                  {triggerVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variantLabel(variant)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field
              label={`${t("form.trigger_qty_label")} *`}
              error={errors.triggerQuantity}
            >
              <Input
                type="number"
                min={1}
                value={form.triggerQuantity}
                onChange={(event) =>
                  update("triggerQuantity", event.currentTarget.value)
                }
                className="w-32 tabular-nums"
                disabled={busy}
              />
              <p className="ms-1 mt-1.5 text-xs font-medium text-muted-foreground/60">
                {t("form.trigger_qty_hint")}
              </p>
            </Field>
          </div>
        </Card>
        {form.discountType === "free" && (
          <Card title={t("form.section_reward")}>
            <div className="grid gap-4">
              <Field
                label={`${t("form.reward_product_label")} *`}
                error={errors.rewardProductId}
              >
                <Select
                  value={form.rewardProductId}
                  onChange={(event) => {
                    update("rewardProductId", event.currentTarget.value);
                    update("rewardVariantId", "");
                  }}
                  disabled={busy}
                >
                  <option value="">
                    {t("form.reward_product_placeholder")}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {rewardVariants.length > 0 && (
                <Field label={t("form.reward_variant_label")}>
                  <Select
                    value={form.rewardVariantId || "__default__"}
                    onChange={(event) =>
                      update(
                        "rewardVariantId",
                        event.currentTarget.value === "__default__"
                          ? ""
                          : event.currentTarget.value,
                      )
                    }
                    disabled={busy}
                  >
                    <option value="__default__">
                      {rewardIsSameProduct
                        ? t("form.reward_variant_same")
                        : t("form.reward_variant_any")}
                    </option>
                    {rewardVariants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variantLabel(variant)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field
                label={`${t("form.reward_qty_label")} *`}
                error={errors.rewardQuantity}
              >
                <Input
                  type="number"
                  min={1}
                  value={form.rewardQuantity}
                  onChange={(event) =>
                    update("rewardQuantity", event.currentTarget.value)
                  }
                  className="w-32 tabular-nums"
                  disabled={busy}
                />
              </Field>
            </div>
          </Card>
        )}
        <Card title={t("form.section_schedule")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.starts_at_label")}>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  update("startsAt", event.currentTarget.value)
                }
                disabled={busy}
              />
            </Field>
            <Field label={t("form.ends_at_label")}>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  update("endsAt", event.currentTarget.value)
                }
                disabled={busy}
              />
            </Field>
          </div>
        </Card>
        <Card title={t("form.status_label")}>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {form.status === "active"
                  ? t("form.status_active")
                  : t("form.status_inactive")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {form.status === "active"
                  ? "Offer is currently active"
                  : "Offer is currently inactive"}
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.status === "active"}
              onChange={(event) =>
                update(
                  "status",
                  event.currentTarget.checked ? "active" : "inactive",
                )
              }
              disabled={busy}
              className="size-5 accent-primary"
            />
          </label>
        </Card>
      </div>
    </div>
  );
}

function Gated({ offerId }: { offerId?: string }) {
  return (
    <DashboardChrome
      currentPath={offerId ? `/offers/${offerId}` : "/offers/new"}
    >
      <OfferForm offerId={offerId} />
    </DashboardChrome>
  );
}

export default function OfferFormPageApp({ offerId }: { offerId?: string }) {
  return (
    <RequireAuth>
      <Gated offerId={offerId} />
    </RequireAuth>
  );
}
