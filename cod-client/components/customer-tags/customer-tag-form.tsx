"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, Paintbrush, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useCustomerTags } from "@/lib/translations";
import { createCustomerTag, updateCustomerTag } from "@/actions/customer-tags";
import type { CustomerTag } from "@/types";

const PRESET_COLORS = [
  "#64748b", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

interface Props {
  mode: "create" | "edit";
  tag?: CustomerTag;
}

export function CustomerTagForm({ mode, tag }: Props) {
  const t = useCustomerTags();
  const router = useRouter();
  const locale = useErrorLocale();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "#64748b");

  const backHref = mode === "edit" && tag ? `/customer-tags/${tag.id}` : "/customer-tags";

  function handleSave() {
    if (!name.trim()) {
      showErrorToast(t.form.error_required, locale);
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          const created = await createCustomerTag({ name: name.trim(), color });
          showSuccessToast(t.form.success_add, locale);
          router.push(`/customer-tags/${created.id}`);
        } else if (tag) {
          await updateCustomerTag(tag.id, { name: name.trim(), color });
          showSuccessToast(t.form.success_edit, locale);
          router.push(`/customer-tags/${tag.id}`);
        }
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : t.form.error_required, locale);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-end gap-2.5 sm:gap-3">
        <div className="hidden lg:flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
          >
            {isPending ? "..." : <><Save size={14} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Info Section */}
        <Section title={mode === "create" ? t.form.title_add : t.form.title_edit} icon={<Tag size={18} />}>
          <Field label={`${t.form.name_label} *`}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.form.name_placeholder}
              className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
              disabled={isPending}
              dir="rtl"
            />
          </Field>
        </Section>

        {/* Color Section */}
        <Section title={t.form.color_label} icon={<Paintbrush size={18} />}>
          <div className="space-y-5">
            {/* Live preview */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-border/20">
              <span
                className="px-3.5 py-1.5 rounded-full text-sm font-black text-white shrink-0 transition-all"
                style={{ backgroundColor: color }}
              >
                {name || t.form.name_placeholder}
              </span>
              <p className="text-[10px] font-mono text-muted-foreground/50">{color}</p>
            </div>

            {/* Preset swatches */}
            <Field label={t.form.color_label}>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    disabled={isPending}
                    className="w-9 h-9 rounded-xl transition-all active:scale-90 disabled:opacity-50"
                    style={{
                      backgroundColor: c,
                      boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                    }}
                  />
                ))}
                {/* Custom picker */}
                <label className="w-9 h-9 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors overflow-hidden relative">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <span className="text-[10px] font-black text-muted-foreground/50 pointer-events-none">+</span>
                </label>
              </div>
            </Field>
          </div>
        </Section>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(backHref)}
            disabled={isPending}
            className="flex-none w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground transition-all active:scale-90 shadow-sm"
          >
            <X size={20} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-12 sm:h-14 rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
          >
            {isPending ? "..." : <><Save size={16} className="me-2" /> {t.form.save}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl sm:rounded-[2rem] border-border/30 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 border-b border-border/10 bg-muted/5">
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <div className="text-primary scale-90 sm:scale-100">{icon}</div>
          </div>
        )}
        <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight font-display uppercase">{title}</h2>
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1">{label}</Label>
      {children}
    </div>
  );
}
