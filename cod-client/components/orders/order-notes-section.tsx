"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrders } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";

interface OrderNotesSectionProps {
  notes: string;
  onNotesChange: (value: string) => void;
}

/**
 * OrderNotesSection Component
 * 
 * Simple notes textarea for order forms.
 */
export function OrderNotesSection({ notes, onNotesChange }: OrderNotesSectionProps) {
  const t = useOrders();
  const { dir } = useLanguage();

  return (
    <div className="space-y-2">
      <Label className="text-sm text-foreground font-bold">
        {t.form.notes_label}
      </Label>
      <Textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
        className="bg-muted border-border text-foreground resize-none text-base"
        dir={dir}
      />
    </div>
  );
}
