import { SCOPE_CATEGORIES } from "../../../../cod-shared/rbac/scopes";
import type { ActivityLogMeta, TeamMember, TeamRole, TeamStatus } from "./types";

export type TeamRoute =
  | { kind: "list" }
  | { kind: "detail"; id: string }
  | { kind: "unknown" };

export function parseTeamRoute(pathname: string): TeamRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/team") return { kind: "list" };
  const match = path.match(/^\/team\/([^/]+)$/);
  if (!match) return { kind: "unknown" };
  try {
    const id = decodeURIComponent(match[1]);
    if (!id) return { kind: "unknown" };
    return { kind: "detail", id };
  } catch {
    return { kind: "unknown" };
  }
}

export type TeamSortKey = "name" | "email" | "role" | "status" | "createdAt";

export interface TeamFilters {
  query: string;
  role: TeamRole | "all";
  status: TeamStatus | "all";
}

export function filterTeamMembers(users: TeamMember[], filters: TeamFilters) {
  const q = filters.query.trim().toLocaleLowerCase();
  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.status !== "all" && user.status !== filters.status) return false;
    if (q && `${user.name} ${user.email}`.toLocaleLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

export function sortTeamMembers(users: TeamMember[], key: TeamSortKey, direction: "asc" | "desc") {
  return [...users].sort((left, right) => {
    const leftValue = left[key] ?? "";
    const rightValue = right[key] ?? "";
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateTeamMembers(users: TeamMember[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return users.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

/** Number of scopes a member effectively holds. Admins imply every scope. */
export function teamScopeCount(user: Pick<TeamMember, "role" | "scopes">) {
  if (user.role === "admin") {
    return Object.values(SCOPE_CATEGORIES).reduce((total, category) => total + category.scopes.length, 0);
  }
  return Array.isArray(user.scopes) ? user.scopes.length : 0;
}

export function teamErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "USER_NOT_FOUND") return t("error_member_not_found");
  if (code === "DUPLICATE_EMAIL") return t("error_duplicate_email");
  if (code === "PERMISSION_DENIED") return t("error_permission_denied");
  return t("error_generic");
}

export function parseActivityMeta(raw: string | null): ActivityLogMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActivityLogMeta;
  } catch {
    return null;
  }
}

/** Dot-path action label with raw-key fallback. */
export function activityActionLabel(action: string, t: (key: string) => string) {
  const label = t(`activity_log.actions.${action}`);
  return label.startsWith("activity_log.actions.") ? action : label;
}

/** Entity-type label with raw fallback. */
export function activityEntityLabel(entityType: string, t: (key: string) => string) {
  const label = t(`activity_log.filters.${entityType}`);
  return label.startsWith("activity_log.filters.") ? entityType : label;
}

export function formatTeamDate(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : `${locale}-DZ`).format(date);
}

/** Short relative time ("3 min ago") — falls back to the raw date. */
export function formatRelativeTime(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  return formatTeamDate(value, locale);
}
