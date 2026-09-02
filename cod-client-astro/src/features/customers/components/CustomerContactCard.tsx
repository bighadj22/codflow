import { MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { Customer } from "@/features/customers/types";

interface CustomerContactCardProps {
  customer: Pick<
    Customer,
    "phone" | "phone2" | "wilaya" | "commune" | "address"
  >;
}

export function CustomerContactCard({ customer }: CustomerContactCardProps) {
  const t = useT("customers");

  return (
    <Card title={t("profile.contact_info")}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <Phone size={18} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("profile.phone")}
            </p>
            <a
              href={`tel:${customer.phone}`}
              dir="ltr"
              className="mt-1 block text-sm font-semibold text-link"
            >
              {customer.phone}
            </a>
            {customer.phone2 && (
              <a
                href={`tel:${customer.phone2}`}
                dir="ltr"
                className="mt-1 block text-sm text-link"
              >
                {customer.phone2}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin size={18} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("profile.wilaya")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {customer.wilaya || "-"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.commune || "-"}
            </p>
            {customer.address && (
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.address}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
