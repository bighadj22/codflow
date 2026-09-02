import { apiFetch } from "@/lib/api";
import type { Commune, Wilaya } from "@/features/orders/types";
import type {
  Customer,
  CustomerGroup,
  CustomerGroupMembership,
  CustomerOrderSummary,
  CustomerTag,
  CustomerTagMembership,
} from "./types";

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

export interface CustomerListParams {
  limit?: number;
  offset?: number;
  search?: string;
  wilayaId?: number;
  groupId?: string;
  tagId?: string;
}

export async function listCustomers(params: CustomerListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  for (const key of ["search", "wilayaId", "groupId", "tagId"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<ListEnvelope<Customer>>(`/api/customers?${query}`);
}

export async function listAllCustomers() {
  const rows: Customer[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listCustomers({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getCustomer(id: string) {
  return (await apiFetch<DataEnvelope<Customer>>(`/api/customers/${encodeURIComponent(id)}`)).data;
}

export async function getCustomerOrders(id: string) {
  return (await apiFetch<ListEnvelope<CustomerOrderSummary>>(`/api/customers/${encodeURIComponent(id)}/orders`)).data;
}

export async function createCustomer(body: {
  name: string;
  phone: string;
  phone2?: string | null;
  wilayaId: number;
  communeId: string;
  address?: string;
}) {
  return (await apiFetch<DataEnvelope<Customer>>("/api/customers", json({ method: "POST", body: JSON.stringify(body) }))).data;
}

export async function updateCustomer(id: string, body: Partial<{
  name: string;
  phone: string;
  phone2: string | null;
  wilayaId: number;
  communeId: string | null;
  address: string | null;
}>) {
  return (await apiFetch<DataEnvelope<Customer>>(`/api/customers/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }))).data;
}

export function deleteCustomer(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getCustomerGroups(id: string) {
  return (await apiFetch<ListEnvelope<CustomerGroupMembership>>(`/api/customers/${encodeURIComponent(id)}/groups`)).data;
}

export async function getCustomerTags(id: string) {
  return (await apiFetch<ListEnvelope<CustomerTagMembership>>(`/api/customers/${encodeURIComponent(id)}/tags`)).data;
}

export async function listCustomerGroups() {
  return (await apiFetch<ListEnvelope<CustomerGroup>>("/api/customer-groups?limit=100&offset=0")).data;
}

export async function listCustomerTags() {
  return (await apiFetch<ListEnvelope<CustomerTag>>("/api/customer-tags?limit=100&offset=0")).data;
}

export function addCustomerToGroup(groupId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-groups/${encodeURIComponent(groupId)}/members`, json({ method: "POST", body: JSON.stringify({ customerId }) }));
}

export function removeCustomerFromGroup(groupId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(customerId)}`, { method: "DELETE" });
}

export function assignCustomerTag(tagId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-tags/${encodeURIComponent(tagId)}/assignments`, json({ method: "POST", body: JSON.stringify({ customerId }) }));
}

export function unassignCustomerTag(tagId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-tags/${encodeURIComponent(tagId)}/assignments/${encodeURIComponent(customerId)}`, { method: "DELETE" });
}

export async function listWilayas() {
  return (await apiFetch<ListEnvelope<Wilaya>>("/api/wilayas")).data;
}

export async function listCommunes(wilayaId: number) {
  return (await apiFetch<ListEnvelope<Commune>>(`/api/wilayas/${wilayaId}/communes`)).data;
}
