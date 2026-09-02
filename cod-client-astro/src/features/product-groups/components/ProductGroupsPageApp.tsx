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
import { ProductGroupsList } from "@/features/product-groups/components/ProductGroupsList";

function Gated() {
  const t = useT("product-groups");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/product-groups">
      <PageHeader
        title={t("page_title")}
        actions={
          canScope(identity, SCOPES.PRODUCT_GROUPS_MANAGE) ? (
            <LinkButton href="/product-groups/new">
              <Plus size={16} />
              {t("add_group")}
            </LinkButton>
          ) : undefined
        }
      />
      <ProductGroupsList />
    </DashboardChrome>
  );
}

export default function ProductGroupsPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
