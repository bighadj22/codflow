"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProducts, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { ProductsTable } from "./products-table";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { deleteProduct } from "@/actions/products";
import { ErrorModal } from "@/components/errors/error-modal";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useState } from "react";
import type { Product, ProductCategory } from "@/types";

interface Props {
  products: Product[];
  groups: ProductCategory[];
  userScopes: string[];
}

export function ProductsView({ products, groups, userScopes }: Props) {
  const router = useRouter();
  const t = useProducts();
  const common = useCommon();
  const locale = useErrorLocale();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  
  const [errorState, setErrorState] = useState<{
    isOpen: boolean;
    message: string;
    code?: string;
  }>({ isOpen: false, message: "" });

  const handleDelete = async (product: Product) => {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", product.name) ?? product.name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    try {
      await deleteProduct(product.id);
      toast.success(t.success_deleted);
      router.refresh();
    } catch (e) {
      // Show error modal for unexpected errors
      setErrorState({
        isOpen: true,
        message: e instanceof Error ? e.message : t.error_delete_failed,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
          {products.length} {t.products_count}
        </p>
        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.PRODUCTS_CREATE}>
          <Button
            size="sm"
            className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
            onClick={() => router.push("/products/new")}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
            {t.add_product}
          </Button>
        </ProtectedAction>
      </div>

      <ProductsTable
        products={products}
        groups={groups}
        onView={(p) => router.push(`/products/${p.id}`)}
        onEdit={(p) => router.push(`/products/${p.id}/edit`)}
        onDelete={handleDelete}
      />
      {ConfirmDialog}
      
      <ErrorModal
        isOpen={errorState.isOpen}
        onClose={() => setErrorState({ isOpen: false, message: "" })}
        message={errorState.message}
        locale={locale}
        errorCode={errorState.code}
      />
    </div>
  );
}
