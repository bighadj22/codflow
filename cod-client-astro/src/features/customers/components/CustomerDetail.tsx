import { useEffect, useState } from "react";
import {
  AlertCircle,
  Layers,
  Package,
  Pencil,
  Phone,
  Plus,
} from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import {
  Alert,
  Button,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  getCustomer,
  getCustomerGroups,
  getCustomerOrders,
  getCustomerTags,
  listCustomerGroups,
  listCustomerTags,
} from "@/features/customers/api";
import { customerErrorMessage } from "@/features/customers/model";
import type {
  Customer,
  CustomerGroup,
  CustomerGroupMembership,
  CustomerOrderSummary,
  CustomerTag,
  CustomerTagMembership,
} from "@/features/customers/types";
import { CustomerContactCard } from "@/features/customers/components/CustomerContactCard";
import { CustomerOrdersCard } from "@/features/customers/components/CustomerOrdersCard";
import { CustomerSegmentsCard } from "@/features/customers/components/CustomerSegmentsCard";
import { CustomerStatsSidebar } from "@/features/customers/components/CustomerStatsSidebar";

type Tab = "orders" | "segments";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function CustomerDetail({ customerId }: { customerId: string }) {
  const t = useT("customers");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [groups, setGroups] = useState<CustomerGroupMembership[]>([]);
  const [tags, setTags] = useState<CustomerTagMembership[]>([]);
  const [allGroups, setAllGroups] = useState<CustomerGroup[]>([]);
  const [allTags, setAllTags] = useState<CustomerTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("orders");

  async function load() {
    setError(null);
    try {
      const readGroups = canScope(identity, SCOPES.CUSTOMER_GROUPS_READ);
      const readTags = canScope(identity, SCOPES.CUSTOMER_TAGS_READ);
      const [
        customerResult,
        ordersResult,
        groupsResult,
        tagsResult,
        allGroupsResult,
        allTagsResult,
      ] = await Promise.allSettled([
        getCustomer(customerId),
        getCustomerOrders(customerId),
        readGroups ? getCustomerGroups(customerId) : Promise.resolve([]),
        readTags ? getCustomerTags(customerId) : Promise.resolve([]),
        readGroups ? listCustomerGroups() : Promise.resolve([]),
        readTags ? listCustomerTags() : Promise.resolve([]),
      ]);
      if (customerResult.status === "rejected") throw customerResult.reason;
      setCustomer(customerResult.value);
      setOrders(ordersResult.status === "fulfilled" ? ordersResult.value : []);
      setGroups(groupsResult.status === "fulfilled" ? groupsResult.value : []);
      setTags(tagsResult.status === "fulfilled" ? tagsResult.value : []);
      setAllGroups(
        allGroupsResult.status === "fulfilled" ? allGroupsResult.value : [],
      );
      setAllTags(
        allTagsResult.status === "fulfilled" ? allTagsResult.value : [],
      );
      const auxiliaryFailure = [
        ordersResult,
        groupsResult,
        tagsResult,
        allGroupsResult,
        allTagsResult,
      ].find((result) => result.status === "rejected");
      if (auxiliaryFailure?.status === "rejected")
        setError(customerErrorMessage(auxiliaryFailure.reason, t));
    } catch (cause) {
      setError(customerErrorMessage(cause, t));
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.CUSTOMERS_READ)) void load();
  }, [customerId, identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.CUSTOMERS_READ))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );

  if (error && !customer)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );

  if (!customer) return <Loading />;

  const segmentCount = groups.length + tags.length;
  const canEdit =
    canScope(identity, SCOPES.CUSTOMERS_READ) &&
    canScope(identity, SCOPES.CUSTOMERS_UPDATE);

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        title={customer.name}
        subtitle={
          <span className="inline-flex items-center gap-2" dir="ltr">
            <Phone size={14} />
            {customer.phone}
          </span>
        }
        backHref="/customers"
        backLabel={t("page_title")}
        actions={
          <div className="flex gap-2">
            {canEdit && (
              <LinkButton
                href={`/customers/${encodeURIComponent(customer.id)}/edit`}
                variant="secondary"
              >
                <Pencil size={16} />
                {t("actions.edit")}
              </LinkButton>
            )}
            {canScope(identity, SCOPES.ORDERS_CREATE) && (
              <LinkButton href="/orders/new">
                <Plus size={16} />
                {t("profile.new_order")}
              </LinkButton>
            )}
          </div>
        }
      />
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} />
          <span>{error}</span>
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <CustomerContactCard customer={customer} />
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`inline-flex min-h-10 items-center gap-2 border-b px-4 text-sm font-semibold ${tab === "orders" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              <Package size={15} />
              {t("profile.order_history")}
            </button>
            {(canScope(identity, SCOPES.CUSTOMER_GROUPS_READ) ||
              canScope(identity, SCOPES.CUSTOMER_TAGS_READ)) && (
              <button
                type="button"
                onClick={() => setTab("segments")}
                className={`inline-flex min-h-10 items-center gap-2 border-b px-4 text-sm font-semibold ${tab === "segments" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              >
                <Layers size={15} />
                {t("segments.tab")}
                {segmentCount > 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {segmentCount}
                  </span>
                )}
              </button>
            )}
          </div>
          {tab === "orders" ? (
            <CustomerOrdersCard orders={orders} locale={locale} />
          ) : (
            <CustomerSegmentsCard
              customer={customer}
              groups={groups}
              tags={tags}
              allGroups={allGroups}
              allTags={allTags}
              reload={load}
            />
          )}
        </div>
        <CustomerStatsSidebar
          customer={customer}
          orders={orders}
          locale={locale}
        />
      </div>
    </div>
  );
}
