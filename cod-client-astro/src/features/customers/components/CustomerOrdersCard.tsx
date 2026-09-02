import { Package } from "lucide-react";
import {
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { formatMoney } from "@/features/orders/model";
import { isOrderStatus } from "@/features/customers/model";
import { useT } from "@/i18n/react";
import type { CustomerOrderSummary } from "@/features/customers/types";
import type { Locale } from "@/i18n/config";

interface CustomerOrdersCardProps {
  orders: CustomerOrderSummary[];
  locale: Locale;
}

export function CustomerOrdersCard({ orders, locale }: CustomerOrdersCardProps) {
  const t = useT("customers");

  return (
    <Card flush>
      {orders.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title={t("profile.no_orders")}
        />
      ) : (
        <>
          <div className="divide-y divide-border md:hidden">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <a
                    href={`/orders/${encodeURIComponent(order.id)}`}
                    className="block truncate font-semibold text-link"
                  >
                    {order.orderNumber}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(
                      locale === "ar" ? "ar-DZ" : `${locale}-DZ`,
                      { dateStyle: "medium" },
                    ).format(new Date(order.createdAt))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold">
                    {formatMoney(order.price, locale)}
                  </span>
                  {isOrderStatus(order.status) && (
                    <OrderStatusBadge status={order.status} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profile.order_number")}</TableHead>
                  <TableHead className="text-end">
                    {t("profile.price")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("profile.status")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("profile.date")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="border-t border-border"
                  >
                    <TableCell>
                      <a
                        href={`/orders/${encodeURIComponent(order.id)}`}
                        className="font-semibold text-link"
                      >
                        {order.orderNumber}
                      </a>
                    </TableCell>
                    <TableCell className="text-end font-semibold">
                      {formatMoney(order.price, locale)}
                    </TableCell>
                    <TableCell className="text-center">
                      {isOrderStatus(order.status) ? (
                        <OrderStatusBadge status={order.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {order.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(
                        locale === "ar" ? "ar-DZ" : `${locale}-DZ`,
                        { dateStyle: "medium" },
                      ).format(new Date(order.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
