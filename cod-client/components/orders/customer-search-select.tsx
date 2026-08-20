"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Customer } from "@/types";
import { useOrders } from "@/lib/translations";

interface Props {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  selectedCustomer: Customer | null;
  onClear: () => void;
}

export function CustomerSearchSelect({ customers, onSelect, selectedCustomer, onClear }: Props) {
  const t = useOrders();

  function handleValueChange(customerId: string | null) {
    if (!customerId) return;
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      onSelect(customer);
    }
  }

  return (
    <div className="flex gap-2">
      <Select
        value={selectedCustomer?.id || ""}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="h-11 bg-muted border-border text-foreground font-semibold text-base flex-1">
          {selectedCustomer ? (
            <span className="truncate font-bold">{selectedCustomer.name}</span>
          ) : (
            <span className="text-muted-foreground">{t.form.search_customer}</span>
          )}
        </SelectTrigger>
        <SelectContent className="bg-popover border-border max-h-64">
          {customers.map((customer) => (
            <SelectItem
              key={customer.id}
              value={customer.id}
              className="font-semibold text-base py-3"
            >
              <span className="font-bold">{customer.name}</span>
              <span className="text-xs text-muted-foreground ms-2">
                {customer.phone} · {customer.wilaya}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedCustomer && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          className="h-11 w-11 p-0 border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
}
