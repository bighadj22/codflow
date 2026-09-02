import { Package } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import { formatMoney, orderTotal } from "@/features/orders/model";
import type { OrderDetail } from "@/features/orders/types";
import type { Locale } from "@/i18n/config";

interface OrderProductsCardProps {
  order: Pick<OrderDetail, "products" | "price" | "deliveryFee">;
  locale: Locale;
}

export function OrderProductsCard({ order, locale }: OrderProductsCardProps) {
  const t = useT("orders");

  return (
    <Card title={t("form.products_section")}>
      <div className="divide-y divide-border">
        {order.products.map((product) => {
          const free =
            product.pricePerUnit === 0 && product.lineTotal === 0;
          return (
            <div
              key={product.id}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Package
                size={17}
                className="mt-0.5 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {product.productName}
                </p>
                {product.variantLabel && (
                  <p className="text-xs text-muted-foreground">
                    {product.variantLabel}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {product.quantity} ×{" "}
                  {free
                    ? t("form.free")
                    : formatMoney(product.pricePerUnit, locale)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${free ? "text-success" : ""}`}
              >
                {free ? "-" : formatMoney(product.lineTotal, locale)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("detail.subtotal")}</span>
          <span className="tabular-nums">{formatMoney(order.price, locale)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("detail.delivery_fee")}</span>
          <span className="tabular-nums">{formatMoney(order.deliveryFee, locale)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 font-bold">
          <span>{t("detail.total_price")}</span>
          <span className="tabular-nums">{formatMoney(orderTotal(order), locale)}</span>
        </div>
      </div>
    </Card>
  );
}
