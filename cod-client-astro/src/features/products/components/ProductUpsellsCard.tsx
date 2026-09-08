import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import {
  createProductUpsell,
  deleteProductUpsell,
  listAllProducts,
  listProductUpsells,
  updateProductUpsell,
} from "@/features/products/api";
import { formatMoneyValue } from "@/features/products/model";
import type { Product, ProductUpsell, UpdateUpsellData } from "@/features/products/types";

/**
 * Upsell offers attached to a product. Edit-mode only — offers hang off a
 * saved product id, so there is nothing to attach them to on the create form.
 */
export function ProductUpsellsCard({
  productId,
  disabled,
}: {
  productId: string;
  disabled: boolean;
}) {
  const t = useT("products");
  const common = useT("common");
  const locale = useLocale();
  const confirm = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<ProductUpsell[]>([]);
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [priceOverride, setPriceOverride] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listProductUpsells(productId), listAllProducts()])
      .then(([rows, products]) => {
        if (!alive) return;
        setOffers(rows);
        setCandidates(products.filter((item) => item.isUpsell && item.id !== productId));
      })
      .catch(() => {
        if (alive) notify.error(t("form.upsells_load_error"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productId]);

  const attachedIds = new Set(offers.map((offer) => offer.upsellProductId));
  const available = candidates.filter((item) => !attachedIds.has(item.id));

  async function add() {
    if (!selectedId) return;
    setBusy(true);
    try {
      setOffers(
        await createProductUpsell(productId, {
          upsellProductId: selectedId,
          price: priceOverride ? Math.round(Number(priceOverride)) : null,
          position: offers.length + 1,
        }),
      );
      setSelectedId("");
      setPriceOverride("");
      notify.success(t("form.upsells_added"));
    } catch {
      notify.error(t("form.upsells_save_error"));
    } finally {
      setBusy(false);
    }
  }

  async function patch(offer: ProductUpsell, body: UpdateUpsellData) {
    setBusy(true);
    try {
      setOffers(await updateProductUpsell(productId, offer.id, body));
    } catch {
      notify.error(t("form.upsells_save_error"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(offer: ProductUpsell) {
    const ok = await confirm({
      title: t("form.upsells_remove_title"),
      description: t("form.upsells_remove_message"),
      confirmLabel: common("delete"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      setOffers(await deleteProductUpsell(productId, offer.id));
      notify.success(t("form.upsells_removed"));
    } catch {
      notify.error(t("form.upsells_save_error"));
    } finally {
      setBusy(false);
    }
  }

  const locked = disabled || busy;

  return (
    <Card title={t("form.section_upsells")}>
      <p className="-mt-1 mb-4 text-xs text-muted-foreground">{t("form.upsells_hint")}</p>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          className="flex min-h-24 items-center justify-center"
        >
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {offers.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={22} />}
              title={t("form.upsells_empty")}
              compact
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {offers.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center gap-3 p-3">
                  {offer.primaryImageSrc ? (
                    <img
                      src={offer.primaryImageSrc}
                      alt=""
                      className="size-11 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="size-11 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {offer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoneyValue(offer.price, locale)}
                      {offer.overridePrice !== null
                        ? ` · ${t("form.upsells_overridden")}`
                        : ""}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    aria-label={t("form.upsells_price_label")}
                    placeholder={t("form.upsells_inherit")}
                    defaultValue={offer.overridePrice ?? ""}
                    disabled={locked}
                    onBlur={(event) => {
                      const raw = event.currentTarget.value.trim();
                      const next = raw === "" ? null : Math.round(Number(raw));
                      if (next === offer.overridePrice) return;
                      void patch(offer, { price: next });
                    }}
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={offer.isActive}
                      disabled={locked}
                      onChange={(event) =>
                        void patch(offer, { isActive: event.currentTarget.checked })
                      }
                      className="size-4 accent-primary"
                    />
                    {t("form.upsells_active")}
                  </label>
                  <button
                    type="button"
                    onClick={() => void remove(offer)}
                    disabled={locked}
                    aria-label={t("form.upsells_remove_title")}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <Field label={t("form.upsells_add_label")}>
              <Select
                value={selectedId}
                disabled={locked || available.length === 0}
                onChange={(event) => setSelectedId(event.currentTarget.value)}
              >
                <option value="">
                  {available.length === 0
                    ? t("form.upsells_no_candidates")
                    : t("form.upsells_select_placeholder")}
                </option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("form.upsells_price_label")}>
              <Input
                type="number"
                min={0}
                value={priceOverride}
                placeholder={t("form.upsells_inherit")}
                disabled={locked || !selectedId}
                onChange={(event) => setPriceOverride(event.currentTarget.value)}
              />
            </Field>
            <Button type="button" onClick={() => void add()} disabled={locked || !selectedId}>
              <Plus size={16} />
              {t("form.upsells_add")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
