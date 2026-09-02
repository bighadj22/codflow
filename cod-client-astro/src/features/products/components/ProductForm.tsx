import { useEffect, useRef, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  createProduct,
  createVariant,
  deleteProductImage,
  deleteVariant,
  getProduct,
  listProductGroups,
  listProductImages,
  listShippingProfiles,
  listVariants,
  saveProductImage,
  updateProduct,
  updateVariant,
} from "@/features/products/api";
import {
  apiVariantOptions,
  calcMargin,
  generateCombinations,
  productErrorMessage,
  toSlug,
} from "@/features/products/model";
import type {
  ProductImage,
  ProductStatus,
  ShippingProfile,
  VariantOptionFormState,
} from "@/features/products/types";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  useConfirmDialog,
} from "@/components/ui";
import {
  ProductImageUploader,
  type PendingImage,
} from "@/features/products/components/ProductImageUploader";
import { ProductBasicInfoCard } from "@/features/products/components/ProductBasicInfoCard";
import { ProductPricingCard } from "@/features/products/components/ProductPricingCard";
import {
  ProductVariantsCard,
  type VariantRow,
} from "@/features/products/components/ProductVariantsCard";
import { ProductSettingsCard } from "@/features/products/components/ProductSettingsCard";

export function ProductForm({ productId }: { productId?: string }) {
  const t = useT("products");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const editing = Boolean(productId);
  const [initialLoading, setInitialLoading] = useState(editing);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shippingProfileId, setShippingProfileId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const priceRef = useRef("");
  priceRef.current = price;
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");
  const [trackInventory, setTrackInventory] = useState(true);
  const [inventory, setInventory] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  const [hasVariantsSwitch, setHasVariantsSwitch] = useState(false);
  const [variantOptions, setVariantOptions] = useState<VariantOptionFormState[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  const canManage = canScope(identity, SCOPES.PRODUCTS_MANAGE);
  const canSave = editing
    ? canScope(identity, SCOPES.PRODUCTS_READ) && canManage
    : canScope(identity, SCOPES.PRODUCTS_CREATE);

  async function toggleVariants(nextChecked: boolean) {
    if (!nextChecked && editing && variantRows.length > 0) {
      if (
        !(await confirm({
          title: t("form.remove_variants_confirm"),
          description: t("form.remove_variants_confirm_desc"),
          confirmLabel: t("form.remove_variants_confirm_label"),
          tone: "danger",
        }))
      )
        return;
    }
    setHasVariantsSwitch(nextChecked);
    if (!nextChecked) setVariantOptions([]);
  }

  useEffect(() => {
    if (!editing && name) setSlug(toSlug(name));
  }, [name, editing]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listProductGroups().catch(() => []),
      listShippingProfiles().catch(() => []),
    ])
      .then(([nextGroups, nextProfiles]) => {
        if (alive) {
          setGroups(nextGroups);
          setShippingProfiles(nextProfiles);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function canLoadExisting() {
    return (
      canScope(identity, SCOPES.PRODUCTS_READ) &&
      canScope(identity, SCOPES.PRODUCTS_MANAGE)
    );
  }

  useEffect(() => {
    if (!productId || !canLoadExisting()) return;
    let alive = true;
    Promise.all([
      getProduct(productId),
      listVariants(productId),
      listProductImages(productId),
    ])
      .then(([product, loadedVariants, loadedImages]) => {
        if (!alive || !product) return;
        setExistingImages(loadedImages);
        setName(product.name);
        setSlug(product.handle);
        setSku(product.sku ?? "");
        setCategoryId(product.categoryId ?? "");
        setShippingProfileId(product.shippingProfileId ?? "");
        setDescription(product.description ?? "");
        setPrice(String(product.price));
        setCompareAtPrice(
          product.compareAtPrice ? String(product.compareAtPrice) : "",
        );
        setCostPrice(product.costPrice ? String(product.costPrice) : "");
        setStatus(product.status);
        setTrackInventory(product.trackInventory);
        setInventory(String(product.inventory));
        setLowStockThreshold(String(product.lowStockThreshold ?? 5));
        if (product.hasVariants) {
          setHasVariantsSwitch(true);
          if (product.variantOptions) {
            setVariantOptions(
              product.variantOptions.map((option) => ({
                id: `tmp-${Math.random().toString(36).slice(2)}`,
                name: option.name,
                values: option.values.map((value) => ({
                  id: `tmp-${Math.random().toString(36).slice(2)}`,
                  value: value.value,
                  hexColor: value.hexColor ?? "",
                })),
              })),
            );
          }
          if (loadedVariants.length > 0) {
            setVariantRows(
              loadedVariants.map((variant) => ({
                key: Object.values(variant.variations).join(" / "),
                variations: variant.variations,
                price: String(variant.price),
                sku: variant.sku ?? "",
                inventory: String(variant.inventory),
                lowStockThreshold: String(variant.lowStockThreshold ?? 5),
                active: variant.active,
                existingId: variant.id,
                imageId: variant.imageId ?? null,
              })),
            );
          }
        }
      })
      .catch((cause) => {
        if (alive) setMessage(productErrorMessage(cause, t));
      })
      .finally(() => {
        if (alive) setInitialLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productId, identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    const combos = generateCombinations(variantOptions);
    setVariantRows((prev) => {
      const byKey = Object.fromEntries(prev.map((row) => [row.key, row]));
      return combos.map((combo) => ({
        ...combo,
        price: byKey[combo.key]?.price ?? priceRef.current,
        sku: byKey[combo.key]?.sku ?? "",
        inventory: byKey[combo.key]?.inventory ?? "0",
        lowStockThreshold: byKey[combo.key]?.lowStockThreshold ?? "5",
        active: byKey[combo.key]?.active ?? true,
        existingId: byKey[combo.key]?.existingId,
        imageId: byKey[combo.key]?.imageId ?? null,
      }));
    });
  }, [variantOptions]);

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("form.error_name_price_required");
    if (!price || Number(price) < 0)
      next.price = t("form.error_name_price_required");
    if (hasVariantsSwitch && variantRows.some((row) => !row.sku.trim()))
      next.variantRowsSku = t("form.error_required_variant_sku");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    try {
      const apiOptions = apiVariantOptions(variantOptions);
      const hasVariants = apiOptions.length > 0 && variantRows.length > 0;
      const variantsToDelete: string[] = [];
      const orphanedIds = new Set<string>();

      if (editing && productId) {
        const existingVariants = await listVariants(productId);
        if (!hasVariantsSwitch) {
          for (const variant of existingVariants) {
            variantsToDelete.push(variant.id);
            orphanedIds.add(variant.id);
          }
        } else {
          for (const variant of existingVariants) {
            const isStillValid =
              apiOptions.length > 0 &&
              Object.entries(variant.variations).every(
                ([optionName, optionValue]) => {
                  const match = apiOptions.find(
                    (option) => option.name === optionName,
                  );
                  return (
                    match !== undefined &&
                    match.values.some((value) => value.value === optionValue)
                  );
                },
              );
            if (!isStillValid) {
              variantsToDelete.push(variant.id);
              orphanedIds.add(variant.id);
            }
          }
        }
      }

      const data: Record<string, unknown> = {
        name,
        handle: slug || toSlug(name),
        sku: sku || undefined,
        categoryId: categoryId || undefined,
        shippingProfileId: shippingProfileId || undefined,
        description: description || undefined,
        price: Math.round(Number(price)),
        compareAtPrice: compareAtPrice
          ? Math.round(Number(compareAtPrice))
          : undefined,
        costPrice: costPrice ? Math.round(Number(costPrice)) : undefined,
        status,
        trackInventory,
        ...(editing
          ? {}
          : { inventory: hasVariants ? 0 : Number(inventory) || 0 }),
        lowStockThreshold: hasVariants
          ? undefined
          : Number(lowStockThreshold) || 5,
        hasVariants,
        variantOptions: hasVariants ? apiOptions : null,
      };

      let savedId: string;
      if (editing && productId) {
        await updateProduct(productId, data as never);
        savedId = productId;
      } else {
        savedId = (await createProduct(data as never)).data.id;
      }

      if (hasVariants) {
        for (const row of variantRows) {
          if (row.existingId && orphanedIds.has(row.existingId)) continue;
          const variantData = {
            variations: row.variations,
            price: Math.round(Number(row.price) || 0),
            sku: row.sku.trim(),
            inventory: Number(row.inventory) || 0,
            lowStockThreshold: Number(row.lowStockThreshold) || 5,
            active: row.active,
            imageId: row.imageId ?? null,
          };
          if (row.existingId)
            await updateVariant(savedId, row.existingId, variantData as never);
          else await createVariant(savedId, variantData as never);
        }
      }
      for (const variantId of variantsToDelete) {
        await deleteVariant(savedId, variantId);
      }
      for (const imageId of deletedImageIds) {
        await deleteProductImage(savedId, imageId);
      }
      for (let i = 0; i < pendingImages.length; i++) {
        await saveProductImage(savedId, {
          key: pendingImages[i].key,
          src: pendingImages[i].url,
          position: existingImages.length - deletedImageIds.length + i + 1,
        });
      }
      notify.flashSuccess(t(editing ? "form.success_edit" : "form.success_add"));
      window.location.assign("/products");
    } catch (cause) {
      const message = productErrorMessage(cause, t);
      setMessage(message);
      notify.error(message);
      setBusy(false);
    }
  }

  if (!canSave || (editing && message && !name))
    return (
      <Alert role="alert" tone="critical">
        {message ?? auth("no_access")}
      </Alert>
    );

  if (initialLoading)
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );

  const margin = calcMargin(price, costPrice);
  const showImageCol = editing && existingImages.length > 0;
  const backHref = productId
    ? `/products/${encodeURIComponent(productId)}`
    : "/products";

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        title={editing ? t("form.title_edit") : t("form.title_add")}
        backHref={backHref}
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
        <ProductBasicInfoCard
          name={name}
          setName={setName}
          sku={sku}
          setSku={setSku}
          slug={slug}
          setSlug={setSlug}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          shippingProfileId={shippingProfileId}
          setShippingProfileId={setShippingProfileId}
          description={description}
          setDescription={setDescription}
          groups={groups}
          shippingProfiles={shippingProfiles}
          errors={errors}
          setErrors={setErrors}
          busy={busy}
          hasVariantsSwitch={hasVariantsSwitch}
        />

        <Card title={t("form.section_images")}>
          <ProductImageUploader
            existingImages={existingImages}
            pendingImages={pendingImages}
            productId={productId}
            disabled={busy}
            onPendingAdd={(img) => setPendingImages((prev) => [...prev, img])}
            onPendingRemove={(clientId) =>
              setPendingImages((prev) =>
                prev.filter((item) => item.clientId !== clientId),
              )
            }
            onExistingRemove={(imageId) => {
              setExistingImages((prev) =>
                prev.filter((item) => item.id !== imageId),
              );
              setDeletedImageIds((prev) => [...prev, imageId]);
            }}
            onExistingReorder={setExistingImages}
            onPendingReorder={setPendingImages}
          />
        </Card>

        <ProductPricingCard
          price={price}
          setPrice={setPrice}
          compareAtPrice={compareAtPrice}
          setCompareAtPrice={setCompareAtPrice}
          costPrice={costPrice}
          setCostPrice={setCostPrice}
          margin={margin}
          hasVariantsSwitch={hasVariantsSwitch}
          errors={errors}
          busy={busy}
        />

        <ProductVariantsCard
          hasVariantsSwitch={hasVariantsSwitch}
          onToggleVariants={toggleVariants}
          variantOptions={variantOptions}
          setVariantOptions={setVariantOptions}
          variantRows={variantRows}
          setVariantRows={setVariantRows}
          existingImages={existingImages}
          errors={errors}
          setErrors={setErrors}
          busy={busy}
          showImageCol={showImageCol}
        />

        <ProductSettingsCard
          status={status}
          setStatus={setStatus}
          inventory={inventory}
          setInventory={setInventory}
          lowStockThreshold={lowStockThreshold}
          setLowStockThreshold={setLowStockThreshold}
          trackInventory={trackInventory}
          setTrackInventory={setTrackInventory}
          hasVariantsSwitch={hasVariantsSwitch}
          editing={editing}
          busy={busy}
        />
      </div>
    </div>
  );
}
