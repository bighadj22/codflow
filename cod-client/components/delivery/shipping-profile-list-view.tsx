"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState, useRef } from "react";
import {
  MapPin, Package, Package2, Plus, Star, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useSettings, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import { deleteShippingProfile } from "@/actions/shipping-profiles";
import type { ShippingProfile } from "@/types";

const PAGE_SIZE = 6;

interface Props {
  profiles: ShippingProfile[];
}

export function ShippingProfileListView({ profiles }: Props) {
  const t = useSettings();
  const common = useCommon();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(profiles.length / PAGE_SIZE);
  const paginatedProfiles = profiles.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  function handlePageChange(next: number) {
    setPage(next);
    // Scroll the grid back into view smoothly when the page changes
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(profile: ShippingProfile) {
    const ok = await confirmDialog({
      title: t.shipping.confirm_delete ?? `Delete "${profile.name}"?`,
      variant: "destructive",
      confirmLabel: common.delete ?? t.shipping.delete_action ?? "Delete",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteShippingProfile(profile.id);
        toast.success(t.shipping.success_deleted ?? "Profile deleted");
        // Reset to page 1 if the current page becomes empty after deletion
        const newTotal = profiles.length - 1;
        const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
        if (page > newTotalPages) setPage(Math.max(1, newTotalPages));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete profile");
      }
    });
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">

        {/* Page header — stacks vertically on mobile, side-by-side on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              {t.shipping.title}
            </h1>
            <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1">
              {profiles.length} {t.shipping.rate_cards ?? "rate cards"}
            </p>
          </div>
          <Link
            href="/delivery/shipping-profiles/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-10 w-full sm:w-auto justify-center rounded-xl font-black px-5 uppercase text-[11px] tracking-widest shadow-lg shadow-primary/10 active:scale-95 transition-all"
            )}
          >
            <Plus size={14} className="me-2" />
            {t.shipping.create_profile}
          </Link>
        </div>

        {/* Empty state */}
        {profiles.length === 0 && (
          <div className="glass-card border-dashed border-border/40 rounded-2xl p-16 text-center space-y-5">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Package size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-black text-foreground text-lg tracking-tight">{t.shipping.list_empty_title}</p>
              <p className="text-xs text-muted-foreground/60 font-medium mt-1.5 max-w-xs mx-auto leading-relaxed">
                {t.shipping.list_empty_description}
              </p>
            </div>
            <Link
              href="/delivery/shipping-profiles/new"
              className={cn(buttonVariants(), "h-11 rounded-xl font-black text-[11px] uppercase tracking-widest px-6")}
            >
              <Plus size={14} className="me-2" />
              {t.shipping.create_profile}
            </Link>
          </div>
        )}

        {/* Grid */}
        {profiles.length > 0 && (
          <div ref={gridRef} className="scroll-mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedProfiles.map((profile, i) => (
                <div
                  key={profile.id}
                  className={cn(
                    "group glass-card rounded-2xl border-border/30 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] animate-fade-in-up",
                    profile.isDefault && "border-primary/10"
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {profile.isDefault && (
                    <div className="h-[3px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
                  )}

                  <div className="p-5">
                    {/* Top: icon + name + default badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105",
                          profile.isDefault
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "bg-muted/50 text-muted-foreground/30"
                        )}>
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="text-base font-black text-foreground tracking-tight">{profile.name}</p>
                        </div>
                      </div>

                      {profile.isDefault && (
                        <div className="shrink-0 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-primary/20 uppercase tracking-widest">
                          <Star size={8} fill="currentColor" />
                          {t.shipping.default_badge}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {([
                        { icon: MapPin, value: profile.ruleCount, label: t.shipping.card_wilayas },
                        { icon: Package2, value: profile.productCount ?? 0, label: (t.shipping as unknown as Record<string, string>).card_products ?? "Products" },
                      ] as const).map(({ icon: Icon, value, label }) => (
                        <div key={label} className="bg-muted/20 border border-border/10 rounded-xl p-2.5 text-center transition-all group-hover:bg-primary/5 group-hover:border-primary/10">
                          <p className="text-lg font-black text-foreground tabular-nums leading-tight">{value}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-0.5 flex items-center justify-center gap-1">
                            <Icon size={8} className="text-primary/40" />{label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/delivery/shipping-profiles/${profile.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "flex-1 h-10 rounded-xl border-border/30 text-[11px] font-black uppercase tracking-widest hover:bg-muted/30 transition-all active:scale-95"
                        )}
                      >
                        {t.shipping.view_action}
                      </Link>
                      <Link
                        href={`/delivery/shipping-profiles/${profile.id}/edit`}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-primary/10 active:scale-95 transition-all"
                        )}
                      >
                        {t.shipping.edit_action}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(profile)}
                        disabled={isPending}
                        className="h-10 w-10 rounded-xl text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 shrink-0 transition-all active:scale-90"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={profiles.length}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          </div>
        )}
      </div>
      {ConfirmDialog}
    </>
  );
}
