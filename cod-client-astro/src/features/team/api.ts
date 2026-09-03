import { apiFetch } from "@/lib/api";
import type { ActivityLog, CreateTeamMemberResult, TeamMember, TeamRole, TeamStatus } from "./types";

interface ListEnvelope<T> {
  success: boolean;
  data: T[];
  count?: number;
}

interface DataEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function json(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  };
}

export interface TeamMemberListParams {
  role?: TeamRole;
  status?: TeamStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listTeamMembers(params: TeamMemberListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  for (const key of ["role", "status", "search"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<ListEnvelope<TeamMember>>(`/api/users?${query}`);
}

/** Page through every team member (used by the list view). */
export async function listAllTeamMembers() {
  const rows: TeamMember[] = [];
  const limit = 50;
  for (let offset = 0; ; offset += limit) {
    const response = await listTeamMembers({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getTeamMember(id: string) {
  return (await apiFetch<DataEnvelope<TeamMember>>(`/api/users/${encodeURIComponent(id)}`)).data;
}

export interface CreateTeamMemberBody {
  name: string;
  email: string;
  role: TeamRole;
  scopes?: string[];
  /** Invite email language. Defaults to en server-side. */
  language?: "ar" | "en";
}

export async function createTeamMember(body: CreateTeamMemberBody) {
  const response = await apiFetch<
    DataEnvelope<TeamMember> & {
      apiKey: string;
      tempPassword: string;
      emailSent: boolean;
      emailError: string | null;
    }
  >("/api/users", json({ method: "POST", body: JSON.stringify(body) }));
  return {
    user: response.data,
    apiKey: response.apiKey,
    tempPassword: response.tempPassword,
    emailSent: response.emailSent ?? false,
    emailError: response.emailError ?? null,
  } satisfies CreateTeamMemberResult;
}

export function updateTeamMember(id: string, updates: { name?: string; email?: string; status?: TeamStatus }) {
  return apiFetch<DataEnvelope<TeamMember>>(`/api/users/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(updates) }));
}

export function updateTeamMemberRole(id: string, role: TeamRole) {
  return apiFetch<DataEnvelope<TeamMember>>(`/api/users/${encodeURIComponent(id)}/role`, json({ method: "PATCH", body: JSON.stringify({ role }) }));
}

export function grantTeamMemberScope(userId: string, scope: string) {
  return apiFetch<DataEnvelope<TeamMember>>(`/api/users/${encodeURIComponent(userId)}/scopes`, json({ method: "POST", body: JSON.stringify({ scope }) }));
}

export function revokeTeamMemberScope(userId: string, scope: string) {
  return apiFetch<DataEnvelope<TeamMember>>(`/api/users/${encodeURIComponent(userId)}/scopes/${encodeURIComponent(scope)}`, { method: "DELETE" });
}

export async function rotateTeamMemberApiKey(userId: string) {
  const response = await apiFetch<DataEnvelope<{ apiKey: string }>>(`/api/users/${encodeURIComponent(userId)}/api-key/rotate`, json({ method: "POST", body: "{}" }));
  return response.data;
}

export async function listUserActivityLogs(userId: string, params: { limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 30),
    offset: String(params.offset ?? 0),
  });
  return (await apiFetch<ListEnvelope<ActivityLog>>(`/api/activity-logs/users/${encodeURIComponent(userId)}?${query}`)).data;
}
