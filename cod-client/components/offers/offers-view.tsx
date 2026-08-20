"use client";

import { useRouter } from "next/navigation";
import { Plus, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { useOffers } from "@/lib/translations";
import { OffersTable } from "./offers-table";
import type { Offer } from "@/actions/offers";

interface Props {
  offers: Offer[];
  userScopes: string[];
}

export function OffersView({ offers, userScopes }: Props) {
  const t = useOffers();
  const router = useRouter();

  function handleCreate() {
    router.push("/offers/new");
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {offers.length} {t.offers_count}
          </p>
        </div>
        <ProtectedAction requiredScope={SCOPES.OFFERS_MANAGE} userScopes={userScopes}>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            {t.add_offer}
          </Button>
        </ProtectedAction>
      </div>

      {/* Empty state */}
      {offers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg">{t.empty_state.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.empty_state.description}</p>
          </div>
          <ProtectedAction requiredScope={SCOPES.OFFERS_MANAGE} userScopes={userScopes}>
            <Button onClick={handleCreate} variant="outline" className="gap-2 mt-2">
              <Plus className="w-4 h-4" />
              {t.add_offer}
            </Button>
          </ProtectedAction>
        </div>
      )}

      {/* Table */}
      {offers.length > 0 && (
        <OffersTable 
          offers={offers} 
          userScopes={userScopes}
        />
      )}
    </div>
  );
}
