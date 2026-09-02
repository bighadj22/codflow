import { apiFetch } from "@/lib/api";
import type {
  OtpConfig,
  OtpConnectionCheck,
  PixelConfig,
  SaveOtpConfigData,
  SavePixelConfigData,
  StoreConfig,
  UpdateStoreData,
} from "./types";

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

export async function getMyStore() {
  return (await apiFetch<DataEnvelope<StoreConfig>>("/api/stores/me")).data;
}

export async function updateMyStore(data: UpdateStoreData) {
  return (await apiFetch<DataEnvelope<StoreConfig>>("/api/stores/me", json({ method: "PATCH", body: JSON.stringify(data) }))).data;
}

export async function getPixelConfig() {
  return (await apiFetch<DataEnvelope<PixelConfig | null>>("/api/stores/pixel-config")).data;
}

export async function savePixelConfig(data: SavePixelConfigData) {
  return (await apiFetch<DataEnvelope<PixelConfig>>("/api/stores/pixel-config", json({ method: "POST", body: JSON.stringify(data) }))).data;
}

export async function getOtpConfig() {
  return (await apiFetch<DataEnvelope<OtpConfig | null>>("/api/stores/otp-config")).data;
}

export async function saveOtpConfig(data: SaveOtpConfigData) {
  return (await apiFetch<DataEnvelope<OtpConfig>>("/api/stores/otp-config", json({ method: "POST", body: JSON.stringify(data) }))).data;
}

export async function testOtpConnection(apiKey?: string) {
  return (await apiFetch<DataEnvelope<OtpConnectionCheck>>("/api/stores/otp-config/test", json({ method: "POST", body: JSON.stringify(apiKey ? { apiKey } : {}) }))).data;
}
