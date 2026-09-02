import { apiFetch } from "@/lib/api";
import type { Customer } from "@/features/customers/types";
import type { CustomerGroup, CustomerGroupWithMembers } from "./types";

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

export interface CustomerGroupListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export async function listCustomerGroups(params: CustomerGroupListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<ListEnvelope<CustomerGroup>>(`/api/customer-groups?${query}`);
}

export async function listAllCustomerGroups() {
  const rows: CustomerGroup[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listCustomerGroups({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getCustomerGroup(id: string) {
  return (await apiFetch<DataEnvelope<CustomerGroupWithMembers>>(`/api/customer-groups/${encodeURIComponent(id)}?members=true`)).data;
}

export function createCustomerGroup(body: {
  name: string;
  description?: string;
  color?: string;
}) {
  return apiFetch<DataEnvelope<CustomerGroup>>("/api/customer-groups", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateCustomerGroup(id: string, body: {
  name?: string;
  description?: string | null;
  color?: string;
}) {
  return apiFetch<DataEnvelope<CustomerGroup>>(`/api/customer-groups/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteCustomerGroup(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function addCustomerToGroup(groupId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-groups/${encodeURIComponent(groupId)}/members`, json({ method: "POST", body: JSON.stringify({ customerId }) }));
}

export function removeCustomerFromGroup(groupId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(customerId)}`, { method: "DELETE" });
}

export async function listCustomers() {
  return (await apiFetch<ListEnvelope<Customer>>("/api/customers?limit=100&offset=0")).data;
}
