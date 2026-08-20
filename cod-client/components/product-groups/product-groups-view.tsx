"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useProductGroups, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { ProductGroupsTable } from "./product-groups-table";
import { deleteProductGroup } from "@/actions/product-groups";
import type { ProductCategory } from "@/types";

interface Props {
  groups: ProductCategory[];
}

export function ProductGroupsView({ groups }: Props) {
  const router = useRouter();
  const t = useProductGroups();
  const common = useCommon();
  const locale = useErrorLocale();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const handleDelete = async (group: ProductCategory) => {
    const ok = await confirmDialog({
      title: t.form.delete_confirm,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    try {
      await deleteProductGroup(group.id);
      showSuccessToast(t.form.success_edit, locale);
      router.refresh();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : t.form.cannot_delete, locale);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
          {groups.length} {t.groups_count}
        </p>
        <Button
          size="sm"
          className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
          onClick={() => router.push("/product-groups/new")}
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
          {t.add_group}
        </Button>
      </div>

      <ProductGroupsTable
        groups={groups}
        onEdit={(g) => router.push(`/product-groups/${g.id}/edit`)}
        onDelete={handleDelete}
      />
      {ConfirmDialog}
    </div>
  );
}
