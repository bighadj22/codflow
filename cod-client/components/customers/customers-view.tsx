"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Customer } from "@/types";
import { toast } from "sonner";
import { useCustomers, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { deleteCustomer } from "@/actions/customers";
import { CustomersTable } from "./customers-table";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { ErrorModal } from "@/components/errors/error-modal";
import { useErrorLocale } from "@/lib/errors/use-locale";

interface Props { customers: Customer[]; userScopes: string[] }

export function CustomersView({ customers, userScopes }: Props) {
  const t = useCustomers();
  const common = useCommon();
  const router = useRouter();
  const locale = useErrorLocale();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [isDeleting, startDeleteTransition] = useTransition();
  
  const [errorState, setErrorState] = useState<{
    isOpen: boolean;
    message: string;
    code?: string;
  }>({ isOpen: false, message: "" });

  async function handleDelete(customer: Customer) {
    if ((customer.totalOrders ?? 0) > 0) {
      // Show blocking error modal for business logic error
      setErrorState({
        isOpen: true,
        message: t.error_cannot_delete_with_orders,
        code: "CUSTOMER_HAS_ORDERS",
      });
      return;
    }
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", customer.name) ?? customer.name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    startDeleteTransition(async () => {
      try {
        await deleteCustomer(customer.id);
        toast.success(t.success_deleted);
        router.refresh();
      } catch (error) {
        // Show error modal for unexpected errors
        setErrorState({
          isOpen: true,
          message: error instanceof Error ? error.message : t.error_delete_failed,
        });
      }
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl w-fit">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {customers.length} {t.customers_count}
          </p>
        </div>
        
        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMERS_CREATE}>
          <Button
            size="sm"
            className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
            onClick={() => router.push("/customers/new")}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
            {t.new_customer}
          </Button>
        </ProtectedAction>
      </div>

      <CustomersTable
        customers={customers}
        onView={(c) => router.push(`/customers/${c.id}`)}
        onEdit={(c) => router.push(`/customers/${c.id}/edit`)}
        onDelete={handleDelete}
        isDeleting={isDeleting}
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
