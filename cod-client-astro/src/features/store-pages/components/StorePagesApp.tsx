import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  ChevronRight,
  FilePlus,
  Loader2,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { RequireAuth, canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Alert, Button, PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { getMyStore } from "@/features/settings/api";
import {
  getStoreLegalProfile,
  listStorePages,
  seedStoreDefaultPages,
} from "@/features/store-pages/api";
import { pageNeedsReview, storePagesErrorMessage } from "@/features/store-pages/model";
import type { PageLocale, StoreLegalProfile, StorePageSummary } from "@/features/store-pages/types";
import { notify } from "@/lib/notify";
import { PageList } from "@/features/store-pages/components/PageList";
import { PageEditor } from "@/features/store-pages/components/PageEditor";
import { NewCustomPageDialog } from "@/features/store-pages/components/NewCustomPageDialog";
import { LegalProfileCard } from "@/features/store-pages/components/LegalProfileCard";

type ActiveTab = "pages" | "business_details";

function StorePagesContent() {
  const t = useT("store-pages");
  const common = useT("common");
  const identity = useIdentity();
  const canManage = canScope(identity, SCOPES.STORE_PAGES_MANAGE);

  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");
  const [storeLang, setStoreLang] = useState<PageLocale | null>(null);
  const [storefrontBaseUrl, setStorefrontBaseUrl] = useState("");
  const [pages, setPages] = useState<StorePageSummary[] | null>(null);
  const [legalProfile, setLegalProfile] = useState<StoreLegalProfile | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  async function load() {
    setLoadError(null);
    try {
      const [store, pageList, profile] = await Promise.all([
        getMyStore(),
        listStorePages(),
        getStoreLegalProfile(),
      ]);
      setStoreLang(store.lang as PageLocale);
      setStorefrontBaseUrl(store.domain ? `https://${store.domain}` : "");
      setPages(pageList);
      setLegalProfile(profile);
      setSelectedId((current) => current ?? pageList[0]?.id ?? null);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSeedDefaults() {
    try {
      const result = await seedStoreDefaultPages();
      if (result.created.length > 0) {
        notify.success(t("list.seeded_toast").replace("{count}", String(result.created.length)));
      }
      await load();
    } catch (cause) {
      notify.error(storePagesErrorMessage(cause, t));
    }
  }

  function handlePageChanged() {
    void load();
  }

  function handlePageDeleted(pageId: string) {
    setPages((current) => current?.filter((p) => p.id !== pageId) ?? current);
    setSelectedId((current) => (current === pageId ? null : current));
  }

  function handlePageCreated(page: { id: string }) {
    setShowNewDialog(false);
    setSelectedId(page.id);
    void load();
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("errors.load_failed")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  }

  if (pages === null || storeLang === null) {
    return (
      <div role="status" aria-busy="true" className="flex min-h-60 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const legalPages = pages.filter((p) => p.kind !== "custom");
  const needsReviewCount = legalPages.filter(pageNeedsReview).length;
  const isProfileIncomplete = Boolean(
    !legalProfile?.contactEmail?.trim() && !legalProfile?.contactPhone?.trim(),
  );

  return (
    <div className="space-y-6">
      {/* Top Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border/80 pb-px">
        <div className="flex gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("pages")}
            className={`group relative flex items-center gap-2 pb-3 pt-1 text-sm font-semibold transition-colors select-none ${
              activeTab === "pages"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck size={16} className={activeTab === "pages" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
            <span>{t("tabs.pages")}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                activeTab === "pages"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {pages.length}
            </span>
            {activeTab === "pages" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("business_details")}
            className={`group relative flex items-center gap-2 pb-3 pt-1 text-sm font-semibold transition-colors select-none ${
              activeTab === "business_details"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 size={16} className={activeTab === "business_details" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
            <span>{t("tabs.business_details")}</span>
            {isProfileIncomplete && (
              <span
                className="size-2 rounded-full bg-amber-500"
                title={t("legal_profile.incomplete_banner")}
              />
            )}
            {activeTab === "business_details" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {activeTab === "pages" && canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewDialog(true)}
            className="gap-1.5 text-xs font-semibold shadow-2xs mb-2"
          >
            <FilePlus size={14} />
            <span>{t("list.new_page")}</span>
          </Button>
        )}
      </div>

      {/* Tab 1: Policies & Pages */}
      {activeTab === "pages" && (
        <div className="space-y-6">
          {/* Compliance Banner — one line: what this is, review status, way in */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 shadow-xs">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-card text-primary shadow-2xs">
                <Scale size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-foreground">
                  {t("compliance.badge")}
                </h3>
                <p
                  className={`text-xs ${
                    needsReviewCount === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {needsReviewCount === 0
                    ? t("compliance.all_reviewed")
                    : t("compliance.needs_review_count").replace("{count}", String(needsReviewCount))}
                </p>
              </div>
            </div>

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("business_details")}
                className="gap-1.5 text-xs font-semibold shadow-2xs"
              >
                <span>{t("compliance.configure_profile")}</span>
                <ChevronRight size={13} />
              </Button>
            )}
          </div>

          {/* Master-Detail Grid */}
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <PageList
              pages={pages}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSeedDefaults={() => void handleSeedDefaults()}
              onOpenBusinessDetails={() => setActiveTab("business_details")}
            />
            <div className="min-w-0">
              {selectedId ? (
                <PageEditor
                  key={selectedId}
                  pageId={selectedId}
                  storeLang={storeLang}
                  storefrontBaseUrl={storefrontBaseUrl}
                  onChanged={handlePageChanged}
                  onDeleted={handlePageDeleted}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Business Details */}
      {activeTab === "business_details" && (
        <LegalProfileCard
          profile={legalProfile}
          onSaved={setLegalProfile}
          onBackToPages={() => setActiveTab("pages")}
        />
      )}

      {showNewDialog && (
        <NewCustomPageDialog
          storeLang={storeLang}
          onClose={() => setShowNewDialog(false)}
          onCreated={handlePageCreated}
        />
      )}
    </div>
  );
}

function Gated() {
  const t = useT("store-pages");
  return (
    <DashboardChrome currentPath="/pages" wide>
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} />
      <StorePagesContent />
    </DashboardChrome>
  );
}

export default function StorePagesApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
