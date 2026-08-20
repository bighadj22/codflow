"use client";

import { Eye, Edit, Shield, Crown, User as UserIcon, MoreHorizontal, Activity, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable, TableColumn, TableAction } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTeam, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SCOPE_CATEGORIES } from "@/../cod-shared/rbac/scopes";
import type { User } from "@/actions/users";

interface TeamTableProps {
  users: User[];
  loading?: boolean;
  onView?: (user: User) => void;
  onEdit?: (user: User) => void;
  onManageScopes?: (user: User) => void;
  onViewActivity?: (user: User) => void;
  onRotateApiKey?: (user: User) => void;
}

export function TeamTable({
  users,
  loading = false,
  onView,
  onEdit,
  onManageScopes,
  onViewActivity,
  onRotateApiKey,
}: TeamTableProps) {
  const t = useTeam();
  const common = useCommon();
  const { dir } = useLanguage();
  const router = useRouter();

  const handleViewActivity = (user: User) => {
    if (onViewActivity) {
      onViewActivity(user);
    } else {
      router.push(`/team/${user.id}`);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="w-3 h-3 text-yellow-600" />;
      default: return <UserIcon className="w-3 h-3 text-gray-600" />;
    }
  };

  const columns: TableColumn<User>[] = [
    {
      key: "name",
      label: t.table?.name || "Name",
      sortable: true,
      isTitle: true,
      render: (value, row) => (
        <div className="min-w-0">
          <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
            {value}
            {getRoleIcon(row.role)}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: t.table?.email ?? "Email",
      sortable: true,
      render: (value) => (
        <div
          className="text-xs font-bold text-muted-foreground/80"
          dir="ltr"
        >
          {value as string}
        </div>
      ),
    },
    {
      key: "role",
      label: t.table?.role || "Role",
      sortable: true,
      isSubtitle: true,
      render: (value) => (
        <Badge
          variant="secondary"
          className={`text-[10px] font-black uppercase tracking-widest py-0 h-5 ${
            value === "admin"
              ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/20"
              : "bg-gray-500/15 text-gray-700 border-gray-500/20"
          }`}
        >
          {common.roles[value as keyof typeof common.roles] || value}
        </Badge>
      ),
    },
    {
      key: "status",
      label: t.table?.status || "Status",
      sortable: true,
      isStatus: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: "scopes",
      label: t.table?.permissions || "Permissions",
      render: (value, row) => {
        // For admin users, show all available scopes count instead of just "*"
        const scopeCount = row.role === "admin" 
          ? Object.values(SCOPE_CATEGORIES).reduce((total, category) => total + category.scopes.length, 0)
          : (Array.isArray(value) ? value.length : 0);
        
        return (
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm font-bold">
              {scopeCount} {t.table?.scopes || "scopes"}
            </span>
          </div>
        );
      },
      tabletHidden: true,
    },
  ];

  const actions: TableAction<User>[] = [
    ...(onView ? [{
      label: t.actions?.view || "View",
      icon: <Eye className="w-4 h-4" />,
      onClick: onView,
      variant: "ghost" as const,
    }] : []),
    ...(onEdit ? [{
      label: t.actions?.edit || "Edit",
      icon: <Edit className="w-4 h-4" />,
      onClick: onEdit,
      variant: "ghost" as const,
    }] : []),
    ...(onManageScopes ? [{
      label: t.manage_permissions || "Manage Permissions",
      icon: <Shield className="w-4 h-4" />,
      onClick: onManageScopes,
      variant: "ghost" as const,
    }] : []),
    {
      label: (t as any).view_activity || "View Activity",
      icon: <Activity className="w-4 h-4" />,
      onClick: handleViewActivity,
      variant: "ghost" as const,
    },
    ...(onRotateApiKey ? [{
      label: t.rotate_api_key || "Rotate API Key",
      icon: <KeyRound className="w-4 h-4" />,
      onClick: onRotateApiKey,
      variant: "ghost" as const,
    }] : []),
  ];

  const filters = [
    {
      key: "role",
      label: t.filters?.role || "Role",
      options: [
        { label: common.roles.admin, value: "admin" },
        { label: common.roles.staff, value: "staff" },
      ],
    },
    {
      key: "status",
      label: t.filters?.status || "Status",
      options: [
        { label: t.status?.active || "Active", value: "active" },
        { label: t.status?.inactive || "Inactive", value: "inactive" },
      ],
    },
  ];

  return (
    <DataTable
      data={users}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder || "Search team members..."}
      filterable
      filters={filters}
      emptyMessage={t.empty_state?.title || "No team members found"}
      renderMobileCard={(user) => (
        <div className="flex flex-col gap-3 py-0.5">
          {/* Row 1: Role badge + Status */}
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-[9px] font-black uppercase tracking-widest py-1 px-2.5 border-none",
                user.role === "admin"
                  ? "bg-yellow-500/10 text-yellow-700"
                  : "bg-muted/50 text-muted-foreground/70"
              )}
            >
              {common.roles[user.role as keyof typeof common.roles] || user.role}
            </Badge>
            <StatusBadge status={user.status} className="py-0.5 px-2 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm" />
          </div>

          {/* Row 2: Name with icon (main title) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {getRoleIcon(user.role)}
              <p className="text-[16px] font-black text-foreground tracking-tight leading-snug truncate">
                {user.name}
              </p>
            </div>
            {(onView || onEdit || onManageScopes || onRotateApiKey) && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<button className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90 shrink-0" />}>
                  <MoreHorizontal className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="glass-card rounded-2xl">
                  {onView && (
                    <DropdownMenuItem onClick={() => onView(user)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                      <Eye className="w-3.5 h-3.5 me-2" />{t.actions?.view || "View"}
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(user)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                      <Edit className="w-3.5 h-3.5 me-2" />{t.actions?.edit || "Edit"}
                    </DropdownMenuItem>
                  )}
                  {onManageScopes && (
                    <DropdownMenuItem onClick={() => onManageScopes(user)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                      <Shield className="w-3.5 h-3.5 me-2" />{t.manage_permissions || "Permissions"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleViewActivity(user)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                    <Activity className="w-3.5 h-3.5 me-2" />{(t as any).view_activity || "Activity"}
                  </DropdownMenuItem>
                  {onRotateApiKey && (
                    <DropdownMenuItem onClick={() => onRotateApiKey(user)} className="text-[11px] font-bold uppercase tracking-wider py-2.5 text-amber-600">
                      <KeyRound className="w-3.5 h-3.5 me-2" />{t.rotate_api_key || "Rotate API Key"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Row 3: Email */}
          <p className="text-[12px] font-semibold text-muted-foreground/60 -mt-1.5" dir="ltr">
            {user.email}
          </p>

          {/* Row 4: Permissions section */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/20">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-3 h-3 text-primary/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">
                {t.table?.permissions || "Permissions"}
              </p>
              <p className="text-[13px] font-black text-foreground tabular-nums mt-0.5">
                {user.role === "admin" 
                  ? Object.values(SCOPE_CATEGORIES).reduce((total, category) => total + category.scopes.length, 0)
                  : (Array.isArray(user.scopes) ? user.scopes.length : 0)
                } {t.table?.scopes || "scopes"}
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}
