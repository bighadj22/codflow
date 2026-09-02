import { Plus } from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { LinkButton, PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomersList } from "@/features/customers/components/CustomersList";

function Gated() {
  const t = useT("customers");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/customers">
      <PageHeader
        title={t("page_title")}
        actions={
          canScope(identity, SCOPES.CUSTOMERS_CREATE) ? (
            <LinkButton href="/customers/new">
              <Plus size={16} />
              {t("new_customer")}
            </LinkButton>
          ) : undefined
        }
      />
      <CustomersList />
    </DashboardChrome>
  );
}

export default function CustomersPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
