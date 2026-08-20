"use client";

import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/components/orders/orders-table";
import type { Order, Driver, DeliveryCompany } from "@/types";
import { useOrders } from "@/lib/translations";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";

interface Props {
  orders: Order[];
  drivers: Driver[];
  companies: DeliveryCompany[];
  userScopes: string[];
}

export function OrdersView({ orders, drivers, companies, userScopes }: Props) {
  const t = useOrders();
  const router = useRouter();

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl w-fit">
          <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {orders.length} {t.orders_count}
          </p>
        </div>
        
        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.ORDERS_CREATE}>
          <Button
            size="sm"
            className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
            onClick={() => router.push("/orders/new")}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
            {t.new_order_button}
          </Button>
        </ProtectedAction>
      </div>

      <OrdersTable
        orders={orders}
        drivers={drivers}
        companies={companies}
        userScopes={userScopes}
      />
    </div>
  );
}
