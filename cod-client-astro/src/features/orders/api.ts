import { apiFetch, apiFetchBlob } from "@/lib/api";
import type {
  AbandonedOrder,
  AbandonedStats,
  Commune,
  Customer,
  DeliveryCompany,
  Driver,
  OrderDetail,
  OrderListItem,
  Product,
  ShippingRule,
  StopDesk,
  Wilaya,
} from "./types";

interface ListEnvelope<T> {
  success: boolean;
  data: T[];
  count?: number;
  total?: number;
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

export function listOrders(params: { limit?: number; offset?: number; search?: string; status?: string; wilayaId?: number }) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  for (const [key, value] of Object.entries(params)) {
    if (key !== "limit" && key !== "offset" && value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<ListEnvelope<OrderListItem>>(`/api/orders?${query}`);
}

export async function getOrder(id: string) {
  return (await apiFetch<DataEnvelope<OrderDetail>>(`/api/orders/${encodeURIComponent(id)}`)).data;
}

export function updateOrderStatus(id: string, status: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/status`, json({ method: "PATCH", body: JSON.stringify({ status }) }));
}

export function deleteOrder(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function assignDriver(id: string, driverId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/assign-driver`, json({ method: "PATCH", body: JSON.stringify({ driverId }) }));
}

export function dispatchOrder(id: string, body: Record<string, unknown>) {
  return apiFetch<DataEnvelope<{ trackingNumber: string; labelUrl?: string | null }>>(`/api/orders/${encodeURIComponent(id)}/dispatch`, json({ method: "POST", body: JSON.stringify(body) }));
}

export function validateShipment(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/validate-shipment`, { method: "POST" });
}

export function updateShipment(id: string, body: Record<string, unknown>) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/update-shipment`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function cancelShipment(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/cancel-shipment`, { method: "POST" });
}

export function askShipmentReturn(id: string) {
  return apiFetch<{ success: boolean; message: string }>(`/api/orders/${encodeURIComponent(id)}/ask-return`, { method: "POST" });
}

export function confirmReturnReception(id: string) {
  return apiFetch<{ success: boolean; message: string }>(`/api/orders/${encodeURIComponent(id)}/confirm-return-reception`, { method: "POST" });
}

export function addShipmentRemark(id: string, content: string) {
  return apiFetch<DataEnvelope<null>>(`/api/orders/${encodeURIComponent(id)}/add-remark`, json({ method: "POST", body: JSON.stringify({ content }) }));
}

export async function getTracking(id: string) {
  return (await apiFetch<DataEnvelope<Array<Record<string, unknown>>>>(`/api/orders/${encodeURIComponent(id)}/tracking-events`)).data;
}

export async function downloadLabel(id: string) {
  const blob = await apiFetchBlob(`/api/orders/${encodeURIComponent(id)}/label`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${id}-label.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function listDrivers() {
  return (await apiFetch<ListEnvelope<Driver>>("/api/drivers?limit=100&offset=0")).data;
}

export async function listDeliveryCompanies(active = true) {
  return (await apiFetch<ListEnvelope<DeliveryCompany>>(`/api/delivery-companies?active=${active}&limit=100&offset=0`)).data;
}

export async function listStopDesks(companyId: string, wilayaId?: number) {
  const query = new URLSearchParams({ activeOnly: "true" });
  if (wilayaId) query.set("wilayaId", String(wilayaId));
  const response = await apiFetch<DataEnvelope<{ stopDesks: StopDesk[] }>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/stop-desks?${query}`);
  return response.data.stopDesks;
}

export async function listCustomers(search = "") {
  const query = new URLSearchParams({ limit: "50", offset: "0" });
  if (search) query.set("search", search);
  return (await apiFetch<ListEnvelope<Customer>>(`/api/customers?${query}`)).data;
}

export async function listProducts() {
  return (await apiFetch<ListEnvelope<Product>>("/api/products?status=ACTIVE&limit=100&offset=0")).data;
}

export async function listWilayas() {
  return (await apiFetch<ListEnvelope<Wilaya>>("/api/wilayas")).data;
}

export async function listCommunes(wilayaId: number) {
  return (await apiFetch<ListEnvelope<Commune>>(`/api/wilayas/${wilayaId}/communes`)).data;
}

export async function getDefaultShippingRules() {
  return (await apiFetch<DataEnvelope<ShippingRule[]>>("/api/shipping-profiles/default/rules")).data;
}

export async function getShippingRules(profileId: string) {
  const response = await apiFetch<DataEnvelope<{ rules: ShippingRule[] }>>(`/api/shipping-profiles/${encodeURIComponent(profileId)}`);
  return response.data.rules;
}

export async function createOrder(body: Record<string, unknown>) {
  return (await apiFetch<DataEnvelope<{ id: string; orderNumber: string }>>("/api/orders", json({ method: "POST", body: JSON.stringify(body) }))).data;
}

export async function listAbandonedOrders(params: { limit?: number; offset?: number; status?: string; search?: string } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 50), offset: String(params.offset ?? 0) });
  for (const key of ["status", "search"] as const) if (params[key]) query.set(key, params[key]!);
  return apiFetch<{ success: boolean; data: AbandonedOrder[]; total: number; limit: number; offset: number }>(`/api/abandoned-orders?${query}`);
}

export async function getAbandonedStats() {
  return (await apiFetch<DataEnvelope<AbandonedStats>>("/api/abandoned-orders/stats")).data;
}

export function updateAbandonedStatus(id: string, status: string) {
  return apiFetch<DataEnvelope<null>>(`/api/abandoned-orders/${encodeURIComponent(id)}/status`, json({ method: "PATCH", body: JSON.stringify({ status }) }));
}

export function deleteAbandonedOrder(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/abandoned-orders/${encodeURIComponent(id)}`, { method: "DELETE" });
}
