import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { OrdersList } from "@/features/orders/components/OrdersList";
import { useT } from "@/i18n/react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";

function Gated() {
  const t = useT("orders");
  const auth = useT("auth");
  const identity = useIdentity();
  if (!canScope(identity, "orders:read")) {
    return (
      <DashboardChrome currentPath="/orders">
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {auth("no_access")}
        </p>
      </DashboardChrome>
    );
  }
  return (
    <DashboardChrome currentPath="/orders">
      <PageHeader
        title={t("page_title")}
        actions={canScope(identity, "orders:create") && (
          <a
            href="/orders/new"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:translate-y-px"
          >
            <Plus size={16} />
            <span>{t("new_order_button")}</span>
          </a>
        )}
      />
      <OrdersList />
    </DashboardChrome>
  );
}

export default function OrdersPageApp() {
  return <RequireAuth><Gated /></RequireAuth>;
}
