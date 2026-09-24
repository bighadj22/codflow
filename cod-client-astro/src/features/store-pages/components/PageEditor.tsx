import { lazy, Suspense, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { RICH_TEXT_MAX_CHARS } from "../../../../../cod-shared/lib/rich-text";
import {
  isValidPageSlug,
  orderedLocales,
  pageKindLabelKey,
  localeLabelKey,
  storePagesErrorMessage,
} from "@/features/store-pages/model";
import {
  deleteStorePage,
  getStorePage,
  resetStorePageTranslation,
  saveStorePageTranslation,
  updateStorePage,
} from "@/features/store-pages/api";
import type { PageLocale, StorePageDetail, StorePageKind } from "@/features/store-pages/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  StickyFormActions,
  useConfirmDialog,
} from "@/components/ui";

const PageBodyEditor = lazy(() => import("./PageBodyEditor"));

interface PageEditorProps {
  pageId: string;
  storeLang: PageLocale;
  storefrontBaseUrl: string;
  onChanged: (page: StorePageDetail) => void;
  onDeleted: (pageId: string) => void;
}

interface DraftState {
  title: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
}

const KIND_ICONS: Record<StorePageKind, LucideIcon> = {
  terms: Scale,
  privacy: ShieldCheck,
  refund: RotateCcw,
  shipping: Truck,
  custom: Globe,
};

