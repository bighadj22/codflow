import { apiFetch } from "@/lib/api";
import type { McpConnection } from "./types";

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

export async function listMyMcpConnections() {
  return (await apiFetch<ListEnvelope<McpConnection>>("/api/mcp/me")).data;
}

export async function listTeamMcpConnections() {
  return (await apiFetch<ListEnvelope<McpConnection>>("/api/mcp/team")).data;
}

export function revokeMyMcpConnection(clientId: string) {
  return apiFetch<DataEnvelope<{ clientId: string; userId: string }>>(`/api/mcp/connections/${encodeURIComponent(clientId)}`, { method: "DELETE" });
}

export function revokeUserMcpConnection(clientId: string, userId: string) {
  return apiFetch<DataEnvelope<{ clientId: string; userId: string }>>(`/api/mcp/connections/${encodeURIComponent(clientId)}/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}
