"use client";

import { AlertCircle } from "lucide-react";
import { useOrders } from "@/lib/translations";

interface Props {
  productId: string;
  variantId: string | null;
  quantity: number;
  currentStock: number;
}

export function StockDeductionIndicator({ quantity, currentStock }: Props) {
  const t = useOrders();
  const remaining = currentStock - quantity;
  const isSufficient = remaining >= 0;

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-semibold">
          {t.form.current_stock}:
        </span>
        <span className="font-black text-foreground">{currentStock}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-semibold">
          {t.form.remaining_stock}:
        </span>
        <span
          className={`font-black ${
            isSufficient ? "text-green-600" : "text-red-600"
          }`}
        >
          {remaining}
        </span>
      </div>
      {!isSufficient && (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle size={12} />
          <span className="font-bold">{t.form.insufficient_stock}</span>
        </div>
      )}
    </div>
  );
}