function draftFromPage(page: StorePageDetail, locale: PageLocale): DraftState {
  const body = page.bodies[locale];
  return {
    title: body?.title ?? "",
    bodyHtml: body?.bodyHtml ?? "",
    metaTitle: body?.metaTitle ?? "",
    metaDescription: body?.metaDescription ?? "",
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function PageEditor({
  pageId,
  storeLang,
  storefrontBaseUrl,
  onChanged,
  onDeleted,
}: PageEditorProps) {
  const t = useT("store-pages");
  const common = useT("common");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const canManage = canScope(identity, SCOPES.STORE_PAGES_MANAGE);

  const [page, setPage] = useState<StorePageDetail | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [locale, setLocale] = useState<PageLocale>(storeLang);
  const [drafts, setDrafts] = useState<Record<PageLocale, DraftState>>({
    ar: { title: "", bodyHtml: "", metaTitle: "", metaDescription: "" },
    en: { title: "", bodyHtml: "", metaTitle: "", metaDescription: "" },
    fr: { title: "", bodyHtml: "", metaTitle: "", metaDescription: "" },
  });

  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [showInFooter, setShowInFooter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showSeoEditor, setShowSeoEditor] = useState(false);

  useEffect(() => {
    setPage(null);
    setLoadError(null);
    setLocale(storeLang);
    setCopied(false);
    setShowSeoEditor(false);

    void (async () => {
      try {
        const detail = await getStorePage(pageId);
        setPage(detail);
        setSlug(detail.slug);
        setStatus(detail.status);
        setShowInFooter(detail.showInFooter);

        const initialDrafts: Record<PageLocale, DraftState> = {
          ar: draftFromPage(detail, "ar"),
          en: draftFromPage(detail, "en"),
          fr: draftFromPage(detail, "fr"),
        };
        setDrafts(initialDrafts);
      } catch (cause) {
        setLoadError(cause);
      }
    })();
  }, [pageId, storeLang]);

  const currentDraft = drafts[locale];

  function updateCurrentDraft(updates: Partial<DraftState>) {
    setDrafts((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], ...updates },
    }));
  }

  function handleCopyUrl() {
    const fullUrl = `${storefrontBaseUrl}/pages/${slug}`;
    void navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    notify.success(t("editor.slug_copied"));
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!page) return;

    const nextErrors: Record<string, string> = {};
    if (!isValidPageSlug(slug)) {
      nextErrors.slug = t("errors.validation");
    }
    if (!currentDraft.title.trim() || !currentDraft.bodyHtml.trim()) {
      nextErrors.body = t("errors.validation");
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      // 1. Update metadata if changed
      const metaChanged =
        slug !== page.slug || status !== page.status || showInFooter !== page.showInFooter;

      if (metaChanged) {
        await updateStorePage(page.id, { slug, status, showInFooter });
      }

      // 2. Save current translation
      await saveStorePageTranslation(page.id, locale, {
        title: currentDraft.title.trim(),
        bodyHtml: currentDraft.bodyHtml,
        metaTitle: currentDraft.metaTitle?.trim() || null,
        metaDescription: currentDraft.metaDescription?.trim() || null,
      });

      const refreshed = await getStorePage(page.id);
      setPage(refreshed);
      setSlug(refreshed.slug);
      setStatus(refreshed.status);
      setShowInFooter(refreshed.showInFooter);
      setDrafts((prev) => ({
        ...prev,
        [locale]: draftFromPage(refreshed, locale),
      }));
      onChanged(refreshed);
      setErrors({});
      notify.success(t("editor.saved_toast"));
    } catch (cause) {
      const message = storePagesErrorMessage(cause, t);
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!page || page.kind === "custom") return;

    const ok = await confirm({
      title: t("editor.reset_confirm_title"),
      description: t("editor.reset_confirm_body").replace("{locale}", t(localeLabelKey(locale))),
      confirmLabel: t("editor.reset_button"),
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await resetStorePageTranslation(page.id, locale);
      const refreshed = await getStorePage(page.id);
      setPage(refreshed);
      setDrafts((prev) => ({
        ...prev,
        [locale]: draftFromPage(refreshed, locale),
      }));
      onChanged(refreshed);
      notify.success(t("editor.reset_toast"));
    } catch (cause) {
      notify.error(storePagesErrorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!page || page.kind !== "custom") return;

    const ok = await confirm({
      title: t("editor.delete_confirm_title"),
      description: t("editor.delete_confirm_body").replace("{title}", currentDraft.title || page.slug),
      confirmLabel: common("delete"),
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await deleteStorePage(page.id);
      notify.success(t("editor.deleted_toast"));
      onDeleted(page.id);
    } catch (cause) {
      notify.error(storePagesErrorMessage(cause, t));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        {t("errors.load_failed")}
      </Alert>
    );
  }

  if (!page) {
    return (
      <div className="space-y-6">
        <div className="h-14 animate-pulse rounded-xl border border-border/60 bg-muted/20" />
        <div className="grid gap-6 lg:grid-cols-12 xl:grid-cols-3">
          <div className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/20 lg:col-span-8 xl:col-span-2" />
          <div className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/20 lg:col-span-4 xl:col-span-1" />
        </div>
      </div>
    );
  }

  const isLegal = page.kind !== "custom";
  const Icon = KIND_ICONS[page.kind] ?? Globe;
  const translationSource = page.bodies[locale]?.source ?? "template";
  const bodyTooLong = currentDraft.bodyHtml.length > RICH_TEXT_MAX_CHARS;
  const publicUrl = `${storefrontBaseUrl}/pages/${slug}`;

  // Live SEO Snippet Calculations (Shopify style)
  const previewTitle = currentDraft.metaTitle.trim() || currentDraft.title.trim() || t(pageKindLabelKey(page.kind));
  const cleanSnippet = stripHtml(currentDraft.bodyHtml);
  const previewDescription =
    currentDraft.metaDescription.trim() ||
    (cleanSnippet ? cleanSnippet.slice(0, 160) + (cleanSnippet.length > 160 ? "..." : "") : "");
  const domainOnly = storefrontBaseUrl ? storefrontBaseUrl.replace(/^https?:\/\//, "") : "store.codflow.store";

  return (
    <div className="space-y-6">
      {/* Top Page Header Bar (Shopify Admin Style) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-2xs">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-foreground">
                {t(pageKindLabelKey(page.kind))}
              </h2>
              <Badge tone={status === "published" ? "success" : "neutral"} size="sm">
                {status === "published" ? t("list.status_published") : t("list.status_draft")}
              </Badge>
              {isLegal && (
                <Badge tone={translationSource === "merchant" ? "success" : "warning"} size="sm">
                  {translationSource === "merchant" ? t("editor.reviewed_badge") : t("editor.template_badge")}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span className="truncate">/pages/{slug}</span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 font-sans text-primary hover:underline underline-offset-2"
                title={t("editor.copy_link")}
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? t("editor.copy_link_done") : t("editor.copy_link")}</span>
              </button>
              {storefrontBaseUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-sans text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                >
                  <span>{t("editor.view_page")}</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="default"
              onClick={() => void handleSave()}
              disabled={busy || bodyTooLong}
              className="gap-2 shadow-xs font-semibold px-4"
            >
              {t("editor.save_button")}
            </Button>
          </div>
        )}
      </div>

      {/* Main 2-Column Grid (Shopify Admin 65% / 35% Proportion) */}
      <div className="grid gap-6 lg:grid-cols-12 xl:grid-cols-3">
        {/* Left Primary Column: Editor + Localizations + SEO */}
        <div className="space-y-6 lg:col-span-8 xl:col-span-2">
          {/* Main Content Card */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
            {/* Language Segmented Control Bar */}
            <div className="border-b border-border/70 bg-muted/20 p-2 sm:px-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-card p-1 border border-border/70 shadow-2xs">
                {orderedLocales(storeLang).map((l) => {
                  const isActive = locale === l;
                  const isStorePrimary = l === storeLang;
                  const bodyState = page.bodies[l]?.source ?? "template";

                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocale(l)}
                      className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-all select-none ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      }`}
                    >
                      <span>{t(localeLabelKey(l))}</span>
                      {isStorePrimary && (
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase tracking-wider ${
                            isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {t("editor.primary_language_badge")}
                        </span>
                      )}
                      {!isActive && (
                        <span
                          className={`size-1.5 rounded-full ${
                            bodyState === "merchant" ? "bg-emerald-500" : "bg-amber-400"
                          }`}
                          title={bodyState === "merchant" ? t("editor.reviewed_badge") : t("editor.template_badge")}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground hidden sm:block">
                {locale === storeLang
                  ? t("editor.body_own_language_hint")
                  : t("editor.body_optional_hint").replace("{locale}", t(localeLabelKey(locale)))}
              </div>
            </div>

            {/* Title & Body Inputs */}
            <div className="p-4 sm:p-6 space-y-5">
              <Field label={t("editor.title_label")} error={errors.title}>
                <Input
                  value={currentDraft.title}
                  onChange={(event) => updateCurrentDraft({ title: event.currentTarget.value })}
                  disabled={busy || !canManage}
                  className="text-base font-semibold py-2.5 h-10 tracking-tight"
                  placeholder="e.g. Politique de confidentialité"
                />
              </Field>

              <Field label={t("editor.body_label")} as="div" error={errors.body}>
                <Suspense
                  fallback={
                    <textarea
                      value={currentDraft.bodyHtml}
                      onChange={(event) => updateCurrentDraft({ bodyHtml: event.currentTarget.value })}
                      rows={14}
                      disabled={busy || !canManage}
                      className="w-full rounded-lg border border-border/80 bg-card p-3.5 text-sm"
                    />
                  }
                >
                  <PageBodyEditor
                    value={currentDraft.bodyHtml}
                    onChange={(html) => updateCurrentDraft({ bodyHtml: html })}
                    disabled={!canManage}
                    busy={busy}
                  />
                </Suspense>
              </Field>
            </div>
          </div>

          {/* Search Engine Listing Preview Card (Signature Shopify Feature) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {t("editor.serp_preview_title")}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("editor.serp_preview_hint")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSeoEditor((v) => !v)}
                className="gap-1.5 text-xs font-semibold"
              >
                <span>{t("editor.edit_seo")}</span>
                {showSeoEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            </div>

            {/* Google SERP Card Preview */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 font-sans space-y-1">
              <div className="text-[12px] text-muted-foreground truncate font-mono">
                https://{domainOnly} › pages › {slug || "page"}
              </div>
              <div className="text-[16px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate">
                {previewTitle}
              </div>
              <div className="text-[13px] text-muted-foreground/90 line-clamp-2 leading-relaxed">
                {previewDescription || "No description provided. Add content to generate a snippet for search engines."}
              </div>
            </div>

            {/* Expanded SEO Fields */}
            {showSeoEditor && (
              <div className="pt-2 border-t border-border/60 grid gap-4 sm:grid-cols-2">
                <Field
                  label={t("editor.meta_title_label")}
                  hint={t("editor.meta_title_hint")}
                >
                  <Input
                    value={currentDraft.metaTitle}
                    onChange={(event) => updateCurrentDraft({ metaTitle: event.currentTarget.value })}
                    disabled={busy || !canManage}
                    placeholder={currentDraft.title || t(pageKindLabelKey(page.kind))}
                  />
                </Field>
                <Field
                  label={t("editor.meta_description_label")}
                  hint={t("editor.meta_desc_hint")}
                >
                  <Input
                    value={currentDraft.metaDescription}
                    onChange={(event) => updateCurrentDraft({ metaDescription: event.currentTarget.value })}
                    disabled={busy || !canManage}
                    placeholder="Short summary for Google search results..."
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Right Secondary Column: Settings & Meta Sidebar */}
        <div className="space-y-6 lg:col-span-4 xl:col-span-1">
          {/* Card 1: Visibility & Navigation */}
          <Card title={t("editor.status_label")}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                  <input
                    type="radio"
                    name="page_status"
                    value="published"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                    disabled={busy || !canManage}
                    className="size-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="text-[13px] font-bold text-foreground">
                      {t("list.status_published")}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Visible to shoppers on your storefront
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                  <input
                    type="radio"
                    name="page_status"
                    value="draft"
                    checked={status === "draft"}
                    onChange={() => setStatus("draft")}
                    disabled={busy || !canManage}
                    className="size-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="text-[13px] font-bold text-foreground">
                      {t("list.status_draft")}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Hidden from shoppers until published
                    </div>
                  </div>
                </label>
              </div>

              {/* Footer Switch */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("editor.show_in_footer_label")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Automatically linked in your store footer
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showInFooter}
                  onClick={() => setShowInFooter((v) => !v)}
                  disabled={busy || !canManage}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                    showInFooter ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      showInFooter ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Card 2: URL Handle Card */}
          <Card title={t("editor.url_card_title")}>
            <div className="space-y-3">
              <Field label={t("editor.slug_label")} error={errors.slug} hint={t("editor.slug_hint")}>
                <div className="flex rounded-lg border border-border/80 bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="inline-flex items-center px-3 bg-muted/40 text-muted-foreground text-xs font-mono border-e border-border/70 select-none">
                    /pages/
                  </span>
                  <input
                    value={slug}
                    onChange={(event) => setSlug(event.currentTarget.value)}
                    dir="ltr"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-transparent outline-none text-foreground"
                    disabled={busy || !canManage}
                  />
                </div>
              </Field>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="flex-1 gap-1.5 text-xs font-semibold"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? t("editor.copy_link_done") : t("editor.copy_link")}</span>
                </Button>
                {storefrontBaseUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center size-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    title={t("editor.view_page")}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </Card>

          {/* Card 3: Legal Policy Template & Actions */}
          {isLegal && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <ShieldCheck size={16} />
                <span>{t("editor.policy_compliance_card_title")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("editor.policy_compliance_card_desc")}
              </p>

              <div className="rounded-lg border border-border/70 bg-card/80 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {translationSource === "merchant" ? t("editor.reviewed_badge") : t("editor.template_badge")}
                  </span>
                  <span
                    className={`size-2 rounded-full ${
                      translationSource === "merchant" ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {translationSource === "template"
                    ? t("editor.template_info_desc")
                    : "You have customized this language. You can restore the original template at any time."}
                </p>
              </div>

              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleReset()}
                  disabled={busy}
                  className="w-full gap-2 text-xs font-semibold border-primary/20 hover:bg-primary/5 hover:text-primary"
                >
                  <RotateCcw size={13} />
                  {t("editor.reset_button")}
                </Button>
              )}
            </div>
          )}

          {/* Card 4: Custom Page Danger Zone */}
          {!isLegal && canManage && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-destructive flex items-center gap-2">
                <Trash2 size={15} />
                <span>Danger Zone</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Permanently delete this custom page from your storefront.
              </p>
              <Button
                variant="dangerOutline"
                size="sm"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="w-full gap-2 text-xs font-semibold"
              >
                <Trash2 size={13} />
                {t("editor.delete_button")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Form Actions (Shopify Pattern) */}
      {canManage && (
        <StickyFormActions
          info={
            <div className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-foreground">
                {t(pageKindLabelKey(page.kind))} · {t(localeLabelKey(locale))}
              </span>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            {isLegal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleReset()}
                disabled={busy}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={13} />
                <span>{t("editor.reset_button")}</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="default"
              onClick={() => void handleSave()}
              disabled={busy || bodyTooLong}
              className="gap-2 font-semibold shadow-xs px-5"
            >
              {t("editor.save_button")}
            </Button>
          </div>
        </StickyFormActions>
      )}
    </div>
  );
}
