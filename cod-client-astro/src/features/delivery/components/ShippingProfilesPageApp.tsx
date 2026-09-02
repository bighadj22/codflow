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
import { ShippingProfilesList } from "@/features/delivery/components/ShippingProfilesList";

function Gated() {
  const t = useT("settings");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/delivery/shipping-profiles">
      <PageHeader
        title={t("shipping.title")}
        subtitle={t("shipping.subtitle")}
        actions={
          canScope(identity, SCOPES.DELIVERY_MANAGE) ? (
            <LinkButton href="/delivery/shipping-profiles/new">
              <Plus size={16} />
              {t("shipping.create_profile")}
            </LinkButton>
          ) : undefined
        }
      />
      <ShippingProfilesList />
    </DashboardChrome>
  );
}

export default function ShippingProfilesPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
