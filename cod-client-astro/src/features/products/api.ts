import { apiFetch } from "@/lib/api";
import type { Product, ProductCategory, ProductImage, ProductStatus, ProductVariant, ShippingProfile, StockAdjustStockResult, StockHistoryResponse, StockMovement, StockOverview, StockAlertItem } from "./types";

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

export interface ProductListParams {
  categoryId?: string;
  status?: ProductStatus;
  visibility?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listProducts(params: ProductListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  for (const key of ["categoryId", "status", "search"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  if (params.visibility !== undefined) query.set("visibility", String(params.visibility));
  return apiFetch<ListEnvelope<Product>>(`/api/products?${query}`);
}

export async function listAllProducts() {
  const rows: Product[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listProducts({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getProduct(id: string) {
  return (await apiFetch<DataEnvelope<Product>>(`/api/products/${encodeURIComponent(id)}`)).data;
}

export function createProduct(body: Partial<Product>) {
  return apiFetch<DataEnvelope<Product>>("/api/products", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateProduct(id: string, body: Partial<Product>) {
  return apiFetch<DataEnvelope<Product>>(`/api/products/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function updateProductStatus(id: string, status: ProductStatus) {
  return apiFetch<DataEnvelope<Product>>(`/api/products/${encodeURIComponent(id)}/status`, json({ method: "PATCH", body: JSON.stringify({ status }) }));
}

export function deleteProduct(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listVariants(productId: string) {
  return (await apiFetch<ListEnvelope<ProductVariant>>(`/api/products/${encodeURIComponent(productId)}/variants`)).data;
}

export function createVariant(productId: string, body: Partial<ProductVariant>) {
  return apiFetch<DataEnvelope<ProductVariant>>(`/api/products/${encodeURIComponent(productId)}/variants`, json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateVariant(productId: string, variantId: string, body: Partial<ProductVariant>) {
  return apiFetch<DataEnvelope<ProductVariant>>(`/api/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteVariant(productId: string, variantId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, { method: "DELETE" });
}

export async function listProductImages(productId: string) {
  return (await apiFetch<DataEnvelope<ProductImage[]>>(`/api/products/${encodeURIComponent(productId)}/images`)).data;
}

export function saveProductImage(productId: string, body: { key: string; src: string; altText?: string; position?: number }) {
  return apiFetch<DataEnvelope<ProductImage>>(`/api/products/${encodeURIComponent(productId)}/images`, json({ method: "POST", body: JSON.stringify(body) }));
}

export function reorderProductImages(productId: string, imageIds: string[]) {
  return apiFetch<DataEnvelope<ProductImage[]>>(`/api/products/${encodeURIComponent(productId)}/images/reorder`, json({ method: "PATCH", body: JSON.stringify({ imageIds }) }));
}

export function deleteProductImage(productId: string, imageId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" });
}

export interface PresignedUpload {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

export async function getPresignedUploadUrl(contentType: string) {
  return (await apiFetch<DataEnvelope<PresignedUpload>>("/api/images/presign", json({ method: "POST", body: JSON.stringify({ contentType }) }))).data;
}

export async function getStockOverview() {
  return (await apiFetch<DataEnvelope<StockOverview>>("/api/stock/overview")).data;
}

export function adjustProductStock(productId: string, input: { type: StockMovement["type"]; delta: number; reason?: string }) {
  return apiFetch<DataEnvelope<StockAdjustStockResult>>(`/api/products/${encodeURIComponent(productId)}/stock/adjust`, json({ method: "POST", body: JSON.stringify(input) }));
}

export function adjustVariantStock(productId: string, variantId: string, input: { type: StockMovement["type"]; delta: number; reason?: string }) {
  return apiFetch<DataEnvelope<StockAdjustStockResult>>(`/api/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock/adjust`, json({ method: "POST", body: JSON.stringify(input) }));
}

export function updateProductStockThreshold(productId: string, lowStockThreshold: number) {
  return apiFetch<DataEnvelope<null>>(`/api/products/${encodeURIComponent(productId)}/stock/threshold`, json({ method: "PATCH", body: JSON.stringify({ lowStockThreshold }) }));
}

export function updateVariantStockThreshold(productId: string, variantId: string, lowStockThreshold: number) {
  return apiFetch<DataEnvelope<null>>(`/api/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock/threshold`, json({ method: "PATCH", body: JSON.stringify({ lowStockThreshold }) }));
}

export async function getStockHistory(productId: string, filters: { variantId?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  });
  if (filters.variantId) query.set("variantId", filters.variantId);
  return (await apiFetch<DataEnvelope<StockHistoryResponse>>(`/api/products/${encodeURIComponent(productId)}/stock/history?${query}`)).data;
}

export async function listProductGroups() {
  return (await apiFetch<ListEnvelope<ProductCategory>>("/api/product-groups?limit=100&offset=0")).data;
}

export async function listShippingProfiles() {
  return (await apiFetch<ListEnvelope<ShippingProfile>>("/api/shipping-profiles?limit=100&offset=0")).data;
}

export async function listStockAlerts(filters: { limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  });
  return (await apiFetch<DataEnvelope<{ items: StockAlertItem[]; total: number }>>(`/api/stock/alerts?${query}`)).data;
}
