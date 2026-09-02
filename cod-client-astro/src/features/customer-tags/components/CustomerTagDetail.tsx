import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import {
  Alert,
  Button,
  Card,
  IconButton,
  LinkButton,
  PageHeader,
  StatCard,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  assignCustomerTag,
  deleteCustomerTag,
  getCustomerTag,
  listCustomers,
  unassignCustomerTag,
} from "@/features/customer-tags/api";
import {
  customerTagErrorMessage,
  filterAssigned,
  filterAvailableCustomers,
  formatTagDate,
} from "@/features/customer-tags/model";
import type {
  CustomerTagAssigned,
  CustomerTagWithCustomers,
} from "@/features/customer-tags/types";
import { CustomerTagAssignedRow } from "@/features/customer-tags/components/CustomerTagAssignedRow";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function CustomerTagDetail({ tagId }: { tagId: string }) {
  const t = useT("customer-tags");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [tag, setTag] = useState<CustomerTagWithCustomers | null>(null);
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.CUSTOMER_TAGS_MANAGE);

  async function load() {
    setError(null);
    try {
      const [nextTag, nextCustomers] = await Promise.all([
        getCustomerTag(tagId),
        canManage ? listCustomers() : Promise.resolve([]),
      ]);
      setTag(nextTag);
      setCustomers(nextCustomers);
    } catch (cause) {
      setError(customerTagErrorMessage(cause, t));
    }
  }
  useEffect(() => {
    if (canScope(identity, SCOPES.CUSTOMER_TAGS_READ)) void load();
  }, [tagId, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.CUSTOMER_TAGS_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (error && !tag)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  if (!tag) return <Loading />;

  const filteredCustomers = filterAssigned(tag.customers, search);
  const availableCustomers = filterAvailableCustomers(
    tag.customers,
    customers,
    addSearch,
  );

  async function run(
    key: string,
    task: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      await task();
      await load();
      notify.success(successMessage);
    } catch (cause) {
      const message = customerTagErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteTag(tagToDelete: CustomerTagWithCustomers) {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace(
          "{name}",
          tagToDelete.name,
        ),
        description: common("delete_description"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteCustomerTag(tagToDelete.id);
      notify.flashSuccess(t("success_deleted"));
      window.location.assign("/customer-tags");
    } catch (cause) {
      const message = customerTagErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    }
  }

  async function removeCustomer(currentTagId: string, customer: CustomerTagAssigned) {
    if (
      !(await confirm({
        title: common("confirm_remove_title").replace("{name}", customer.name),
        description: common("remove_description"),
        confirmLabel: t("detail.remove_customer"),
        tone: "danger",
      }))
    )
      return;
    await run(
      `remove-${customer.id}`,
      () => unassignCustomerTag(currentTagId, customer.id),
      t("detail.customer_removed"),
    );
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        title={tag.name}
        backHref="/customer-tags"
        backLabel={t("page_title")}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <LinkButton
                href={`/customer-tags/${encodeURIComponent(tag.id)}/edit`}
                variant="secondary"
              >
                <Pencil size={16} />
                {t("actions.edit")}
              </LinkButton>
              <Button
                type="button"
                variant="dangerOutline"
                onClick={() => void deleteTag(tag)}
              >
                <Trash2 size={16} />
                {t("actions.delete")}
              </Button>
            </div>
          ) : undefined
        }
      />
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("table.customers")}
          value={tag.assignmentCount}
          icon={<Users size={20} />}
        />
        <StatCard
          label={t("table.created")}
          value={formatTagDate(tag.createdAt, locale)}
          icon={<Calendar size={20} />}
        />
      </div>
      <Card
        title={t("detail.customers")}
        action={
          canManage ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddPanel((current) => !current)}
            >
              <UserPlus size={15} />
              {t("detail.add_customer")}
            </Button>
          ) : undefined
        }
      >
        {showAddPanel && (
          <div className="mb-5 border-b border-border pb-4">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={addSearch}
                onChange={(event) => setAddSearch(event.currentTarget.value)}
                placeholder={t("detail.search_add")}
                className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <div className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {availableCustomers.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {t("detail.no_available")}
                </p>
              ) : (
                availableCustomers.slice(0, 20).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {customer.name}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {customer.phone}
                      </p>
                    </div>
                    <IconButton
                      type="button"
                      variant="solid"
                      aria-label={t("detail.add_customer")}
                      title={t("detail.add_customer")}
                      disabled={busy === `add-${customer.id}`}
                      onClick={() =>
                        void run(
                          `add-${customer.id}`,
                          () => assignCustomerTag(tag.id, customer.id),
                          t("detail.customer_added"),
                        )
                      }
                    >
                      <UserPlus size={15} />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {tag.customers.length > 5 && (
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("detail.search_customers")}
                className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
          )}
          {filteredCustomers.length === 0 ? (
            <div className="py-10 text-center">
              <Users size={24} className="mx-auto text-muted-foreground/40" />
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {t("detail.no_customers")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {filteredCustomers.map((customer) => (
                <CustomerTagAssignedRow
                  key={customer.id}
                  customer={customer}
                  canManage={canManage}
                  busy={busy === `remove-${customer.id}`}
                  onRemove={() => void removeCustomer(tag.id, customer)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
