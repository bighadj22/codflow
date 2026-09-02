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
  addCustomerToGroup,
  deleteCustomerGroup,
  getCustomerGroup,
  listCustomers,
  removeCustomerFromGroup,
} from "@/features/customer-groups/api";
import {
  customerGroupErrorMessage,
  filterAvailableCustomers,
  filterMembers,
  formatGroupDate,
} from "@/features/customer-groups/model";
import type {
  CustomerGroupMember,
  CustomerGroupWithMembers,
} from "@/features/customer-groups/types";
import { CustomerGroupMemberRow } from "@/features/customer-groups/components/CustomerGroupMemberRow";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function CustomerGroupDetail({ groupId }: { groupId: string }) {
  const t = useT("customer-groups");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [group, setGroup] = useState<CustomerGroupWithMembers | null>(null);
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE);

  async function load() {
    setError(null);
    try {
      const [nextGroup, nextCustomers] = await Promise.all([
        getCustomerGroup(groupId),
        canManage ? listCustomers() : Promise.resolve([]),
      ]);
      setGroup(nextGroup);
      setCustomers(nextCustomers);
    } catch (cause) {
      setError(customerGroupErrorMessage(cause, t));
    }
  }
  useEffect(() => {
    if (canScope(identity, SCOPES.CUSTOMER_GROUPS_READ)) void load();
  }, [groupId, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.CUSTOMER_GROUPS_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (error && !group)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  if (!group) return <Loading />;

  const filteredMembers = filterMembers(group.members, search);
  const availableCustomers = filterAvailableCustomers(
    group.members,
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
      const message = customerGroupErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteGroup(groupToDelete: CustomerGroupWithMembers) {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace(
          "{name}",
          groupToDelete.name,
        ),
        description: common("delete_description"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteCustomerGroup(groupToDelete.id);
      notify.flashSuccess(t("success_deleted"));
      window.location.assign("/customer-groups");
    } catch (cause) {
      const message = customerGroupErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    }
  }

  async function removeMember(currentGroupId: string, member: CustomerGroupMember) {
    if (
      !(await confirm({
        title: common("confirm_remove_title").replace("{name}", member.name),
        description: common("remove_description"),
        confirmLabel: t("detail.remove_member"),
        tone: "danger",
      }))
    )
      return;
    await run(
      `remove-${member.id}`,
      () => removeCustomerFromGroup(currentGroupId, member.id),
      t("detail.member_removed"),
    );
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        title={group.name}
        subtitle={group.description || undefined}
        backHref="/customer-groups"
        backLabel={t("page_title")}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <LinkButton
                href={`/customer-groups/${encodeURIComponent(group.id)}/edit`}
                variant="secondary"
              >
                <Pencil size={16} />
                {t("actions.edit")}
              </LinkButton>
              <Button
                type="button"
                variant="dangerOutline"
                onClick={() => void deleteGroup(group)}
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
          label={t("table.members")}
          value={group.memberCount}
          icon={<Users size={20} />}
        />
        <StatCard
          label={t("table.created")}
          value={formatGroupDate(group.createdAt, locale)}
          icon={<Calendar size={20} />}
        />
      </div>
      <Card
        title={t("detail.members")}
        action={
          canManage ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddPanel((current) => !current)}
            >
              <UserPlus size={15} />
              {t("detail.add_member")}
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
                      aria-label={t("detail.add_member")}
                      title={t("detail.add_member")}
                      disabled={busy === `add-${customer.id}`}
                      onClick={() =>
                        void run(
                          `add-${customer.id}`,
                          () => addCustomerToGroup(group.id, customer.id),
                          t("detail.member_added"),
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
          {group.members.length > 5 && (
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("detail.search_members")}
                className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
          )}
          {filteredMembers.length === 0 ? (
            <div className="py-10 text-center">
              <Users size={24} className="mx-auto text-muted-foreground/40" />
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {t("detail.no_members")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {filteredMembers.map((member) => (
                <CustomerGroupMemberRow
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  busy={busy === `remove-${member.id}`}
                  onRemove={() => void removeMember(group.id, member)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
