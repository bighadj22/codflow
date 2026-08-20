"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, Settings2, Globe, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useProductGroups } from "@/lib/translations";
import { createProductGroup, updateProductGroup } from "@/actions/product-groups";
import { CategoryImageUploader } from "./category-image-uploader";
import type { ProductCategory } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  group?: ProductCategory;
  allGroups: ProductCategory[];
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function ProductGroupForm({ group, allGroups }: Props) {
  const router = useRouter();
  const t = useProductGroups();
  const locale = useErrorLocale();
  const isEdit = !!group;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(group?.name ?? "");
  const [slug, setSlug] = useState(group?.slug ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [parentId, setParentId] = useState(group?.parentId ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(group?.imageUrl ?? null);
  const [metaTitle, setMetaTitle] = useState(group?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(group?.metaDescription ?? "");
  const [metaKeywords, setMetaKeywords] = useState(group?.metaKeywords ?? "");

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEdit && name) setSlug(toSlug(name));
  }, [name, isEdit]);

  async function handleSave() {
    if (!name.trim()) {
      showErrorToast(t.form.error_name_required, locale);
      return;
    }
    startTransition(async () => {
      try {
        const data = {
          name,
          slug: slug || toSlug(name),
          description: description || undefined,
          parentId: parentId || undefined,
          imageUrl: imageUrl || undefined,
          metaTitle: metaTitle || undefined,
          metaDescription: metaDescription || undefined,
          metaKeywords: metaKeywords || undefined,
        };
        if (isEdit && group) {
          await updateProductGroup(group.id, data);
          showSuccessToast(t.form.success_edit, locale);
        } else {
          await createProductGroup(data);
          showSuccessToast(t.form.success_add, locale);
        }
        router.push("/product-groups");
      } catch (e) {
        showErrorToast(e instanceof Error ? e.message : t.form.error_save_failed, locale);
      }
    });
  }

  // Filter out the group itself to prevent circular parent
  const parentOptions = allGroups.filter((g) => g.id !== group?.id);

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
          href="/product-groups"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Basic Info */}
        <Section title={t.form.title_add} icon={<Settings2 size={18} />}>
          <div className="space-y-5">
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

            <Field label={t.form.slug_label}>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                dir="ltr"
                className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 font-mono text-[13px] font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                disabled={isPending}
              />
            </Field>

            <Field label={t.form.parent_label}>
              <Select value={parentId} onValueChange={(v) => setParentId(v ?? "")}>
                <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold" disabled={isPending}>
                  <SelectValue placeholder={t.form.parent_placeholder} />
                </SelectTrigger>
                <SelectContent className="glass-card rounded-2xl">
                  <SelectItem value="">{t.form.parent_placeholder}</SelectItem>
                  {parentOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t.form.description_label}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl p-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all min-h-[120px] resize-none"
                disabled={isPending}
                dir="rtl"
              />
            </Field>
          </div>
        </Section>

        {/* Image */}
        <Section title={t.form.section_image ?? "Image"} icon={<ImageIcon size={18} />}>
          <Field label={t.form.image_label}>
            <CategoryImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t.form.image_help ?? "Upload an image to represent this category in the store"}
            </p>
          </Field>
        </Section>

        {/* SEO */}
        <Section title={t.form.section_seo ?? "SEO Settings"} icon={<Globe size={18} />}>
          <div className="space-y-5">
            <Field label={t.form.meta_title_label ?? "Meta Title"}>
              <div className="space-y-1.5">
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={t.form.meta_title_placeholder ?? "SEO title for search engines"}
                  maxLength={60}
                  className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                  disabled={isPending}
                  dir="rtl"
                />
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">
                    {t.form.meta_title_help ?? "Recommended: 50-60 characters"}
                  </span>
                  <span className={cn("font-mono font-bold", metaTitle.length > 55 ? "text-amber-500" : "text-muted-foreground")}>
                    {metaTitle.length}/60
                  </span>
                </div>
              </div>
            </Field>

            <Field label={t.form.meta_description_label ?? "Meta Description"}>
              <div className="space-y-1.5">
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={t.form.meta_description_placeholder ?? "Brief description for search results"}
                  maxLength={160}
                  rows={3}
                  className="bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl p-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
                  disabled={isPending}
                  dir="rtl"
                />
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">
                    {t.form.meta_description_help ?? "Recommended: 150-160 characters"}
                  </span>
                  <span className={cn("font-mono font-bold", metaDescription.length > 150 ? "text-amber-500" : "text-muted-foreground")}>
                    {metaDescription.length}/160
                  </span>
                </div>
              </div>
            </Field>

            <Field label={t.form.meta_keywords_label ?? "Meta Keywords"}>
              <Input
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                placeholder={t.form.meta_keywords_placeholder ?? "keyword1, keyword2, keyword3"}
                className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                disabled={isPending}
                dir="rtl"
              />
              <p className="text-xs text-muted-foreground mt-1.5 px-1">
                {t.form.meta_keywords_help ?? "Comma-separated keywords for search engines"}
              </p>
            </Field>
          </div>
        </Section>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/product-groups")}
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
