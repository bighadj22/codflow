"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Package, Edit, Plus, Phone, MapPin, TrendingUp,
  Calendar, Hash, DollarSign, Layers, Tag, UserPlus, X, Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { useConfirm } from "@/components/ui/use-confirm";
import { toast } from "sonner";
import { addCustomerToGroup, removeCustomerFromGroup } from "@/actions/customer-groups";
import { assignCustomerTag, unassignCustomerTag } from "@/actions/customer-tags";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import type { Customer, Order, CustomerGroupSummary, CustomerTagSummary, CustomerGroup, CustomerTag } from "@/types";
import { cn } from "@/lib/utils";
import { useCustomers, useCommon } from "@/lib/translations";
import { formatPrice, formatDate } from "@/lib/format";

interface Props {
  customer: Customer;
  orders: Order[];
  returnRate: number;
  assignedGroups: CustomerGroupSummary[];
  assignedTags: CustomerTagSummary[];
  allGroups: CustomerGroup[];
  allTags: CustomerTag[];
  userScopes: string[];
}

export function CustomerProfileView({
  customer,
  orders,
  returnRate,
  assignedGroups,
  assignedTags,
  allGroups,
  allTags,
  userScopes,
}: Props) {
  const t = useCustomers();
  const common = useCommon();
  const router = useRouter();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  const assignedGroupIds = new Set(assignedGroups.map((g) => g.id));
  const assignedTagIds = new Set(assignedTags.map((t) => t.id));

  const availableGroups = allGroups.filter(
    (g) =>
      !assignedGroupIds.has(g.id) &&
      (!groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())),
  );

  const availableTags = allTags.filter(
    (t) =>
      !assignedTagIds.has(t.id) &&
      (!tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())),
  );

  async function handleAddGroup(group: CustomerGroup) {
    setActionLoading(`add-group-${group.id}`);
    try {
      await addCustomerToGroup(group.id, customer.id);
      toast.success(t.segments.group_added);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add group");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveGroup(group: CustomerGroupSummary) {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", group.name) ?? group.name,
      variant: "destructive",
      confirmLabel: common.remove ?? "Remove",
    });
    if (!ok) return;

    setActionLoading(`remove-group-${group.id}`);
    try {
      await removeCustomerFromGroup(group.id, customer.id);
      toast.success(t.segments.group_removed);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove group");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddTag(tag: CustomerTag) {
    setActionLoading(`add-tag-${tag.id}`);
    try {
      await assignCustomerTag(tag.id, customer.id);
      toast.success(t.segments.tag_added);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add tag");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveTag(tag: CustomerTagSummary) {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", tag.name) ?? tag.name,
      variant: "destructive",
      confirmLabel: common.remove ?? "Remove",
    });
    if (!ok) return;

    setActionLoading(`remove-tag-${tag.id}`);
    try {
      await unassignCustomerTag(tag.id, customer.id);
      toast.success(t.segments.tag_removed);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove tag");
    } finally {
      setActionLoading(null);
    }
  }

  const segmentCount = assignedGroups.length + assignedTags.length;

  return (
    <div className="max-w-4xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Action row */}
      <div className="flex items-center justify-end gap-2.5 sm:gap-3">
        <div className="hidden lg:flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 px-5 rounded-xl border-border bg-white/50 dark:bg-muted/20 text-foreground font-black text-[11px] uppercase tracking-widest hover:bg-muted transition-all active:scale-95"
            onClick={() => router.push(`/customers/${customer.id}/edit`)}
          >
            <Edit size={14} className="me-2" /> {t.actions.edit}
          </Button>
          <Link href="/orders/new">
            <Button className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95">
              <Plus size={14} className="me-2" /> {t.profile.new_order}
            </Button>
          </Link>
        </div>
        <Link
          href="/customers"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      </div>

      {/* Hero Glass Card */}
      <div className="group relative glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-premium">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[80px] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 duration-700" />

        <div className="relative z-10 p-5 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
            <div className="flex items-start gap-4 sm:gap-6 flex-1 min-w-0">
              <div className="space-y-3 sm:space-y-4 min-w-0 flex-1">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight font-display truncate">
                    {customer.name}
                  </h1>

                  {/* Contact info grid */}
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* Phone 1 */}
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-0.5">{t.profile.phone}</p>
                      <div className="flex items-center gap-1.5">
                        <Phone size={11} className="text-primary/40 shrink-0" />
                        <span className="text-[12px] sm:text-[13px] font-bold text-foreground" dir="ltr">{customer.phone}</span>
                      </div>
                    </div>

                    {/* Phone 2 */}
                    {customer.phone2 ? (
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-0.5">{t.form.phone2_label}</p>
                        <div className="flex items-center gap-1.5">
                          <Phone size={11} className="text-primary/40 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-foreground" dir="ltr">{customer.phone2}</span>
                        </div>
                      </div>
                    ) : <div />}

                    {/* Wilaya */}
                    {customer.wilaya && (
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-0.5">{t.profile.wilaya}</p>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-primary/40 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-foreground truncate">{customer.wilaya}</span>
                        </div>
                      </div>
                    )}

                    {/* Commune */}
                    {customer.commune && (
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-0.5">{t.profile.commune}</p>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-primary/40 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-foreground truncate">{customer.commune}</span>
                        </div>
                      </div>
                    )}

                    {/* Address — full width */}
                    {customer.address && (
                      <div className="col-span-2 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-0.5">{t.profile.address}</p>
                        <div className="flex items-start gap-1.5">
                          <MapPin size={11} className="text-primary/40 shrink-0 mt-0.5" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-foreground leading-snug">{customer.address}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="text-[9px] sm:text-[10px] font-black bg-muted/50 text-muted-foreground/60 px-2.5 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar size={10} className="opacity-50" />
                      {t.profile.customer_since} <span suppressHydrationWarning>{formatDate(customer.createdAt)}</span>
                    </span>
                    {/* Assigned group chips */}
                    {assignedGroups.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black text-white"
                        style={{ backgroundColor: g.color }}
                      >
                        <Layers size={8} />
                        {g.name}
                      </span>
                    ))}
                    {/* Assigned tag pills */}
                    {assignedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-3 shrink-0 lg:w-56">
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm text-center lg:text-start">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center justify-center lg:justify-start gap-1.5">
                  <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                  {t.table.orders}
                </p>
                <p className="text-lg sm:text-2xl font-black text-foreground font-display tabular-nums leading-none">
                  {customer.totalOrders || 0}
                </p>
              </div>
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm text-center lg:text-start">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center justify-center lg:justify-start gap-1.5">
                  <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                  {t.profile.total_spent}
                </p>
                <p className="text-lg sm:text-2xl font-black text-primary font-display tabular-nums leading-none">
                  {formatPrice(customer.totalSpent)}
                </p>
              </div>
              <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm text-center lg:text-start">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center justify-center lg:justify-start gap-1.5">
                  <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500/50" />
                  {t.profile.return_rate}
                </p>
                <p
                  className="text-lg sm:text-2xl font-black font-display tabular-nums leading-none"
                  style={{
                    color:
                      returnRate > 10
                        ? "var(--status-returned-text)"
                        : returnRate > 0
                          ? "var(--status-ready-text)"
                          : "var(--status-delivered-text)",
                  }}
                >
                  {returnRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Orders + Segments */}
      <div className="space-y-4">
        <Tabs defaultValue="orders" className="w-full">
          <div className="flex items-center justify-between px-1 mb-4">
            <TabsList className="bg-muted/30 border border-border/20 p-1 rounded-xl h-11">
              <TabsTrigger
                value="orders"
                className="flex items-center gap-2 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest transition-all"
              >
                <Package size={14} />
                {t.profile.order_history}
              </TabsTrigger>
              <TabsTrigger
                value="segments"
                className="flex items-center gap-2 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest transition-all"
              >
                <Layers size={14} />
                {t.segments.tab}
                {segmentCount > 0 && (
                  <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
                    {segmentCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-0 animate-fade-in-up">
            <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm">
              <div className="overflow-x-auto no-scrollbar">
                {orders.length === 0 ? (
                  <div className="py-20 text-center space-y-4 px-6">
                    <div className="w-14 h-14 bg-muted/30 rounded-2xl flex items-center justify-center mx-auto opacity-20">
                      <Package size={28} />
                    </div>
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 max-w-xs mx-auto">
                      {t.profile.no_orders}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-border/10">
                      {orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-4">
                          <div className="min-w-0 space-y-1">
                            <p className="font-black text-[13px] text-foreground tracking-tight truncate">
                              {order.orderNumber}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground/50 tabular-nums" suppressHydrationWarning>
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-sm font-black text-primary tabular-nums">
                              {formatPrice(order.price)}
                            </span>
                            <OrderStatusBadge status={order.status} className="scale-90 origin-right" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block min-w-[500px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/10">
                          <tr className="border-b border-border/10">
                            <th className="px-6 py-4 text-start text-[9px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                              <div className="flex items-center gap-2"><Hash size={12} /> {t.profile.order_number}</div>
                            </th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                              <div className="flex items-center justify-center gap-2"><DollarSign size={12} /> {t.profile.price}</div>
                            </th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                              {t.profile.status}
                            </th>
                            <th className="px-6 py-4 text-end text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                              <div className="flex items-center justify-end gap-2"><Calendar size={12} /> {t.profile.date}</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/5">
                          {orders.map((order) => (
                            <tr key={order.id} className="group hover:bg-white/40 dark:hover:bg-primary/[0.02] transition-all duration-300">
                              <td className="px-6 py-4">
                                <p className="font-black text-sm text-foreground tracking-tight group-hover:text-primary transition-colors">
                                  {order.orderNumber}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-sm font-black text-primary tabular-nums">{formatPrice(order.price)}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <OrderStatusBadge status={order.status} className="scale-90" />
                              </td>
                              <td className="px-6 py-4 text-end">
                                <span className="text-xs font-bold text-muted-foreground/60 tabular-nums" suppressHydrationWarning>
                                  {formatDate(order.createdAt)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="mt-0 animate-fade-in-up space-y-4">
            {/* Groups Card */}
            <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest text-foreground/70">
                    {t.segments.groups_title}
                  </span>
                  {assignedGroups.length > 0 && (
                    <span className="text-[10px] font-black text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                      {assignedGroups.length}
                    </span>
                  )}
                </div>
                <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
                  <Button
                    size="sm"
                    onClick={() => { setShowAddGroup(!showAddGroup); setGroupSearch(""); }}
                    className="h-8 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest gap-1.5 shadow-sm shadow-primary/10 active:scale-95 transition-all px-3"
                  >
                    <UserPlus className="w-3 h-3" />
                    {t.segments.add_group}
                  </Button>
                </ProtectedAction>
              </div>

              {/* Add group panel */}
              {showAddGroup && (
                <div className="px-5 sm:px-6 py-4 border-b border-border/10 space-y-3">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                    <input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder={t.segments.search_group}
                      className="w-full h-9 ps-9 pe-3 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {availableGroups.length === 0 ? (
                      <p className="text-xs font-bold text-muted-foreground/50 py-3 text-center">{t.segments.no_groups}</p>
                    ) : (
                      availableGroups.slice(0, 15).map((group) => (
                        <div key={group.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: group.color }} />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{group.name}</p>
                              {group.description && (
                                <p className="text-[10px] font-medium text-muted-foreground/50 truncate">{group.description}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddGroup(group)}
                            disabled={actionLoading === `add-group-${group.id}`}
                            className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all active:scale-90 shrink-0 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Assigned groups */}
              <div className="p-5 sm:p-6">
                {assignedGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Layers className="w-8 h-8 text-muted-foreground/15 mb-2" />
                    <p className="text-xs font-bold text-muted-foreground/40">{t.segments.no_groups}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black text-white shadow-sm"
                        style={{ backgroundColor: group.color }}
                      >
                        <Layers className="w-3 h-3 opacity-80" />
                        <span>{group.name}</span>
                        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
                          <button
                            onClick={() => handleRemoveGroup(group)}
                            disabled={actionLoading === `remove-group-${group.id}`}
                            className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </ProtectedAction>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags Card */}
            <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest text-foreground/70">
                    {t.segments.tags_title}
                  </span>
                  {assignedTags.length > 0 && (
                    <span className="text-[10px] font-black text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                      {assignedTags.length}
                    </span>
                  )}
                </div>
                <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_TAGS_MANAGE}>
                  <Button
                    size="sm"
                    onClick={() => { setShowAddTag(!showAddTag); setTagSearch(""); }}
                    className="h-8 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest gap-1.5 shadow-sm shadow-primary/10 active:scale-95 transition-all px-3"
                  >
                    <Plus className="w-3 h-3" />
                    {t.segments.add_tag}
                  </Button>
                </ProtectedAction>
              </div>

              {/* Add tag panel */}
              {showAddTag && (
                <div className="px-5 sm:px-6 py-4 border-b border-border/10 space-y-3">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                    <input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder={t.segments.search_tag}
                      className="w-full h-9 ps-9 pe-3 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto flex flex-wrap gap-2 py-1">
                    {availableTags.length === 0 ? (
                      <p className="text-xs font-bold text-muted-foreground/50 py-3 w-full text-center">{t.segments.no_tags}</p>
                    ) : (
                      availableTags.slice(0, 20).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag)}
                          disabled={actionLoading === `add-tag-${tag.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black text-white transition-all hover:opacity-80 active:scale-95 disabled:opacity-50"
                          style={{ backgroundColor: tag.color }}
                        >
                          <Plus className="w-3 h-3" />
                          {tag.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Assigned tags */}
              <div className="p-5 sm:p-6">
                {assignedTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Tag className="w-8 h-8 text-muted-foreground/15 mb-2" />
                    <p className="text-xs font-bold text-muted-foreground/40">{t.segments.no_tags}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-black text-white shadow-sm"
                        style={{ backgroundColor: tag.color }}
                      >
                        <span>{tag.name}</span>
                        <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_TAGS_MANAGE}>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            disabled={actionLoading === `remove-tag-${tag.id}`}
                            className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </ProtectedAction>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/customers/${customer.id}/edit`)}
            className="flex-1 h-12 sm:h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest active:scale-95"
          >
            <Edit size={16} className="me-2" />
            {t.actions.edit}
          </Button>
          <Link href="/orders/new" className="flex-1">
            <Button className="w-full h-12 sm:h-14 rounded-2xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95">
              <Plus size={16} className="me-2" />
              {t.profile.new_order}
            </Button>
          </Link>
        </div>
      </div>

      {ConfirmDialog}
    </div>
  );
}
