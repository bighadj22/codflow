"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Truck, UserPlus, Info, Save, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { createDriver, updateDriver } from "@/actions/drivers";
import type { Driver } from "@/types";
import { useDelivery, useNavigation } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { createDriverFormSchema, type DriverFormErrors } from "@/validations/drivers";

interface Props {
  driver?: Driver | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  vehicleType: string;
  notes: string;
}

function getInitialForm(driver?: Driver | null): FormState {
  return {
    firstName: driver?.firstName ?? "",
    lastName: driver?.lastName ?? "",
    phone: driver?.phone ?? "",
    phone2: driver?.phone2 ?? "",
    vehicleType: driver?.vehicleType ?? "",
    notes: driver?.notes ?? "",
  };
}

export function DriverFormPage({ driver }: Props) {
  const router = useRouter();
  const t = useDelivery();
  const nav = useNavigation();
  const { dir } = useLanguage();
  const locale = useErrorLocale();
  const isEdit = !!driver;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(getInitialForm(driver));
  const [errors, setErrors] = useState<DriverFormErrors>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the error for this field as the user types
    if (errors[key as keyof DriverFormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleSave() {
    const parsed = createDriverFormSchema(locale).safeParse({
      ...form,
      phone2: form.phone2.trim() || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: DriverFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof DriverFormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        const payload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          phone2: form.phone2.trim() || null,
          vehicleType: (form.vehicleType as "motorcycle" | "car" | "van") || null,
          notes: form.notes.trim() || null,
        };

        if (isEdit && driver) {
          await updateDriver(driver.id, payload);
          showSuccessToast(t.driver_form.success_edit, locale);
          router.push(`/delivery/drivers/${driver.id}`);
        } else {
          await createDriver(payload);
          showSuccessToast(t.driver_form.success_add, locale);
          router.push("/delivery");
        }
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : t.driver_form.error_required, locale);
      }
    });
  }

  const backHref = isEdit ? `/delivery/drivers/${driver!.id}` : "/delivery";
  const pageTitle = isEdit ? t.driver_form.title_edit : t.driver_form.title_add;

  return (
    <div className="max-w-3xl mx-auto pb-48 md:pb-12 animate-fade-in pt-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column - Main Info */}
        <div className="md:col-span-8 space-y-6">
          {/* Personal Info Card */}
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-8 py-6 border-b border-border/10 bg-muted/5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                <UserPlus size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground tracking-tight font-display">{t.driver_form.personal_info_label}</h2>
                <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Identity & Contact</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.15em] ml-1">
                    {t.driver_form.first_name_label}
                  </Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    placeholder={t.driver_form.first_name_placeholder}
                    className="h-12 bg-muted/20 border-border/40 rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                    disabled={isPending}
                  />
                  {errors.firstName && (
                    <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                      <AlertCircle size={11} />
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.15em] ml-1">
                    {t.driver_form.last_name_label}
                  </Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    placeholder={t.driver_form.last_name_placeholder}
                    className="h-12 bg-muted/20 border-border/40 rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                    disabled={isPending}
                  />
                  {errors.lastName && (
                    <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                      <AlertCircle size={11} />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.15em] ml-1">
                    {t.driver_form.phone_label}
                  </Label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="0XXXXXXXXX"
                      className="h-12 bg-muted/20 border-border/40 rounded-2xl pl-11 pr-4 text-sm font-bold font-mono tracking-wider focus:ring-primary/20 focus:border-primary/30 transition-all"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      disabled={isPending}
                    />
                  </div>
                  {errors.phone && (
                    <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                      <AlertCircle size={11} />
                      {errors.phone}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.15em] ml-1">
                    {t.driver_form.phone2_label}
                  </Label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      value={form.phone2}
                      onChange={(e) => set("phone2", e.target.value)}
                      placeholder="0XXXXXXXXX (Optional)"
                      className="h-12 bg-muted/20 border-border/40 rounded-2xl pl-11 pr-4 text-sm font-bold font-mono tracking-wider focus:ring-primary/20 focus:border-primary/30 transition-all"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      disabled={isPending}
                    />
                  </div>
                  {errors.phone2 && (
                    <p className="flex items-center gap-1 text-xs text-destructive mt-1 ms-1 font-bold">
                      <AlertCircle size={11} />
                      {errors.phone2}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-8 py-5 border-b border-border/10 bg-muted/5">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Info size={16} className="text-muted-foreground" />
              </div>
              <h2 className="text-sm font-black text-foreground tracking-tight uppercase tracking-widest">{t.driver_form.notes_label}</h2>
            </div>
            <div className="p-8">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={t.driver_form.notes_placeholder}
                className="bg-muted/20 border-border/40 rounded-[1.5rem] p-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all min-h-[120px] resize-none"
                disabled={isPending}
                dir={dir}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Logistics & Settings */}
        <div className="md:col-span-4 space-y-6">
          {/* Logistics Info Card */}
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden shadow-sm">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-primary" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Logistics</span>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.15em] ml-1">
                    {t.driver_form.vehicle_label}
                  </Label>
                  <Select
                    value={form.vehicleType}
                    onValueChange={(v) => set("vehicleType", v ?? "")}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-12 bg-muted/20 border-border/40 rounded-2xl px-4 text-sm font-bold focus:ring-primary/20">
                      <SelectValue placeholder={t.driver_form.vehicle_placeholder} />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border/20 rounded-2xl overflow-hidden shadow-2xl">
                      <SelectItem value="motorcycle" className="font-bold py-3 focus:bg-primary/10">
                        {t.vehicle_type.motorcycle}
                      </SelectItem>
                      <SelectItem value="car" className="font-bold py-3 focus:bg-primary/10">
                        {t.vehicle_type.car}
                      </SelectItem>
                      <SelectItem value="van" className="font-bold py-3 focus:bg-primary/10">
                        {t.vehicle_type.van}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isEdit && (
                <div className="pt-6 border-t border-border/10">
                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider leading-relaxed">
                    {(t.driver_form as unknown as Record<string, string>).compensations_hint ?? "Per-wilaya delivery fees are managed from the driver's detail page."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex flex-col gap-3">
            <Button 
              onClick={handleSave} 
              disabled={isPending} 
              className="h-14 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
            >
              {isPending ? t.driver_form.saving : <><Save size={18} className="me-2" /> {t.driver_form.save}</>}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push(backHref)} 
              disabled={isPending} 
              className="h-14 rounded-3xl border-border/40 bg-white/50 dark:bg-muted/20 hover:bg-muted/50 font-black text-[13px] uppercase tracking-[0.2em] active:scale-95 transition-all"
            >
              <X size={18} className="me-2" /> {t.driver_form.cancel}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky action bar — Clears the floating Mobile Nav ───────────── */}
      <div className="fixed bottom-[96px] inset-x-4 z-40 md:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-3xl p-3 shadow-2xl flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(backHref)}
            disabled={isPending}
            className="flex-none w-14 h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-foreground transition-all active:scale-90"
          >
            <X size={20} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
          >
            {isPending ? t.driver_form.saving : <><Save size={18} className="me-2" /> {t.driver_form.save}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
