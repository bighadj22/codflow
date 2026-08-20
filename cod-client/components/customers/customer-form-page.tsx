"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, MapPin, Phone, Info, Save, X, Settings2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/actions/customers";
import { getCommunes } from "@/actions/wilayas";
import { useCustomers } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import type { Customer } from "@/types";
import type { Wilaya, Commune } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  customer?: Customer | null;
  wilayas: Wilaya[];
}

interface FormState {
  name: string;
  phone: string;
  phone2: string;
  wilayaId: number | null;
  wilayaName: string;
  commune: string;
  address: string;
}

function getInitialForm(customer?: Customer | null, wilayas?: Wilaya[]): FormState {
  let wilayaId: number | null = customer?.wilayaId ?? null;
  let wilayaName = customer?.wilaya ?? "";

  // Fallback: derive wilayaId from text name if not stored as ID yet
  if (!wilayaId && customer?.wilaya && wilayas) {
    const matched = wilayas.find(
      (w) => w.nameAr === customer.wilaya || w.name === customer.wilaya
    );
    if (matched) {
      wilayaId = matched.id;
      wilayaName = matched.nameAr ?? matched.name;
    }
  }

  return {
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    phone2: customer?.phone2 ?? "",
    wilayaId,
    wilayaName,
    commune: customer?.communeId ?? "",
    address: customer?.address ?? "",
  };
}

export function CustomerFormPage({ customer, wilayas }: Props) {
  const router = useRouter();
  const t = useCustomers();
  const { dir } = useLanguage();
  const isEdit = !!customer;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => getInitialForm(customer, wilayas));
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [communesLoading, setCommunesLoading] = useState(false);

  // Load communes when wilayaId changes
  useEffect(() => {
    if (!form.wilayaId) {
      setCommunes([]);
      return;
    }
    setCommunesLoading(true);
    getCommunes(form.wilayaId)
      .then(setCommunes)
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false));
  }, [form.wilayaId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleWilayaChange(wilayaIdStr: string | null) {
    if (!wilayaIdStr) {
      set("wilayaId", null);
      set("wilayaName", "");
      set("commune", "");
      return;
    }
    const id = Number(wilayaIdStr);
    const w = wilayas.find((w) => w.id === id);
    setForm((prev) => ({
      ...prev,
      wilayaId: id,
      wilayaName: w?.nameAr ?? w?.name ?? "",
      commune: "",
    }));
  }

  function handleSave() {
    if (!form.name.trim() || !form.phone.trim() || !form.wilayaId) {
      toast.error(t.form.error_required ?? "يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (!form.commune) {
      toast.error(t.form.error_commune_required ?? "يرجى اختيار البلدية");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          phone2: form.phone2.trim() || null,
          wilayaId: form.wilayaId!,
          communeId: form.commune,
          address: form.address.trim() || undefined,
        };

        if (isEdit && customer) {
          await updateCustomer(customer.id, payload);
          toast.success(t.form.success_edit);
          router.push(`/customers/${customer.id}`);
        } else {
          const created = await createCustomer(payload);
          toast.success(t.form.success_add);
          router.push(`/customers/${created.id}`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.form.error_required ?? "حدث خطأ");
      }
    });
  }

  const backHref = isEdit ? `/customers/${customer!.id}` : "/customers";
  const pageTitle = isEdit ? t.form.title_edit : t.form.title_add;

  return (
    <div className="max-w-2xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header & Back Action */}
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
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Personal Info Section */}
        <Section title={t.form.title_add} icon={<User size={18} />}>
          <div className="space-y-5">
            <Field label={`${t.form.name_label} *`}>
              <Input 
                value={form.name} 
                onChange={(e) => set("name", e.target.value)} 
                placeholder={t.form.name_placeholder} 
                className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all" 
                disabled={isPending} 
                dir={dir}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`${t.form.phone_label} *`}>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <Input 
                    value={form.phone} 
                    onChange={(e) => set("phone", e.target.value)} 
                    placeholder={t.form.phone_placeholder} 
                    className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl pl-11 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all" 
                    type="tel"
                    dir="ltr"
                    disabled={isPending} 
                  />
                </div>
              </Field>
              <Field label={t.form.phone2_label}>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <Input 
                    value={form.phone2} 
                    onChange={(e) => set("phone2", e.target.value)} 
                    placeholder={t.form.phone2_placeholder} 
                    className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl pl-11 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all" 
                    type="tel"
                    dir="ltr"
                    disabled={isPending} 
                  />
                </div>
              </Field>
            </div>
          </div>
        </Section>

        {/* Location Section */}
        <Section title={t.form.wilaya_label} icon={<Globe size={18} />}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`${t.form.wilaya_label} *`}>
                <Select
                  value={form.wilayaId ? String(form.wilayaId) : ""}
                  onValueChange={(v) => handleWilayaChange(v ?? null)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all">
                    {form.wilayaName ? (
                      <span className="font-bold">{form.wilayaName}</span>
                    ) : (
                      <span className="text-muted-foreground">{t.form.wilaya_placeholder}</span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="glass-card rounded-2xl max-h-64">
                    {wilayas.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)} className="font-bold text-sm py-2.5">
                        {w.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={`${t.form.commune_label} *`}>
                <Select
                  value={form.commune}
                  onValueChange={(v) => set("commune", v ?? "")}
                  disabled={isPending || !form.wilayaId || communesLoading}
                >
                  <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all">
                    {form.commune ? (
                      <span className="font-bold">
                        {communes.find((c) => c.id === form.commune)?.nameAr ?? form.commune}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {communesLoading
                          ? (t.form.commune_loading ?? "جاري التحميل...")
                          : (t.form.commune_placeholder ?? "اختر البلدية")}
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="glass-card rounded-2xl max-h-64">
                    {communes.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="font-bold text-sm py-2.5">
                        {c.nameAr || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={t.form.address_label}>
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <Input 
                  value={form.address} 
                  onChange={(e) => set("address", e.target.value)} 
                  placeholder={t.form.address_placeholder} 
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl pl-11 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all" 
                  disabled={isPending} 
                  dir={dir}
                />
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
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ml-1">{label}</Label>
      {children}
    </div>
  );
}
