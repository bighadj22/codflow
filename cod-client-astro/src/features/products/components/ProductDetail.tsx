import { useEffect, useState } from "react";
import {
  AlertCircle,
  History,
  Layers,
  Package,
  Pencil,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import {
  Button,
  IconButton,
  LinkButton,
  Alert,
  PageHeader,
  StatCard,
  Badge,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteProduct,
  getProduct,
  listProductGroups,
} from "@/features/products/api";
import {
  formatMoneyValue,
  productErrorMessage,
} from "@/features/products/model";
import type {
  Product,
  ProductCategory,
  ProductStatus,
} from "@/features/products/types";
import { StockHistoryDrawer } from "@/features/products/components/StockHistoryDrawer";
import { ProductVariantsTableCard } from "@/features/products/components/ProductVariantsTableCard";
import { ProductImagesCard } from "@/features/products/components/ProductImagesCard";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const t = useT("products");
  if (status === "ACTIVE")
    return <Badge tone="success">{t("status_options.active")}</Badge>;
  if (status === "DRAFT")
    return <Badge tone="neutral">{t("status_options.draft")}</Badge>;
  return <Badge tone="critical">{t("status_options.archived")}</Badge>;
}

export function ProductDetail({ productId }: { productId: string }) {
  const t = useT("products");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    open: boolean;
    variantId?: string;
    variantLabel?: string | null;
  }>({ open: false });

  const canManage = canScope(identity, SCOPES.PRODUCTS_MANAGE);

  async function load() {
    setError(null);
    try {
      const [nextProduct, nextCategories] = await Promise.all([
        getProduct(productId),
        listProductGroups().catch(() => []),
      ]);
      setProduct(nextProduct);
      setCategories(nextCategories);
    } catch (cause) {
      setError(productErrorMessage(cause, t));
    }
  }
  useEffect(() => {
    if (canScope(identity, SCOPES.PRODUCTS_READ)) void load();
  }, [productId, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.PRODUCTS_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (error && !product)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  if (!product) return <Loading />;

  const category = categories.find((item) => item.id === product.categoryId);
  const totalInventory = product.totalInventory ?? product.inventory ?? 0;

  async function removeProduct(productToDelete: Product) {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace(
          "{name}",
          productToDelete.name,
        ),
        description: common("delete_description"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteProduct(productToDelete.id);
      notify.flashSuccess(t("success_deleted"));
      window.location.assign("/products");
    } catch (cause) {
      const message = productErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    }
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        title={product.name}
        subtitle={product.handle}
        backHref="/products"
        backLabel={t("page_title")}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <LinkButton
                href={`/products/${encodeURIComponent(product.id)}/edit`}
                variant="secondary"
              >
                <Pencil size={16} />
                {t("actions.edit")}
              </LinkButton>
              <Button
                type="button"
                variant="dangerOutline"
                onClick={() => void removeProduct(product)}
              >
                <Trash2 size={16} />
                {t("actions.delete")}
              </Button>
            </div>
          ) : undefined
        }
      />
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted sm:size-24">
          {product.primaryImageSrc ? (
            <img
              src={product.primaryImageSrc}
              alt={product.name}
              className="size-full object-cover"
            />
          ) : (
            <Package size={40} className="text-muted-foreground/40" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProductStatusBadge status={product.status} />
            {product.sku && (
              <span className="rounded-lg border border-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                {product.sku}
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <Tag size={9} className="text-primary/50" />
                {category.name}
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label={t("table.price")}
          value={formatMoneyValue(product.price, locale)}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label={t("table.variants")}
          value={product.variantsCount ?? product.variants?.length ?? 0}
          icon={<Layers size={20} />}
        />
        <StatCard
          label={t("stock.in_stock")}
          value={totalInventory}
          icon={<Package size={20} />}
        />
        <div className="flex items-center justify-end gap-2">
          <IconButton
            type="button"
            aria-label={t("actions.stock_history")}
            title={t("actions.stock_history")}
            onClick={() => setHistory({ open: true })}
          >
            <History size={15} />
          </IconButton>
        </div>
      </div>

      <ProductVariantsTableCard
        productId={product.id}
        variants={product.variants ?? []}
        onOpenHistory={(variantId, label) =>
          setHistory({
            open: true,
            variantId,
            variantLabel: label,
          })
        }
      />

      <ProductImagesCard
        productName={product.name}
        images={product.images ?? []}
      />

      <StockHistoryDrawer
        productId={product.id}
        variantId={history.variantId}
        productName={product.name}
        variantLabel={history.variantLabel}
        open={history.open}
        onClose={() => setHistory({ open: false })}
      />
    </div>
  );
}
