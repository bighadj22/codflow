import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Package, Plus, X } from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import {
  Alert,
  EmptyState,
  LinkButton,
  Pagination,
  SearchInput,
  useConfirmDialog,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteShippingProfile,
  listShippingProfiles,
} from "@/features/delivery/api";
import {
  filterShippingProfiles,
  paginateShippingProfiles,
  shippingErrorMessage,
  sortShippingProfiles,
} from "@/features/delivery/model";
import type { ShippingProfile } from "@/features/delivery/types";
import {
  ShippingProfileCard,
  ShippingProfileCardSkeleton,
} from "@/features/delivery/components/ShippingProfileCard";
import { notify } from "@/lib/notify";

const PAGE_SIZE = 6;

export function ShippingProfilesList() {
  const t = useT("settings");
  const delivery = useT("delivery");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [profiles, setProfiles] = useState<ShippingProfile[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  async function load() {
    setLoadError(null);
    try {
      setProfiles(await listShippingProfiles());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);
  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  if (!canScope(identity, SCOPES.DELIVERY_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{delivery("error_load")}</p>
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
  if (profiles === null)
    return (
      <div
        role="status"
        aria-busy="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <ShippingProfileCardSkeleton key={index} />
        ))}
      </div>
    );

  const filtered = filterShippingProfiles(profiles, deferredQuery);
  const sorted = sortShippingProfiles(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = paginateShippingProfiles(sorted, safePage, PAGE_SIZE);
  const canManage = canScope(identity, SCOPES.DELIVERY_MANAGE);

  async function onDelete(profile: ShippingProfile) {
    if (
      !(await confirm({
        title: t("shipping.confirm_delete"),
        description: common("delete_description"),
        confirmLabel: t("shipping.delete_action"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteShippingProfile(profile.id);
      setProfiles((current) =>
        current?.filter((item) => item.id !== profile.id) ?? current,
      );
      notify.success(t("shipping.success_deleted"));
    } catch (cause) {
      const message = shippingErrorMessage(cause, delivery);
      setActionError(message);
      notify.error(message);
    }
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("shipping.search_wilaya")}
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {sorted.length} {t("shipping.rate_cards")}
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={<Package size={22} />}
            title={
              deferredQuery.trim()
                ? common("no_results_found")
                : t("shipping.list_empty_title")
            }
            description={
              deferredQuery.trim()
                ? undefined
                : t("shipping.list_empty_description")
            }
            action={
              !deferredQuery.trim() && canManage ? (
                <LinkButton href="/delivery/shipping-profiles/new">
                  <Plus size={16} />
                  {t("shipping.create_profile")}
                </LinkButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((profile) => (
            <ShippingProfileCard
              key={profile.id}
              profile={profile}
              canManage={canManage}
              onDelete={(item) => void onDelete(item)}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={sorted.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
