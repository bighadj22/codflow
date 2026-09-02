import { apiFetch } from "@/lib/api";
import type { Customer } from "@/features/customers/types";
import type { CustomerTag, CustomerTagWithCustomers } from "./types";

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

export interface CustomerTagListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export async function listCustomerTags(params: CustomerTagListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<ListEnvelope<CustomerTag>>(`/api/customer-tags?${query}`);
}

export async function listAllCustomerTags() {
  const rows: CustomerTag[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listCustomerTags({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getCustomerTag(id: string) {
  return (await apiFetch<DataEnvelope<CustomerTagWithCustomers>>(`/api/customer-tags/${encodeURIComponent(id)}?customers=true`)).data;
}

export function createCustomerTag(body: {
  name: string;
  color?: string;
}) {
  return apiFetch<DataEnvelope<CustomerTag>>("/api/customer-tags", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateCustomerTag(id: string, body: {
  name?: string;
  color?: string;
}) {
  return apiFetch<DataEnvelope<CustomerTag>>(`/api/customer-tags/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteCustomerTag(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-tags/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function assignCustomerTag(tagId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-tags/${encodeURIComponent(tagId)}/assignments`, json({ method: "POST", body: JSON.stringify({ customerId }) }));
}

export function unassignCustomerTag(tagId: string, customerId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/customer-tags/${encodeURIComponent(tagId)}/assignments/${encodeURIComponent(customerId)}`, { method: "DELETE" });
}

export async function listCustomers() {
  return (await apiFetch<ListEnvelope<Customer>>("/api/customers?limit=100&offset=0")).data;
}
