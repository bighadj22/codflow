import { apiFetch } from "@/lib/api";
import type {
  CreateCustomPageInput,
  PageLocale,
  SaveTranslationInput,
  StoreLegalProfile,
  StorePageDetail,
  StorePageSummary,
  StorePageTranslationBody,
  UpdateStorePageMetaInput,
  UpsertLegalProfileInput,
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

function id(id: string) {
  return encodeURIComponent(id);
}

export async function listStorePages() {
  return (await apiFetch<ListEnvelope<StorePageSummary>>("/api/store-pages")).data;
}

export async function getStorePage(pageId: string) {
  return (await apiFetch<DataEnvelope<StorePageDetail>>(`/api/store-pages/${id(pageId)}`)).data;
}

export async function createCustomPage(body: CreateCustomPageInput) {
  return (
    await apiFetch<DataEnvelope<StorePageDetail>>(
      "/api/store-pages",
      json({ method: "POST", body: JSON.stringify(body) }),
    )
  ).data;
}

export async function updateStorePage(pageId: string, body: UpdateStorePageMetaInput) {
  return (
    await apiFetch<DataEnvelope<StorePageDetail>>(
      `/api/store-pages/${id(pageId)}`,
      json({ method: "PATCH", body: JSON.stringify(body) }),
    )
  ).data;
}

export async function deleteStorePage(pageId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/store-pages/${id(pageId)}`, { method: "DELETE" });
}

export async function saveStorePageTranslation(
  pageId: string,
  locale: PageLocale,
  body: SaveTranslationInput,
) {
  return (
    await apiFetch<DataEnvelope<StorePageTranslationBody>>(
      `/api/store-pages/${id(pageId)}/translations/${locale}`,
      json({ method: "PUT", body: JSON.stringify(body) }),
    )
  ).data;
}

export async function resetStorePageTranslation(pageId: string, locale: PageLocale) {
  return (
    await apiFetch<DataEnvelope<StorePageTranslationBody>>(
      `/api/store-pages/${id(pageId)}/translations/${locale}/reset`,
      { method: "POST" },
    )
  ).data;
}

export async function seedStoreDefaultPages() {
  return (
    await apiFetch<DataEnvelope<{ created: string[] }>>("/api/store-pages/seed-defaults", {
      method: "POST",
    })
  ).data;
}

export async function getStoreLegalProfile() {
  return (await apiFetch<DataEnvelope<StoreLegalProfile | null>>("/api/store-pages/legal-profile")).data;
}

export async function saveStoreLegalProfile(body: UpsertLegalProfileInput) {
  return (
    await apiFetch<DataEnvelope<StoreLegalProfile>>(
      "/api/store-pages/legal-profile",
      json({ method: "PUT", body: JSON.stringify(body) }),
    )
  ).data;
}
