import { Check, UserRound, X } from "lucide-react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { Commune, Customer, Wilaya } from "@/features/orders/types";
import type { Locale } from "@/i18n/config";

interface NewOrderCustomerCardProps {
  customerSearch: string;
  setCustomerSearch: (val: string) => void;
  customerId: string;
  setCustomerId: (val: string) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  wilayaId: string;
  setWilayaId: (val: string) => void;
  communeId: string;
  setCommuneId: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  deliveryType: "home" | "stop_desk";
  customers: Customer[];
  wilayas: Wilaya[];
  communes: Commune[];
  errors: Record<string, string>;
  locale: Locale;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  pendingCommuneIdRef: { current: string | null };
}

export function NewOrderCustomerCard({
  customerSearch,
  setCustomerSearch,
  customerId,
  setCustomerId,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  wilayaId,
  setWilayaId,
  communeId,
  setCommuneId,
  address,
  setAddress,
  deliveryType,
  customers,
  wilayas,
  communes,
  errors,
  locale,
  onSelectCustomer,
  onClearCustomer,
  pendingCommuneIdRef,
}: NewOrderCustomerCardProps) {
  const t = useT("orders");
  const common = useT("common");

  return (
    <Card title={t("detail.customer_info")}>
      <div className="space-y-4">
        <Field label={t("form.search_customer")}>
          <div className="relative">
            <Input
              value={customerSearch}
              onChange={(event) => {
                if (customerId) setCustomerId("");
                setCustomerSearch(event.currentTarget.value);
              }}
              placeholder={t("form.search_customer")}
            />
            {customerId && (
              <button
                type="button"
                onClick={onClearCustomer}
                aria-label={common("cancel")}
                className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {customerSearch && customers.length > 0 && !customerId && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border bg-background">
              {customers.slice(0, 6).map((customer) => (
                <button
                  type="button"
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer)}
                  className="flex min-h-11 w-full items-center gap-3 border-b border-border px-3 text-start last:border-0 hover:bg-muted"
                >
                  <UserRound
                    size={15}
                    className="text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {customer.name}
                    </span>
                    <span
                      className="block text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {customer.phone}
                    </span>
                  </span>
                  {customer.id === customerId && (
                    <Check size={15} className="text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("form.customer_name_label")}
            error={errors.customerName}
          >
            <Input
              value={customerName}
              onChange={(event) =>
                setCustomerName(event.currentTarget.value)
              }
              placeholder={t("form.customer_name_placeholder")}
            />
          </Field>
          <Field label={t("form.phone_label")} error={errors.phone}>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              placeholder={t("form.phone_placeholder")}
              inputMode="tel"
              dir="ltr"
            />
          </Field>
          <Field label={t("form.wilaya_label")} error={errors.wilayaId}>
            <Select
              value={wilayaId}
              onChange={(event) => {
                pendingCommuneIdRef.current = null;
                setWilayaId(event.currentTarget.value);
              }}
            >
              <option value="">{t("form.wilaya_placeholder")}</option>
              {wilayas.map((wilaya) => (
                <option key={wilaya.id} value={wilaya.id}>
                  {locale === "ar" ? wilaya.nameAr : wilaya.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("form.commune_label")} error={errors.communeId}>
            <Select
              value={communeId}
              onChange={(event) => setCommuneId(event.currentTarget.value)}
              disabled={!wilayaId}
            >
              <option value="">{t("form.commune_placeholder")}</option>
              {communes.map((commune) => (
                <option key={commune.id} value={commune.id}>
                  {locale === "ar" ? commune.nameAr : commune.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label={
            deliveryType === "home"
              ? `${t("form.address_label")} *`
              : t("form.address_label")
          }
          error={errors.address}
        >
          <Textarea
            value={address}
            onChange={(event) => setAddress(event.currentTarget.value)}
            placeholder={t("form.address_placeholder")}
          />
        </Field>
      </div>
    </Card>
  );
}
