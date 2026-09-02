import { apiFetch } from "@/lib/api";
import type { ProductCategory } from "./types";

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

export interface ProductGroupListParams {
  search?: string;
  parentId?: string;
}

export async function listProductGroups(params: ProductGroupListParams = {}) {
  const query = new URLSearchParams();
  for (const key of ["search", "parentId"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return (await apiFetch<ListEnvelope<ProductCategory>>(`/api/product-groups${qs ? `?${qs}` : ""}`)).data;
}

export async function getProductGroup(id: string) {
  return (await apiFetch<DataEnvelope<ProductCategory>>(`/api/product-groups/${encodeURIComponent(id)}`)).data;
}

export function createProductGroup(body: Partial<ProductCategory>) {
  return apiFetch<DataEnvelope<ProductCategory>>("/api/product-groups", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateProductGroup(id: string, body: Partial<ProductCategory>) {
  return apiFetch<DataEnvelope<ProductCategory>>(`/api/product-groups/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteProductGroup(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/product-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface PresignedUpload {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

export async function getPresignedUploadUrl(contentType: string) {
  return (await apiFetch<DataEnvelope<PresignedUpload>>("/api/images/presign", json({ method: "POST", body: JSON.stringify({ contentType }) }))).data;
}
