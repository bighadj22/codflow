import { apiFetch } from "@/lib/api";
import { listOrders } from "@/features/orders/api";
import type { OrderListItem } from "@/features/orders/types";
import type { Driver, DriverCompensation, DriverOrder, DriverPayment, DriverPaymentType, DriverStatus, VehicleType, Wilaya, DeliveryCompany, StopDesk, ShippingProfile, ShippingProfileWithRules, CommuneOverride } from "./types";

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

export interface DriverListParams {
  wilayaId?: number;
  status?: DriverStatus;
  vehicleType?: VehicleType;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listDrivers(params: DriverListParams = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  for (const key of ["wilayaId", "status", "vehicleType", "search"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<ListEnvelope<Driver>>(`/api/drivers?${query}`);
}

export async function listAllDrivers() {
  const rows: Driver[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listDrivers({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getDriver(id: string) {
  return (await apiFetch<DataEnvelope<Driver>>(`/api/drivers/${encodeURIComponent(id)}`)).data;
}

export function createDriver(body: Partial<Driver>) {
  return apiFetch<DataEnvelope<Driver>>("/api/drivers", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateDriver(id: string, body: Partial<Driver>) {
  return apiFetch<DataEnvelope<Driver>>(`/api/drivers/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function updateDriverStatus(id: string, status: DriverStatus) {
  return apiFetch<DataEnvelope<Driver>>(`/api/drivers/${encodeURIComponent(id)}/status`, json({ method: "PATCH", body: JSON.stringify({ status }) }));
}

export function deleteDriver(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/drivers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listDriverCompensations(driverId: string) {
  return (await apiFetch<ListEnvelope<DriverCompensation>>(`/api/drivers/${encodeURIComponent(driverId)}/compensations`)).data;
}

export function setDriverCompensation(driverId: string, wilayaId: number, feePerDelivery: number) {
  return apiFetch<DataEnvelope<DriverCompensation>>(`/api/drivers/${encodeURIComponent(driverId)}/compensations/${wilayaId}`, json({ method: "PUT", body: JSON.stringify({ feePerDelivery }) }));
}

export function deleteDriverCompensation(driverId: string, wilayaId: number) {
  return apiFetch<DataEnvelope<null>>(`/api/drivers/${encodeURIComponent(driverId)}/compensations/${wilayaId}`, { method: "DELETE" });
}

export function createDriverPayment(body: { driverId: string; type: DriverPaymentType; orderIds: string[]; notes?: string }) {
  return apiFetch<DataEnvelope<DriverPayment>>("/api/driver-payments", json({ method: "POST", body: JSON.stringify(body) }));
}

export async function listDriverPayments(driverId: string) {
  return (await apiFetch<ListEnvelope<DriverPayment>>(`/api/driver-payments/${encodeURIComponent(driverId)}`)).data;
}

export async function listPendingSettlementOrders(driverId: string) {
  return (await apiFetch<ListEnvelope<DriverOrder>>(`/api/driver-payments/${encodeURIComponent(driverId)}/pending`)).data;
}

export async function listAllOrders() {
  const rows: OrderListItem[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listOrders({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function listWilayas() {
  return (await apiFetch<ListEnvelope<Wilaya>>("/api/wilayas")).data;
}

// ─── Delivery Company API ─────────────────────────────────────────────────────

export async function listDeliveryCompanies(params: { limit: number; offset: number; active?: boolean }) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.active !== undefined) query.set("active", String(params.active));
  return apiFetch<ListEnvelope<DeliveryCompany>>(`/api/delivery-companies?${query}`);
}

export async function listAllDeliveryCompanies() {
  const rows: DeliveryCompany[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await listDeliveryCompanies({ limit, offset });
    rows.push(...response.data);
    if (response.data.length < limit) return rows;
  }
}

export async function getDeliveryCompany(id: string) {
  return (await apiFetch<DataEnvelope<DeliveryCompany>>(`/api/delivery-companies/${encodeURIComponent(id)}`)).data;
}

export function createDeliveryCompany(body: Partial<DeliveryCompany>) {
  return apiFetch<DataEnvelope<DeliveryCompany>>("/api/delivery-companies", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateDeliveryCompany(id: string, body: Partial<DeliveryCompany>) {
  return apiFetch<DataEnvelope<DeliveryCompany>>(`/api/delivery-companies/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteDeliveryCompany(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/delivery-companies/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ─── Stop Desks ───────────────────────────────────────────────────────────────

export async function fetchCompanyStopDesks(companyId: string, opts?: { wilayaId?: number; activeOnly?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.wilayaId != null) params.set("wilayaId", String(opts.wilayaId));
  if (opts?.activeOnly === false) params.set("activeOnly", "false");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return (await apiFetch<DataEnvelope<{ stopDesks: StopDesk[]; total: number; company: { id: string; name: string; code: string } }>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/stop-desks${qs}`)).data.stopDesks;
}

export async function syncCompanyStopDesks(companyId: string) {
  return (await apiFetch<DataEnvelope<{ total: number; removed: number; syncedAt: string }>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/sync-stop-desks`, json({ method: "POST", body: "{}" }))).data;
}

export async function toggleCompanyStopDesk(companyId: string, code: string) {
  return (await apiFetch<DataEnvelope<{ code: string; active: boolean }>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/stop-desks/${encodeURIComponent(code)}/toggle`, json({ method: "PATCH", body: "{}" }))).data;
}

// ─── Carrier Connection ───────────────────────────────────────────────────────

export interface ConnectionCheckResult {
  companyId: string;
  companyName: string;
  companyCode: string;
  ok: boolean;
  code: string;
  message: string;
  details?: { servedWilayaIds?: number[]; servedWilayaCount?: number } & Record<string, unknown>;
}

export async function testCompanyConnection(companyId: string) {
  return (await apiFetch<DataEnvelope<ConnectionCheckResult>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/test-connection`, { method: "POST" })).data;
}

export interface ReconcileSummary {
  pagesFetched: number;
  ordersSeen: number;
  updated: number;
  unchanged: number;
  notFound: number;
  skippedUnmapped: number;
  unmappedSamples: string[];
  morePagesRemain: boolean;
}

export async function reconcileCompanyOrders(companyId: string, maxPages?: number) {
  const query = maxPages != null ? `?maxPages=${maxPages}` : "";
  return (await apiFetch<DataEnvelope<ReconcileSummary>>(`/api/delivery-companies/${encodeURIComponent(companyId)}/reconcile-orders${query}`, { method: "POST" })).data;
}

// ─── Webhook Management ───────────────────────────────────────────────────────

export async function registerZrWebhook(companyId: string) {
  return await apiFetch<{ success: boolean; webhookUrl: string; endpointId: string }>(`/api/delivery-companies/${encodeURIComponent(companyId)}/webhook/register`, json({ method: "POST", body: "{}" }));
}

export async function unregisterZrWebhook(companyId: string) {
  return await apiFetch<{ success: boolean }>(`/api/delivery-companies/${encodeURIComponent(companyId)}/webhook/register`, { method: "DELETE" });
}

export async function saveYalidineSecret(companyId: string, secret: string) {
  return await apiFetch<{ success: boolean }>(`/api/delivery-companies/${encodeURIComponent(companyId)}/webhook/secret`, json({ method: "PATCH", body: JSON.stringify({ secret }) }));
}

export async function saveZrStatusMapping(companyId: string, mapping: Record<string, string[]>) {
  return await apiFetch<{ success: boolean }>(`/api/delivery-companies/${encodeURIComponent(companyId)}/webhook/mapping`, json({ method: "PATCH", body: JSON.stringify({ mapping }) }));
}

// ─── Shipping Profiles ────────────────────────────────────────────────────────

export async function listShippingProfiles() {
  return (await apiFetch<ListEnvelope<ShippingProfile>>("/api/shipping-profiles")).data;
}

export async function getShippingProfile(id: string) {
  return (await apiFetch<DataEnvelope<ShippingProfileWithRules>>(`/api/shipping-profiles/${encodeURIComponent(id)}`)).data;
}

export function createShippingProfile(body: { name: string; isDefault?: boolean; notes?: string | null }) {
  return apiFetch<DataEnvelope<ShippingProfileWithRules>>("/api/shipping-profiles", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateShippingProfile(id: string, body: { name?: string; isDefault?: boolean; notes?: string | null }) {
  return apiFetch<DataEnvelope<ShippingProfileWithRules>>(`/api/shipping-profiles/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteShippingProfile(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/shipping-profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function setShippingRules(profileId: string, rules: ShippingRuleDraft[]) {
  return apiFetch<DataEnvelope<ShippingProfileWithRules>>(`/api/shipping-profiles/${encodeURIComponent(profileId)}/rules`, json({ method: "PUT", body: JSON.stringify({ rules }) }));
}

export async function listShippingRuleCommunes(profileId: string, wilayaId: number) {
  return (await apiFetch<DataEnvelope<CommuneOverride[]>>(`/api/shipping-profiles/${encodeURIComponent(profileId)}/rules/${wilayaId}/communes`)).data;
}

export function setCommuneOverride(profileId: string, wilayaId: number, communeId: string, data: Partial<CommuneOverrideDraft>) {
  return apiFetch<DataEnvelope<null>>(`/api/shipping-profiles/${encodeURIComponent(profileId)}/rules/${wilayaId}/communes/${encodeURIComponent(communeId)}`, json({ method: "PUT", body: JSON.stringify(data) }));
}

export function deleteCommuneOverride(profileId: string, wilayaId: number, communeId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/shipping-profiles/${encodeURIComponent(profileId)}/rules/${wilayaId}/communes/${encodeURIComponent(communeId)}`, { method: "DELETE" });
}

export interface ShippingRuleDraft {
  wilayaId: number;
  homePrice: number;
  stopDeskPrice: number;
  homeEnabled: boolean;
  stopDeskEnabled: boolean;
}

export interface CommuneOverrideDraft {
  homeEnabled?: boolean | null;
  stopDeskEnabled?: boolean | null;
  homePrice?: number | null;
  stopDeskPrice?: number | null;
}
