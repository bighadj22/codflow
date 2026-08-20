"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Driver, Order } from "@/types";
import { showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { ErrorModal } from "@/components/errors/error-modal";
import { useDelivery } from "@/lib/translations";
import { assignDriverToOrder } from "@/actions/orders";

interface Props {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  readyOrders: Order[];
}

export function AssignOrdersDialog({ open, onClose, driver, readyOrders }: Props) {
  const t = useDelivery();
  const locale = useErrorLocale();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{
    isOpen: boolean;
    message: string;
    code?: string;
  }>({ isOpen: false, message: "" });

  async function handleAssign() {
    if (!driver || !selectedOrders.length) return;

    setLoading(true);
    try {
      await Promise.all(selectedOrders.map((orderId) => assignDriverToOrder(orderId, driver.id)));
      const driverName = `${driver.firstName} ${driver.lastName}`.trim();
      showSuccessToast(
        `${t.assign_dialog.success} ${selectedOrders.length} ${t.assign_dialog.orders_for} ${driverName}`,
        locale
      );
      setSelectedOrders([]);
      onClose();
      window.location.reload();
    } catch (error) {
      // Show error modal for assignment failures
      setErrorState({
        isOpen: true,
        message: error instanceof Error ? error.message : "Failed to assign orders",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setSelectedOrders([]);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground font-black">
            {t.assign_dialog.title} —{" "}
            <span dir="rtl" className="text-primary">
              {driver ? `${driver.firstName} ${driver.lastName}`.trim() : ""}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2 font-semibold">
            {t.assign_dialog.select_orders}
          </p>
          {readyOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-semibold">
              {t.assign_dialog.no_ready_orders}
            </p>
          ) : (
            readyOrders.map((order) => (
              <label
                key={order.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={(e) =>
                    setSelectedOrders((prev) =>
                      e.target.checked
                        ? [...prev, order.id]
                        : prev.filter((id) => id !== order.id)
                    )
                  }
                  className="rounded accent-primary"
                  disabled={loading}
                />
                <div>
                  <p className="text-sm font-black text-foreground">{order.orderNumber}</p>
                  <p dir="rtl" className="text-xs text-muted-foreground font-semibold">
                    {order.customerName} · {order.wilaya}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent hover:bg-muted text-foreground font-bold"
            onClick={handleClose}
            disabled={loading}
          >
            {t.assign_dialog.cancel}
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black"
            onClick={handleAssign}
            disabled={!selectedOrders.length || loading}
          >
            {loading ? "..." : `${t.assign_dialog.assign} (${selectedOrders.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      <ErrorModal
        isOpen={errorState.isOpen}
        onClose={() => setErrorState({ isOpen: false, message: "" })}
        message={errorState.message}
        locale={locale}
        errorCode={errorState.code}
      />
    </Dialog>
  );
}
