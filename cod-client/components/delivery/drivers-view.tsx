"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { DeliveryTable } from "./delivery-table";
import { AssignOrdersDialog } from "./assign-orders-dialog";
import { useDelivery, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { deleteDriver } from "@/actions/drivers";
import { showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { ErrorModal } from "@/components/errors/error-modal";
import { useState } from "react";
import type { Driver, Order } from "@/types";

interface Props {
  drivers: Driver[];
  driverOrdersMap: Record<string, Order[]>;
  readyOrders: Order[];
  userScopes: string[];
}

export function DriversView({
  drivers: initialDrivers,
  driverOrdersMap,
  readyOrders,
  userScopes,
}: Props) {
  const t = useDelivery();
  const common = useCommon();
  const router = useRouter();
  const locale = useErrorLocale();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [errorState, setErrorState] = useState<{
    isOpen: boolean;
    message: string;
    code?: string;
  }>({ isOpen: false, message: "" });

  function handleAssignOrders(driver: Driver) {
    setSelectedDriver(driver);
    setAssignDialogOpen(true);
  }

  function handleCompensations(driver: Driver) {
    router.push(`/delivery/drivers/${driver.id}/compensations`);
  }

  async function handleDeleteDriver(driver: Driver) {
    const activeCount = driverOrdersMap[driver.id]?.length ?? 0;
    if (activeCount > 0) {
      // Show blocking error modal for business logic error
      setErrorState({
        isOpen: true,
        message: t.error_cannot_delete_with_orders,
        code: "DRIVER_HAS_ACTIVE_ORDERS",
      });
      return;
    }

    const name = `${driver.firstName} ${driver.lastName}`;
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", name) ?? name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;

    try {
      await deleteDriver(driver.id);
      showSuccessToast(t.success_deleted, locale);
      router.refresh();
    } catch (error) {
      // Show error modal for unexpected errors
      setErrorState({
        isOpen: true,
        message: error instanceof Error ? error.message : t.error_delete_failed,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
          {initialDrivers.length} {t.tabs?.drivers ?? "Drivers"}
        </p>
        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.DELIVERY_MANAGE}>
          <Button
            size="sm"
            className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
            onClick={() => router.push("/delivery/drivers/new")}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
            {t.add_driver}
          </Button>
        </ProtectedAction>
      </div>

      <DeliveryTable
        drivers={initialDrivers}
        driverOrdersMap={driverOrdersMap}
        onView={(driver) => router.push(`/delivery/drivers/${driver.id}`)}
        onEdit={(driver) => router.push(`/delivery/drivers/${driver.id}/edit`)}
        onDelete={handleDeleteDriver}
        onAssignOrders={handleAssignOrders}
        onCompensations={handleCompensations}
      />

      <AssignOrdersDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        driver={selectedDriver}
        readyOrders={readyOrders}
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
