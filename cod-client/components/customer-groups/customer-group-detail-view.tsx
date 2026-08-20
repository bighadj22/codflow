"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Edit, Trash2, UserPlus, UserMinus, Users, Search } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCustomerGroups, useCommon } from "@/lib/translations";
import { useConfirm } from "@/components/ui/use-confirm";
import {
  addCustomerToGroup,
  removeCustomerFromGroup,
  deleteCustomerGroup,
} from "@/actions/customer-groups";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { formatDate } from "@/lib/format";
import { generateAvatar } from "@/lib/avatar";
import type { CustomerGroupWithMembers, CustomerGroupMember, Customer } from "@/types";

interface Props {
  group: CustomerGroupWithMembers;
  allCustomers: Customer[];
  userScopes: string[];
}

export function CustomerGroupDetailView({ group, allCustomers, userScopes }: Props) {
  const t = useCustomerGroups();
  const common = useCommon();
  const router = useRouter();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const memberIds = new Set(group.members.map((m) => m.id));

  const filteredMembers = group.members.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search),
  );

  const availableCustomers = allCustomers.filter(
    (c) =>
      !memberIds.has(c.id) &&
      (!addSearch ||
        c.name.toLowerCase().includes(addSearch.toLowerCase()) ||
        c.phone.includes(addSearch)),
  );

  async function handleAddMember(customer: Customer) {
    setActionLoading(`add-${customer.id}`);
    try {
      await addCustomerToGroup(group.id, customer.id);
      toast.success(t.detail.member_added);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember(member: CustomerGroupMember) {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", member.name) ?? member.name,
      variant: "destructive",
      confirmLabel: t.detail.remove_member,
    });
    if (!ok) return;

    setActionLoading(`remove-${member.id}`);
    try {
      await removeCustomerFromGroup(group.id, member.id);
      toast.success(t.detail.member_removed);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteGroup() {
    const ok = await confirmDialog({
      title: common.confirm_delete_title?.replace("{name}", group.name) ?? group.name,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    try {
      await deleteCustomerGroup(group.id);
      toast.success(t.success_deleted);
      router.push("/customer-groups");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.error_delete_failed);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-muted/40 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: group.color }} />
            <div>
              <h1 className="font-black text-lg tracking-tight text-foreground">{group.name}</h1>
              {group.description && (
                <p className="text-xs font-bold text-muted-foreground/60 mt-0.5">{group.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/customer-groups/${group.id}/edit`)}
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              {t.actions.edit}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteGroup}
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 text-rose-500 hover:text-rose-500 hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.actions.delete}
            </Button>
          </ProtectedAction>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl border-border/30 p-4 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
            {t.table.members}
          </p>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary/60" />
            <span className="text-2xl font-black text-foreground tabular-nums">
              {group.memberCount}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-2xl border-border/30 p-4 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
            {t.table.created}
          </p>
          <p className="text-sm font-black text-foreground">{formatDate(group.createdAt)}</p>
        </div>
      </div>

      {/* Members section */}
      <div className="glass-card rounded-2xl border-border/30 overflow-hidden shadow-sm">
        {/* Members header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary/60" />
            <span className="text-sm font-black uppercase tracking-widest text-foreground/70">
              {t.detail.members}
            </span>
            <span className="text-[10px] font-black text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
              {group.members.length}
            </span>
          </div>
          <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
            <Button
              size="sm"
              onClick={() => setShowAddPanel(!showAddPanel)}
              className="h-8 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest gap-1.5 shadow-sm shadow-primary/10 active:scale-95 transition-all px-3"
            >
              <UserPlus className="w-3 h-3" />
              {t.detail.add_member}
            </Button>
          </ProtectedAction>
        </div>

        {/* Add member panel */}
        {showAddPanel && (
          <div className="px-5 py-4 border-b border-border/20 bg-primary/2 space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
              <input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder={t.detail.search_add}
                className="w-full h-9 ps-9 pe-3 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableCustomers.length === 0 ? (
                <p className="text-xs font-bold text-muted-foreground/50 py-2 text-center">{t.detail.no_available}</p>
              ) : (
                availableCustomers.slice(0, 20).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ backgroundColor: generateAvatar(customer.name, customer.id).color }}
                      >
                        {generateAvatar(customer.name, customer.id).initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground/60" dir="ltr">{customer.phone}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(customer)}
                      disabled={actionLoading === `add-${customer.id}`}
                      className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all active:scale-90 shrink-0"
                    >
                      <UserPlus className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Search members */}
        {group.members.length > 5 && (
          <div className="px-5 py-3 border-b border-border/20">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.detail.search_members}
                className="w-full h-9 ps-9 pe-3 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="divide-y divide-border/10">
          {filteredMembers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm font-bold text-muted-foreground/40">{t.detail.no_members}</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0"
                    style={{ backgroundColor: generateAvatar(member.name, member.id).color }}
                  >
                    {generateAvatar(member.name, member.id).initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{member.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5" dir="ltr">
                      {member.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-end hidden sm:block">
                    <p className="text-xs font-black text-primary tabular-nums">{formatPrice(member.totalSpent)}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/50">{member.totalOrders} {t.detail.orders_label}</p>
                  </div>
                  <ProtectedAction userScopes={userScopes} requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
                    <button
                      onClick={() => handleRemoveMember(member)}
                      disabled={actionLoading === `remove-${member.id}`}
                      className="w-8 h-8 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-500/50 hover:text-rose-500 flex items-center justify-center transition-all active:scale-90"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </ProtectedAction>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {ConfirmDialog}
    </div>
  );
}
