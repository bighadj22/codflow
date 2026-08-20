"use client";

import { useRouter } from "next/navigation";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCustomerGroups, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { deleteCustomerGroup } from "@/actions/customer-groups";
import { CustomerGroupsTable } from "./customer-groups-table";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import type { CustomerGroup } from "@/types";

interface Props {
  groups: CustomerGroup[];
  userScopes: string[];
}

export function CustomerGroupsView({ groups, userScopes }: Props) {
  const t = useCustomerGroups();
  const common = useCommon();
  const router = useRouter();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  async function handleDelete(group: CustomerGroup) {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", group.name) ?? group.name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    try {
      await deleteCustomerGroup(group.id);
      toast.success(t.success_deleted);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.error_delete_failed);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl w-fit">
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {groups.length} {t.groups_count}
          </p>
        </div>

        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
          <Button
            size="sm"
            className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
            onClick={() => router.push("/customer-groups/new")}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
            {t.new_group}
          </Button>
        </ProtectedAction>
      </div>

      <CustomerGroupsTable
        groups={groups}
        onView={(g) => router.push(`/customer-groups/${g.id}`)}
        onEdit={(g) => router.push(`/customer-groups/${g.id}/edit`)}
        onDelete={handleDelete}
      />
      {ConfirmDialog}
    </div>
  );
}
