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
import { OffersList } from "@/features/offers/components/OffersList";

function Gated() {
  const t = useT("offers");
  const identity = useIdentity();
  return (
    <DashboardChrome currentPath="/offers">
      <PageHeader
        title={t("page_title")}
        actions={
          canScope(identity, SCOPES.OFFERS_MANAGE) ? (
            <LinkButton href="/offers/new">
              <Plus size={16} />
              {t("add_offer")}
            </LinkButton>
          ) : undefined
        }
      />
      <OffersList />
    </DashboardChrome>
  );
}

export default function OffersPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
