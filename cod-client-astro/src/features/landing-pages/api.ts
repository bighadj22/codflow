import { apiFetch } from "@/lib/api";
import type { PresignedUpload } from "@/features/products/api";
import type {
  CreateLandingPageInput,
  LandingPage,
  LandingPageImage,
  LandingPageListItem,
  SaveLandingPageImageInput,
  UpdateLandingPageInput,
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

export async function listLandingPages(filters: { productId?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return (
    await apiFetch<ListEnvelope<LandingPageListItem>>(`/api/landing-pages${qs ? `?${qs}` : ""}`)
  ).data;
}

export async function compareLandingPages(productId: string) {
  return (
    await apiFetch<ListEnvelope<LandingPageListItem>>(
      `/api/landing-pages/compare?productId=${encodeURIComponent(productId)}`,
    )
  ).data;
}

export async function getLandingPage(lpId: string) {
  return (await apiFetch<DataEnvelope<LandingPage>>(`/api/landing-pages/${id(lpId)}`)).data;
}

export async function createLandingPage(body: CreateLandingPageInput) {
  return apiFetch<DataEnvelope<LandingPage>>("/api/landing-pages", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateLandingPage(lpId: string, body: UpdateLandingPageInput) {
  return apiFetch<DataEnvelope<LandingPage>>(`/api/landing-pages/${id(lpId)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function duplicateLandingPage(lpId: string) {
  return apiFetch<DataEnvelope<LandingPage>>(`/api/landing-pages/${id(lpId)}/duplicate`, { method: "POST" });
}

export function deleteLandingPage(lpId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/landing-pages/${id(lpId)}`, { method: "DELETE" });
}

export function publishLandingPage(lpId: string) {
  return apiFetch<DataEnvelope<LandingPage>>(`/api/landing-pages/${id(lpId)}/publish`, { method: "POST" });
}

export function unpublishLandingPage(lpId: string) {
  return apiFetch<DataEnvelope<LandingPage>>(`/api/landing-pages/${id(lpId)}/unpublish`, { method: "POST" });
}

export function archiveLandingPage(lpId: string) {
  return apiFetch<DataEnvelope<null>>(`/api/landing-pages/${id(lpId)}/archive`, { method: "POST" });
}

export async function listLandingPageImages(lpId: string) {
  return (await apiFetch<ListEnvelope<LandingPageImage>>(`/api/landing-pages/${id(lpId)}/images`)).data;
}

export async function saveLandingPageImage(lpId: string, body: SaveLandingPageImageInput) {
  return (await apiFetch<ListEnvelope<LandingPageImage>>(`/api/landing-pages/${id(lpId)}/images`, json({ method: "POST", body: JSON.stringify(body) }))).data;
}

export async function reorderLandingPageImages(lpId: string, imageIds: string[]) {
  return (
    await apiFetch<ListEnvelope<LandingPageImage>>(
      `/api/landing-pages/${id(lpId)}/images/reorder`,
      json({ method: "PATCH", body: JSON.stringify({ imageIds }) }),
    )
  ).data;
}

export function deleteLandingPageImage(lpId: string, imageId: string) {
  return apiFetch<DataEnvelope<null>>(
    `/api/landing-pages/${id(lpId)}/images/${id(imageId)}`,
    { method: "DELETE" },
  );
}

export async function getPresignedLandingUploadUrl(contentType: string) {
  return (
    await apiFetch<DataEnvelope<PresignedUpload>>(
      "/api/images/presign",
      json({ method: "POST", body: JSON.stringify({ contentType, folder: "landing" }) }),
    )
  ).data;
}
