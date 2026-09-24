import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  FilePlus,
  FileText,
  RotateCcw,
  Scale,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { orderStorePages, pageKindLabelKey, pageNeedsReview } from "@/features/store-pages/model";
import type { StorePageKind, StorePageSummary } from "@/features/store-pages/types";
import { Badge, Button, EmptyState } from "@/components/ui";

interface PageListProps {
  pages: StorePageSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeedDefaults: () => void;
  onOpenBusinessDetails?: () => void;
}

const KIND_ICONS: Record<StorePageKind, LucideIcon> = {
  terms: Scale,
  privacy: ShieldCheck,
  refund: RotateCcw,
  shipping: Truck,
  custom: FileText,
};

export function PageList({
  pages,
  selectedId,
  onSelect,
  onSeedDefaults,
  onOpenBusinessDetails,
}: PageListProps) {
  const t = useT("store-pages");
  const identity = useIdentity();
  const canManage = canScope(identity, SCOPES.STORE_PAGES_MANAGE);
  const ordered = orderStorePages(pages);

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
        <EmptyState
          icon={<ShieldCheck size={28} className="text-primary" />}
          title={t("list.empty_title")}
          description={t("list.empty_body")}
          action={
            canManage ? (
              <Button variant="primary" size="default" onClick={onSeedDefaults} className="gap-2 shadow-xs">
                <FilePlus size={16} />
                {t("list.seed_defaults")}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const legalPages = ordered.filter((p) => p.kind !== "custom");
  const customPages = ordered.filter((p) => p.kind === "custom");

  return (
    <div className="space-y-4">
      {/* Legal Policies Group */}
      <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span className="text-[12px] font-semibold text-foreground tracking-tight">
              {t("list.legal_section_title")}
            </span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {legalPages.length}/4
          </span>
        </div>

        <ul className="p-1.5 space-y-1">
          {legalPages.map((page) => {
            const needsReview = pageNeedsReview(page);
            const active = page.id === selectedId;
            const Icon = KIND_ICONS[page.kind] ?? FileText;

            return (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => onSelect(page.id)}
                  className={`group relative flex w-full flex-col gap-1.5 rounded-lg p-2.5 text-start transition-all ${
                    active
                      ? "bg-primary/[0.08] text-foreground ring-1 ring-primary/20 shadow-xs"
                      : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          active
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/70 bg-muted/40 text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <Icon size={14} />
                      </div>
                      <span className="truncate text-[13px] font-semibold">
                        {t(pageKindLabelKey(page.kind))}
                      </span>
                    </div>

                    {needsReview ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400"
                        title={t("list.needs_review")}
                      >
                        <AlertTriangle size={11} className="shrink-0" />
                        <span>{t("list.needs_review")}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                        title={t("list.reviewed")}
                      >
                        <CheckCircle2 size={11} className="shrink-0" />
                        <span>{t("list.reviewed")}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ps-9 text-[11px] text-muted-foreground font-mono">
                    <span className="truncate">/pages/{page.slug}</span>
                    {page.status === "draft" && (
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] uppercase font-sans font-bold text-muted-foreground">
                        {t("list.status_draft")}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Custom Pages Group — shown only once a custom page exists; creation
          lives in the "New page" button in the tab header */}
      {customPages.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <span className="text-[12px] font-semibold text-foreground tracking-tight">
                {t("list.custom_section_title")}
              </span>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {customPages.length}
            </span>
          </div>

          <ul className="p-1.5 space-y-1">
            {customPages.map((page) => {
              const active = page.id === selectedId;
              const title = page.translations[0]?.title || page.slug;

              return (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(page.id)}
                    className={`group flex w-full flex-col gap-1 rounded-lg p-2.5 text-start transition-all ${
                      active
                        ? "bg-primary/[0.08] text-foreground ring-1 ring-primary/20 shadow-xs"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className={active ? "text-primary" : "text-muted-foreground"} />
                        <span className="truncate text-[13px] font-semibold">{title}</span>
                      </div>
                      <Badge tone={page.status === "published" ? "success" : "neutral"} size="sm">
                        {page.status === "published" ? t("list.status_published") : t("list.status_draft")}
                      </Badge>
                    </div>
                    <div className="ps-5 text-[11px] text-muted-foreground font-mono truncate">
                      /pages/{page.slug}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Business Details Quick-Nav Card */}
      {onOpenBusinessDetails && (
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-border">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/30 text-muted-foreground">
              <Building2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[12.5px] font-semibold text-foreground">
                {t("list.business_card_title")}
              </h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {t("list.business_card_desc")}
              </p>
              <button
                type="button"
                onClick={onOpenBusinessDetails}
                className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>{t("list.manage_business")}</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
