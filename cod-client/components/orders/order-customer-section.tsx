"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Customer, Wilaya, Commune } from "@/types";
import { useOrders } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { CustomerSearchSelect } from "./customer-search-select";

interface OrderCustomerSectionProps {
  customers: Customer[];
  wilayas: Wilaya[];
  selectedCustomer: Customer | null;
  customerName: string;
  phone: string;
  wilayaId: number | null;
  wilayaNameAr: string;
  commune: string;
  communes: Commune[];
  loadingCommunes: boolean;
  address: string;
  deliveryType: "home" | "stop_desk";
  onCustomerSelect: (customer: Customer) => void;
  onCustomerClear: () => void;
  onCustomerNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onWilayaChange: (wilayaId: number, nameAr: string) => void;
  onCommuneChange: (name: string) => void;
  onAddressChange: (value: string) => void;
}

/**
 * OrderCustomerSection Component
 *
 * Handles customer information input for order forms.
 * Includes customer search, name, phone, wilaya, commune, and address fields.
 */
export function OrderCustomerSection({
  customers,
  wilayas,
  selectedCustomer,
  customerName,
  phone,
  wilayaId,
  wilayaNameAr,
  commune,
  communes,
  loadingCommunes,
  address,
  deliveryType,
  onCustomerSelect,
  onCustomerClear,
  onCustomerNameChange,
  onPhoneChange,
  onWilayaChange,
  onCommuneChange,
  onAddressChange,
}: OrderCustomerSectionProps) {
  const t = useOrders();
  const { dir } = useLanguage();

  return (
    <div className="space-y-4">
      <h3 className="text-base font-black text-foreground">
        {t.form.customer_section}
      </h3>

      {/* Customer Search */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {t.form.search_customer}
        </Label>
        <CustomerSearchSelect
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelect={onCustomerSelect}
          onClear={onCustomerClear}
        />
      </div>

      {/* Customer Name */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {t.form.customer_name_label}
        </Label>
        <Input
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder={t.form.customer_name_placeholder}
          className="h-11 bg-muted border-border text-foreground text-base"
          dir={dir}
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {t.form.phone_label}
        </Label>
        <Input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder={t.form.phone_placeholder}
          className="h-11 bg-muted border-border text-foreground text-base"
          type="tel"
        />
      </div>

      {/* Wilaya */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {t.form.wilaya_label}
        </Label>
        <Select
          value={wilayaId ? String(wilayaId) : ""}
          onValueChange={(v) => {
            if (!v) return;
            const id = parseInt(v, 10);
            if (!isNaN(id)) {
              const w = wilayas.find((x) => x.id === id);
              if (w) onWilayaChange(w.id, w.nameAr);
            }
          }}
        >
          <SelectTrigger className="h-11 bg-muted border-border text-foreground font-semibold text-base">
            {wilayaNameAr ? (
              <span className="font-bold">{wilayaNameAr}</span>
            ) : (
              <span className="text-muted-foreground">{t.form.wilaya_placeholder}</span>
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-64">
            {wilayas.length > 0
              ? wilayas.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)} className="font-semibold text-base py-3">
                    {w.nameAr}
                  </SelectItem>
                ))
              : null}
          </SelectContent>
        </Select>
      </div>

      {/* Commune */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {t.form.commune_label}
        </Label>
        <Select
          value={commune}
          onValueChange={(v) => onCommuneChange(v ?? "")}
          disabled={!wilayaId || loadingCommunes}
        >
          <SelectTrigger className="h-11 bg-muted border-border text-foreground font-semibold text-base">
            {commune ? (
              <span className="font-bold">
                {communes.find((c) => c.id === commune)?.nameAr ?? commune}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {loadingCommunes ? t.form.commune_loading : t.form.commune_placeholder}
              </span>
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-64">
            {communes.map((c) => (
              <SelectItem key={c.id} value={c.id} className="font-semibold text-base py-3">
                {c.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Address — required for home delivery */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground font-bold">
          {deliveryType === "home" ? `${t.form.address_label} *` : t.form.address_label}
        </Label>
        <Textarea
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={t.form.address_placeholder}
          rows={2}
          className="bg-muted border-border text-foreground resize-none text-base"
          dir={dir}
        />
      </div>
    </div>
  );
}
