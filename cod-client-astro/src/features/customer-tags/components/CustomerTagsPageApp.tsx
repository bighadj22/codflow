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
import { CustomerTagsList } from "@/features/customer-tags/components/CustomerTagsList";

function Gated() {
  const t = useT("customer-tags");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/customer-tags">
      <PageHeader
        title={t("page_title")}
        actions={
          canScope(identity, SCOPES.CUSTOMER_TAGS_MANAGE) ? (
            <LinkButton href="/customer-tags/new">
              <Plus size={16} />
              {t("new_tag")}
            </LinkButton>
          ) : undefined
        }
      />
      <CustomerTagsList />
    </DashboardChrome>
  );
}

export default function CustomerTagsPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
