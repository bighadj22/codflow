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
import { CustomerGroupsList } from "@/features/customer-groups/components/CustomerGroupsList";

function Gated() {
  const t = useT("customer-groups");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/customer-groups">
      <PageHeader
        title={t("page_title")}
        actions={
          canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE) ? (
            <LinkButton href="/customer-groups/new">
              <Plus size={16} />
              {t("new_group")}
            </LinkButton>
          ) : undefined
        }
      />
      <CustomerGroupsList />
    </DashboardChrome>
  );
}

export default function CustomerGroupsPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
