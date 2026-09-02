import { Calendar, Package, Trash2, TrendingDown } from "lucide-react";
import { Card, StatCard } from "@/components/ui";
import { formatMoney } from "@/features/orders/model";
import { calculateReturnRate } from "@/features/customers/model";
import { useT } from "@/i18n/react";
import type { Customer, CustomerOrderSummary } from "@/features/customers/types";
import type { Locale } from "@/i18n/config";

interface CustomerStatsSidebarProps {
  customer: Pick<Customer, "totalOrders" | "totalSpent" | "createdAt">;
  orders: CustomerOrderSummary[];
  locale: Locale;
}

export function CustomerStatsSidebar({
  customer,
  orders,
  locale,
}: CustomerStatsSidebarProps) {
  const t = useT("customers");
  const returnRate = calculateReturnRate(orders);

  return (
    <aside className="space-y-4">
      <StatCard
        label={t("profile.orders")}
        value={customer.totalOrders}
        icon={<Package size={18} />}
      />
      <StatCard
        label={t("profile.total_spent")}
        value={formatMoney(customer.totalSpent, locale)}
        icon={<TrendingDown size={18} />}
        tone="success"
      />
      <StatCard
        label={t("profile.return_rate")}
        value={`${returnRate}%`}
        icon={<Trash2 size={18} />}
        tone={
          returnRate > 10
            ? "critical"
            : returnRate > 0
              ? "warning"
              : "success"
        }
      />
      <Card>
        <div className="flex items-start gap-3">
          <Calendar size={17} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("profile.customer_since")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {new Intl.DateTimeFormat(
                locale === "ar" ? "ar-DZ" : `${locale}-DZ`,
                { dateStyle: "medium" },
              ).format(new Date(customer.createdAt))}
            </p>
          </div>
        </div>
      </Card>
    </aside>
  );
}
