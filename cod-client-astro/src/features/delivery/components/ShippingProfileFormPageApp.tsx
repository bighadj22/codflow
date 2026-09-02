import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { ShippingProfileForm } from "@/features/delivery/components/ShippingProfileForm";

interface Props {
  profileId?: string;
}

function Gated({ profileId }: Props) {
  return (
    <DashboardChrome
      currentPath={
        profileId
          ? `/delivery/shipping-profiles/${profileId}/edit`
          : "/delivery/shipping-profiles/new"
      }
    >
      <ShippingProfileForm profileId={profileId} />
    </DashboardChrome>
  );
}

export default function ShippingProfileFormPageApp({ profileId }: Props) {
  return (
    <RequireAuth>
      <Gated profileId={profileId} />
    </RequireAuth>
  );
}
